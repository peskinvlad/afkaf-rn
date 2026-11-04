-- Снимок от 2026-11-04 (feat/moderation). Список СВОИХ блокировок с превью (имя +
-- одна собака) для экрана «Заблокированные» + разблокировки. SECURITY DEFINER:
-- profiles/dogs owner-only под RLS, а get_user_previews заблокированных намеренно
-- прячет — поэтому имена для этого экрана отдаёт отдельная функция. Возвращает
-- строки ТОЛЬКО там, где blocker_id = auth.uid(). Собака — первая по created_at,
-- как в get_user_previews/get_park_presence.
-- Гранты: REVOKE PUBLIC/anon, GRANT authenticated.
CREATE OR REPLACE FUNCTION public.get_my_blocks()
 RETURNS TABLE(user_id uuid, display_name text, dog_name text, dog_avatar text, created_at timestamptz)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    b.blocked_id,
    p.display_name,
    d.name AS dog_name,
    d.icon AS dog_avatar,
    b.created_at
  FROM blocks b
  LEFT JOIN profiles p ON p.id = b.blocked_id
  LEFT JOIN LATERAL (
    SELECT dg.name, dg.icon
    FROM dogs dg
    WHERE dg.owner_id = b.blocked_id
    ORDER BY dg.created_at ASC
    LIMIT 1
  ) d ON true
  WHERE b.blocker_id = auth.uid()
  ORDER BY b.created_at DESC;
$function$;

REVOKE ALL ON FUNCTION public.get_my_blocks() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_blocks() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_blocks() TO authenticated;
