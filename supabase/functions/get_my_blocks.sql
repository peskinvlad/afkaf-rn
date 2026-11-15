-- Снимок от 2026-11-04 (feat/moderation); обновлён 2026-11-14 (markers_privacy_step1).
-- Список СВОИХ блокировок для экрана «Заблокированные» + разблокировки.
-- SECURITY DEFINER. Возвращает строки ТОЛЬКО там, где blocker_id = auth.uid().
-- 2026-11-14 (№2): имя/иконка берутся из СНИМКА blocks.blocked_name/blocked_avatar
--   (его пишет block_user), без live-join к profiles/dogs — чтобы не раскрывать имя
--   того, кого я не мог видеть. NULL → клиент показывает «Пользователь». dog_name
--   больше не отдаём (снимок хранит только имя владельца и иконку) — колонка NULL
--   для совместимости сигнатуры.
-- Гранты: REVOKE PUBLIC/anon, GRANT authenticated.
CREATE OR REPLACE FUNCTION public.get_my_blocks()
 RETURNS TABLE(user_id uuid, display_name text, dog_name text, dog_avatar text, created_at timestamptz)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  select b.blocked_id, b.blocked_name, null::text as dog_name, b.blocked_avatar, b.created_at
  from blocks b
  where b.blocker_id = auth.uid()
  order by b.created_at desc;
$function$;

REVOKE ALL ON FUNCTION public.get_my_blocks() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_blocks() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_blocks() TO authenticated;
