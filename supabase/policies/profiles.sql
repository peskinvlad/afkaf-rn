-- Снимок RLS от 15.07.2026. SELECT только своей строки:
-- чужие профили через прямой SELECT не видны (privacy by default).
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles: owner read" ON public.profiles;
CREATE POLICY "profiles: owner read" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles: owner insert" ON public.profiles;
CREATE POLICY "profiles: owner insert" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles: owner update" ON public.profiles;
CREATE POLICY "profiles: owner update" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Гранты на UPDATE (25.11.2026, миграция profiles_update_columns_lockdown).
-- Табличный UPDATE у клиента снят: напрямую можно менять только имя и язык
-- (id оставлен ради upsert старых клиентов; сменить его на чужой не даёт
-- политика «owner update»). terms_accepted_at / terms_version пишет только RPC
-- accept_terms (SECURITY DEFINER), created_at клиент не меняет. Новая колонка в
-- profiles по умолчанию НЕ редактируется клиентом — нужен явный GRANT UPDATE (col).
REVOKE UPDATE ON TABLE public.profiles FROM anon, authenticated;
GRANT UPDATE (id, display_name, language) ON TABLE public.profiles TO authenticated;
