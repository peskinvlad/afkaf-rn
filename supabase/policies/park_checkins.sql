-- Снимок RLS от 2026-09-29 (feat/park-checkin). Идемпотентно.
-- Клиент видит только свои строки. Write-политик НЕТ by design: INSERT/UPDATE идут
-- только через SECURITY DEFINER RPC park_checkin / park_checkout (проверяют тип
-- метки, свежую прогулку и расстояние). Чужие чек-ины — только через
-- get_park_presence (имена по правилам видимости, k-анонимность счётчика).
ALTER TABLE public.park_checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS park_checkins_select_own ON public.park_checkins;
CREATE POLICY park_checkins_select_own ON public.park_checkins
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Гранты на таблицу. У authenticated после этого остаются SELECT и стандартные
-- для Supabase REFERENCES/TRIGGER; у anon — ничего.
REVOKE ALL ON public.park_checkins FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.park_checkins FROM authenticated;
GRANT SELECT ON public.park_checkins TO authenticated;
