-- 2026-11-20  feat/terms-consent: явное согласие с условиями (Apple Guideline 1.2).
-- applied manually 2026-11-20 (владелец, вне репозитория). Этот файл приведён 1:1
-- к живой БД (сверено pg_get_functiondef / information_schema.columns /
-- routine_privileges, read-only через Supabase MCP).
--
-- profiles.terms_accepted_at / terms_version — когда и какую версию условий
-- человек принял. NULL = ещё не принимал (все аккаунты до 1.0.0).
-- Запись — только через RPC accept_terms (время ставит сервер). Читает клиент
-- обычным SELECT своей строки (политика «profiles: owner read»).
--
-- Снапшоты этого изменения: supabase/tables.sql (DDL profiles),
-- supabase/functions/accept_terms.sql.
BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN terms_accepted_at timestamptz NULL,
  ADD COLUMN terms_version     text        NULL;

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

COMMIT;
