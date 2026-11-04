-- Снимок RLS от 2026-11-04 (feat/moderation). Идемпотентно.
-- Жалобы: вставка только от своего имени, чтение только своих строк. UPDATE/DELETE
-- юзеру запрещены (нет политик + отозваны гранты). Триаж — через service_role в
-- Dashboard (supabase/queries/open-reports.sql), RLS его не ограничивает.
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reports_select_own ON public.reports;
CREATE POLICY reports_select_own ON public.reports
  FOR SELECT TO authenticated
  USING (reporter_id = auth.uid());

DROP POLICY IF EXISTS reports_insert ON public.reports;
CREATE POLICY reports_insert ON public.reports
  FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());

-- Гранты: authenticated = SELECT + INSERT (без UPDATE/DELETE/TRUNCATE); anon — ничего.
REVOKE ALL ON public.reports FROM anon;
REVOKE UPDATE, DELETE, TRUNCATE ON public.reports FROM authenticated;
GRANT SELECT, INSERT ON public.reports TO authenticated;
