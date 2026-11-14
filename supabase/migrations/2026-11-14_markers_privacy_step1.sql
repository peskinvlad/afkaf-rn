-- 2026-11-14  fix/security-1: приватность меток/голосов/блоков — ШАГ 1 (создание).
-- applied 2026-11-14 (через Supabase MCP). Файл приведён к состоянию живой БД
-- (сверено pg_get_functiondef / information_schema). Шаг 1 НЕ закрывает прямой
-- доступ (REVOKE/политики) — только добавляет серверные функции и серверную
-- простановку user_id, чтобы старые iOS/Android-сборки продолжали работать.
-- Прямой SELECT на markers/marker_votes закроет отдельный ШАГ 3 после OTA.
--
-- Снапшоты обновлены тем же коммитом:
--   functions/get_map_markers.sql, functions/get_marker_votes.sql,
--   functions/cast_marker_vote.sql, functions/get_user_previews.sql,
--   functions/block_user.sql, functions/get_my_blocks.sql,
--   tables.sql (markers.user_id DEFAULT auth.uid(); blocks.blocked_name/avatar).
BEGIN;

-- user_id метки ставит сервер (клиент перестаёт его слать). Старые клиенты шлют
-- свой uid явно — DEFAULT не используется, поведение не меняется.
ALTER TABLE public.markers ALTER COLUMN user_id SET DEFAULT auth.uid();

-- Чтение меток для карты: БЕЗ user_id, с is_mine; confirmations/denials — из
-- кэш-колонок markers. Единый shadow-фильтр для anon и authenticated (у прямого
-- markers_select_anon фильтра нет — здесь гость и вошедший равны). GRANT обоим.
CREATE OR REPLACE FUNCTION public.get_map_markers()
 RETURNS TABLE(id uuid, type text, lat double precision, lng double precision,
               description text, created_at timestamptz, expires_at timestamptz,
               confirmations integer, denials integer, is_mine boolean)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  select m.id, m.type, m.lat, m.lng, m.description, m.created_at, m.expires_at,
         m.confirmations, m.denials,
         coalesce(m.user_id = auth.uid(), false) as is_mine
  from markers m
  where (m.expires_at is null or m.expires_at > now())
    and (
      m.user_id = auth.uid()
      or not (select s.is_shadow_banned from get_shadow_status(m.user_id) s)
    );
$function$;
GRANT EXECUTE ON FUNCTION public.get_map_markers() TO anon, authenticated;

-- Счётчики голосов + только МОЙ голос (чужие user_id не отдаём). GRANT обоим.
CREATE OR REPLACE FUNCTION public.get_marker_votes(p_marker_id uuid)
 RETURNS TABLE(still_there integer, gone integer, my_vote text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  select
    (count(*) filter (where v.vote = 'still_there'))::int,
    (count(*) filter (where v.vote = 'gone'))::int,
    max(v.vote) filter (where v.user_id = auth.uid())
  from marker_votes v
  where v.marker_id = p_marker_id;
$function$;
GRANT EXECUTE ON FUNCTION public.get_marker_votes(uuid) TO anon, authenticated;

-- Запись голоса: user_id=auth.uid(), rate-limit 30/мин (PT429), «не своя метка»
-- (PT403), upsert (внутри definer владелец имеет SELECT). GRANT только authenticated.
CREATE OR REPLACE FUNCTION public.cast_marker_vote(p_marker_id uuid, p_vote text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare uid uuid := auth.uid();
begin
  if uid is null then
    raise exception using errcode = 'PT401', message = 'not_authenticated';
  end if;
  if p_vote is null or p_vote not in ('still_there','gone') then
    raise exception using errcode = 'PT400', message = 'bad_vote';
  end if;
  if not public.rpc_rate_limit('cast_marker_vote', 30, interval '1 minute') then
    raise exception using errcode = 'PT429', message = 'rpc_rate_limit',
      detail = 'cast_marker_vote called too often', hint = 'Too many requests, slow down';
  end if;
  if (select m.user_id from markers m where m.id = p_marker_id) = uid then
    raise exception using errcode = 'PT403', message = 'own_marker';
  end if;
  insert into marker_votes (marker_id, user_id, vote)
  values (p_marker_id, uid, p_vote)
  on conflict (marker_id, user_id) do update set vote = excluded.vote;
end;
$function$;
REVOKE ALL ON FUNCTION public.cast_marker_vote(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cast_marker_vote(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.cast_marker_vote(uuid, text) TO authenticated;

-- №8: инициатор pending-заявки НЕ получает превью адресата; получатель — получает.
CREATE OR REPLACE FUNCTION public.get_user_previews(ids uuid[])
 RETURNS TABLE(id uuid, display_name text, dog_name text, dog_avatar text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  select p.id, p.display_name, d.name as dog_name, d.icon as dog_avatar
  from profiles p
  left join lateral (
    select dg.name, dg.icon from dogs dg
    where dg.owner_id = p.id order by dg.created_at asc limit 1
  ) d on true
  where p.id = any(ids)
    and p.id <> auth.uid()
    and not public.is_blocked(p.id)
    and (
      exists (
        select 1 from friendships f
        where (
          f.status = 'accepted' and (
            (f.requester_id = auth.uid() and f.addressee_id = p.id)
            or (f.addressee_id = auth.uid() and f.requester_id = p.id))
        ) or (
          f.status = 'pending'
          and f.addressee_id = auth.uid() and f.requester_id = p.id
        )
      )
      or exists (
        select 1 from active_walks aw
        where aw.user_id = p.id
          and aw.updated_at > now() - interval '30 minutes'
          and (
            aw.visibility = 'everyone'
            or (aw.visibility = 'friends' and exists (
              select 1 from friendships f2
              where f2.status = 'accepted'
                and ((f2.requester_id = auth.uid() and f2.addressee_id = aw.user_id)
                  or (f2.addressee_id = auth.uid() and f2.requester_id = aw.user_id))))
          )
      )
    );
$function$;

-- №2: снимок имени/иконки при блоке + get_my_blocks без live-join к profiles/dogs.
ALTER TABLE public.blocks
  ADD COLUMN IF NOT EXISTS blocked_name   text,
  ADD COLUMN IF NOT EXISTS blocked_avatar text;

CREATE OR REPLACE FUNCTION public.block_user(p_user_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v_name text; v_avatar text;
begin
  if auth.uid() is null then
    raise exception using errcode = 'PT401', message = 'not_authenticated';
  end if;
  if p_user_id = auth.uid() then
    raise exception using errcode = 'PT400', message = 'cannot_block_self';
  end if;
  -- снимок берём ДО вставки блока (после неё get_user_previews его прячет):
  -- строка вернётся только если человек СЕЙЧАС виден мне, иначе NULL.
  select up.display_name, up.dog_avatar into v_name, v_avatar
  from public.get_user_previews(array[p_user_id]) up limit 1;
  insert into blocks (blocker_id, blocked_id, blocked_name, blocked_avatar)
  values (auth.uid(), p_user_id, v_name, v_avatar)
  on conflict do nothing;
  delete from friendships
  where (requester_id = auth.uid() and addressee_id = p_user_id)
     or (requester_id = p_user_id and addressee_id = auth.uid());
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_my_blocks()
 RETURNS TABLE(user_id uuid, display_name text, dog_name text, dog_avatar text, created_at timestamptz)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  select b.blocked_id, b.blocked_name, null::text as dog_name, b.blocked_avatar, b.created_at
  from blocks b
  where b.blocker_id = auth.uid()
  order by b.created_at desc;
$function$;

COMMIT;
