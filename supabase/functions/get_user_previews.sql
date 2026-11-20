-- Снимок от 2026-09-13; обновлён 2026-11-14 (fix/security-1, markers_privacy_step1).
-- RPC для превью пользователей (имя + одна собака) в списке друзей/заявок и
-- «рядом». SECURITY DEFINER ОБЯЗАТЕЛЕН: profiles/dogs owner-only под RLS. Строки
-- отдаются ТОЛЬКО для пользователей, с кем есть видимая связь. RLS не расширяется.
-- 2026-11-04 (feat/moderation): + AND NOT public.is_blocked(p.id) в обе стороны.
-- 2026-11-14 (№8): дружба-предикат ужесточён — pending-заявку видит ТОЛЬКО её
--   адресат (чтобы решить). Инициатор исходящей pending-заявки превью адресата
--   НЕ получает до принятия. accepted — в обе стороны, как раньше.
-- Гранты: REVOKE PUBLIC/anon, GRANT authenticated.
-- 2026-11-20 (first_name_strangers_v2): незнакомым — только первое слово display_name;
--   полное имя — себе и принятым друзьям.
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

REVOKE ALL ON FUNCTION public.get_user_previews(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_user_previews(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_user_previews(uuid[]) TO authenticated;
