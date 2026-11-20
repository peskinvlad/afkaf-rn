-- Снимок от 2026-11-20 (feat/terms-consent). Сверено с живой БД через
-- pg_get_functiondef / information_schema.routine_privileges (read-only).
-- Единственный путь записи согласия с условиями (Apple 1.2): ставит
-- profiles.terms_accepted_at = now() (время сервера, не телефона) и
-- profiles.terms_version = p_version для СВОЕЙ строки. Только UPDATE — вставки
-- нет (profiles.display_name NOT NULL; профиль создаёт handle_new_user).
-- PT401 — не авторизован, PT400 — версия NULL или длиннее 20 символов,
-- PT404 — строки профиля нет. Возвращает записанное время.
-- ВНИМАНИЕ: пустая строка '' сейчас НЕ отклоняется (проверяются только NULL и
-- длина > 20). Клиент всегда шлёт TERMS_VERSION, так что на практике не
-- срабатывает; при желании ужесточить — см. отчёт feat/terms-consent.
-- Гранты: EXECUTE только authenticated (+ postgres/service_role); PUBLIC/anon — нет.
CREATE OR REPLACE FUNCTION public.accept_terms(p_version text)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_now timestamptz := now();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = 'PT401'; END IF;
  IF p_version IS NULL OR length(p_version) > 20 THEN RAISE EXCEPTION 'bad version' USING ERRCODE = 'PT400'; END IF;
  UPDATE public.profiles SET terms_accepted_at = v_now, terms_version = p_version WHERE id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'profile not found' USING ERRCODE = 'PT404'; END IF;
  RETURN v_now;
END $function$;

REVOKE ALL ON FUNCTION public.accept_terms(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_terms(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.accept_terms(text) TO authenticated;
