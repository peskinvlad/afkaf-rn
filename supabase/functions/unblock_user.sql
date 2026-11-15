-- Снимок от 2026-11-04 (feat/moderation). Снятие блокировки — единственный путь
-- DELETE из blocks (таблица без DELETE-политики). SECURITY DEFINER. Дружба назад
-- НЕ возвращается (её удалил block_user) — это ожидаемо, надо добавиться заново.
-- Гранты: REVOKE PUBLIC/anon, GRANT authenticated.
CREATE OR REPLACE FUNCTION public.unblock_user(p_user_id uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  DELETE FROM blocks WHERE blocker_id = auth.uid() AND blocked_id = p_user_id;
$function$;

REVOKE ALL ON FUNCTION public.unblock_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.unblock_user(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.unblock_user(uuid) TO authenticated;
