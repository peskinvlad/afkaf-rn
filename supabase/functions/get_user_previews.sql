-- Снимок от 2026-09-13. RPC для превью пользователей (имя + одна собака) в
-- списке друзей/заявок и в «рядом». SECURITY DEFINER ОБЯЗАТЕЛЕН: profiles/dogs
-- owner-only под RLS, иначе имена и клички приходят null. Строки отдаются ТОЛЬКО
-- для пользователей, с кем у auth.uid() есть строка в friendships (любой статус)
-- ИЛИ у кого есть active_walk, видимый auth.uid() (та же логика, что RLS
-- active_walks_select). RLS на таблицах НЕ расширяется.
-- Гранты: REVOKE PUBLIC/anon, GRANT authenticated.
CREATE OR REPLACE FUNCTION public.get_user_previews(ids uuid[])
 RETURNS TABLE(id uuid, display_name text, dog_name text, dog_avatar text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    p.id,
    p.display_name,
    d.name AS dog_name,
    d.icon AS dog_avatar
  FROM profiles p
  LEFT JOIN LATERAL (
    SELECT dg.name, dg.icon
    FROM dogs dg
    WHERE dg.owner_id = p.id
    ORDER BY dg.created_at ASC
    LIMIT 1
  ) d ON true
  WHERE p.id = ANY(ids)
    AND p.id <> auth.uid()
    AND (
      -- любая строка дружбы между мной и этим пользователем (любой статус)
      EXISTS (
        SELECT 1 FROM friendships f
        WHERE (f.requester_id = auth.uid() AND f.addressee_id = p.id)
           OR (f.addressee_id = auth.uid() AND f.requester_id = p.id)
      )
      -- ИЛИ у пользователя есть active_walk, видимый мне (та же логика, что RLS)
      OR EXISTS (
        SELECT 1 FROM active_walks aw
        WHERE aw.user_id = p.id
          AND aw.updated_at > now() - interval '30 minutes'
          AND (
            aw.visibility = 'everyone'
            OR (
              aw.visibility = 'friends'
              AND EXISTS (
                SELECT 1 FROM friendships f2
                WHERE f2.status = 'accepted'
                  AND (
                    (f2.requester_id = auth.uid() AND f2.addressee_id = aw.user_id)
                    OR (f2.addressee_id = auth.uid() AND f2.requester_id = aw.user_id)
                  )
              )
            )
          )
      )
    );
$function$;

REVOKE ALL ON FUNCTION public.get_user_previews(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_user_previews(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_user_previews(uuid[]) TO authenticated;
