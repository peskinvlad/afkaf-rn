-- Снимок RLS от 2026-11-14 (feat/app-ping). Идемпотентно.
-- app_pings полностью закрыт для клиента: RLS включён, политик НЕТ by design —
-- при включённом RLS и отсутствии политик обычные роли не читают и не пишут.
-- Запись идёт исключительно через SECURITY DEFINER RPC log_app_open
-- (functions/log_app_open.sql), чтения клиентом нет вовсе (метрики смотрит
-- куратор в Dashboard / через supabase/queries/retention.sql).
ALTER TABLE public.app_pings ENABLE ROW LEVEL SECURITY;

-- Политик нет намеренно. Плюс явный REVOKE прав на таблицу у всех клиентских
-- ролей: ни select, ни insert/update/delete у anon и authenticated.
REVOKE ALL ON public.app_pings FROM anon;
REVOKE ALL ON public.app_pings FROM authenticated;
REVOKE ALL ON public.app_pings FROM public;
