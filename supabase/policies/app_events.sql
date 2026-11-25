-- Снимок RLS от 2026-11-23 (feat/app-events). Идемпотентно.
-- app_events полностью закрыт для клиента: RLS включён, политик НЕТ by design.
-- Запись — только через SECURITY DEFINER RPC log_event (functions/log_event.sql);
-- чтение — куратор (Dashboard / supabase/queries/funnel.sql).
ALTER TABLE public.app_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_events FROM anon;
REVOKE ALL ON public.app_events FROM authenticated;
REVOKE ALL ON public.app_events FROM public;
