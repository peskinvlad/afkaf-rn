-- 2026-11-20 first_name_strangers v2
-- Незнакомым — только первое слово display_name; полное имя — себе и принятым
-- друзьям (friendships.status = 'accepted').
--
-- Заменяет неприменённую миграцию 2026-10-22_first_name_strangers.sql (ветка
-- fix/first-name-strangers): та была написана ДО модерации и перезаписала бы
-- функции без фильтра public.is_blocked(...). Здесь за основу взяты живые тела
-- функций на 2026-11-20 (с is_blocked), меняется только выдача display_name.
-- Подписи, SECURITY DEFINER, search_path и гранты не меняются.

CREATE OR REPLACE FUNCTION public.get_user_previews(ids uuid[])
 RETURNS TABLE(id uuid, display_name text, dog_name text, dog_avatar text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    p.id,
    case
      when exists (
        select 1 from friendships fa
        where fa.status = 'accepted'
          and ((fa.requester_id = auth.uid() and fa.addressee_id = p.id)
            or (fa.addressee_id = auth.uid() and fa.requester_id = p.id))
      ) then p.display_name
      else coalesce(substring(p.display_name from '\S+'), p.display_name)
    end as display_name,
    d.name as dog_name,
    d.icon as dog_avatar
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

CREATE OR REPLACE FUNCTION public.get_park_presence(p_marker_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid          uuid := auth.uid();
  v_named      jsonb;
  v_named_cnt  integer;
  v_anon       integer;
  v_me         record;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'PT401', MESSAGE = 'not_authenticated';
  END IF;

  IF NOT public.rpc_rate_limit('get_park_presence', 20, interval '1 minute') THEN
    RAISE EXCEPTION
      USING ERRCODE = 'PT429',
            MESSAGE = 'rpc_rate_limit',
            DETAIL  = 'get_park_presence called too often',
            HINT    = 'Too many requests, slow down';
  END IF;

  WITH present AS (
    SELECT
      c.user_id,
      c.started_at,
      c.manual,
      aw.visibility,
      EXISTS (
        SELECT 1 FROM friendships f
        WHERE f.status = 'accepted'
          AND ((f.requester_id = uid AND f.addressee_id = c.user_id)
            OR (f.addressee_id = uid AND f.requester_id = c.user_id))
      ) AS is_friend
    FROM park_checkins c
    JOIN active_walks aw ON aw.user_id = c.user_id
    WHERE c.marker_id = p_marker_id
      AND c.ended_at IS NULL
      AND c.expires_at > now()
      AND aw.updated_at > now() - interval '30 minutes'
      AND aw.visibility <> 'nobody'
      AND NOT public.is_blocked(c.user_id)
  ),
  classified AS (
    SELECT
      p.*,
      (p.user_id = uid) AS is_me,
      (   p.user_id = uid
       OR p.manual
       OR p.visibility = 'everyone'
       OR (p.visibility = 'friends' AND p.is_friend)
      ) AS is_named
    FROM present p
  )
  SELECT
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'user_id',      cl.user_id,
          'display_name', CASE
                            WHEN cl.is_me OR cl.is_friend THEN pr.display_name
                            ELSE COALESCE(substring(pr.display_name FROM '\S+'), pr.display_name)
                          END,
          'dog_name',     d.name,
          'dog_avatar',   d.icon,
          'is_friend',    cl.is_friend,
          'is_me',        cl.is_me,
          'manual',       cl.manual,
          'since',        cl.started_at
        )
        ORDER BY cl.is_me DESC, cl.is_friend DESC, cl.started_at ASC
      ) FILTER (WHERE cl.is_named),
      '[]'::jsonb
    ),
    count(*) FILTER (WHERE cl.is_named),
    count(*) FILTER (WHERE NOT cl.is_named)
  INTO v_named, v_named_cnt, v_anon
  FROM classified cl
  LEFT JOIN profiles pr ON pr.id = cl.user_id
  LEFT JOIN LATERAL (
    SELECT dg.name, dg.icon
    FROM dogs dg
    WHERE dg.owner_id = cl.user_id
    ORDER BY dg.created_at ASC
    LIMIT 1
  ) d ON true;

  -- k-анонимность (k=2) — после исключения заблокированных.
  IF v_anon < 2 THEN
    v_anon := 0;
  END IF;

  SELECT c.manual INTO v_me
  FROM park_checkins c
  WHERE c.user_id = uid
    AND c.marker_id = p_marker_id
    AND c.ended_at IS NULL
    AND c.expires_at > now();

  RETURN jsonb_build_object(
    'total', v_named_cnt + v_anon,
    'anon',  v_anon,
    'named', v_named,
    'me',    jsonb_build_object(
               'checked_in', FOUND,
               'manual',     COALESCE(v_me.manual, false)
             )
  );
END;
$function$;
