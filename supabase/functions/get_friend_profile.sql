-- Снимок от 2026-11-25 (feat/friend-profile). Страница друга: имя + все его собаки.
-- SECURITY DEFINER: profiles/dogs под RLS owner-only. Гранты: REVOKE PUBLIC/anon, GRANT authenticated.
-- Кому отдаёт: ТОЛЬКО принятому другу (friendships.status = 'accepted' в любую
-- сторону) и только если нет блокировки ни в одну сторону. Всем остальным — NULL.
-- Что НЕ отдаёт: точную дату рождения (обрезана до месяца — хватает для возраста),
-- вес, owner_name, любые координаты/прогулки.
CREATE OR REPLACE FUNCTION public.get_friend_profile(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object(
    'id', p.id,
    'display_name', p.display_name,
    'dogs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id,
        'name', d.name,
        'breed', d.breed,
        'icon', d.icon,
        'photo_url', d.photo_url,
        'gender', d.gender,
        'neutered', d.neutered,
        'sociability', d.sociability,
        'birth_date', to_char(d.birth_date, 'YYYY-MM-01'),
        'birth_date_approx', d.birth_date_approx,
        'age', d.age
      ) order by d.created_at asc)
      from dogs d where d.owner_id = p.id
    ), '[]'::jsonb)
  )
  from profiles p
  where p.id = p_user_id
    and auth.uid() is not null
    and p.id <> auth.uid()
    and not public.is_blocked(p.id)
    and exists (
      select 1 from friendships f
      where f.status = 'accepted'
        and ((f.requester_id = auth.uid() and f.addressee_id = p.id)
          or (f.addressee_id = auth.uid() and f.requester_id = p.id))
    );
$function$;

REVOKE ALL ON FUNCTION public.get_friend_profile(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_friend_profile(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_friend_profile(uuid) TO authenticated;

