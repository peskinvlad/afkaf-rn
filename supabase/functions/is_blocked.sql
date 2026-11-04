-- Снимок от 2026-11-04 (feat/moderation). Проверка взаимной блокировки.
-- SECURITY DEFINER ОБЯЗАТЕЛЕН: обычный юзер по RLS blocks видит только свою сторону
-- (blocker_id = auth.uid()), а нам нужна блокировка в ЛЮБУЮ сторону между auth.uid()
-- и p_other. Для anon (auth.uid() IS NULL) всегда false.
-- Используется в: policies/active_walks.sql, policies/friendships.sql,
-- functions/get_nearby_walks.sql, get_user_previews.sql, get_park_presence.sql.
-- markers НАМЕРЕННО не использует is_blocked (метки анонимны, скрытие меток
-- опасности при блоке ухудшило бы безопасность — см. CLAUDE.md, раздел «Карта»).
-- Гранты: REVOKE PUBLIC/anon, GRANT authenticated.
CREATE OR REPLACE FUNCTION public.is_blocked(p_other uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM blocks b
    WHERE (b.blocker_id = auth.uid() AND b.blocked_id = p_other)
       OR (b.blocker_id = p_other   AND b.blocked_id = auth.uid())
  );
$function$;

REVOKE ALL ON FUNCTION public.is_blocked(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_blocked(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_blocked(uuid) TO authenticated;
