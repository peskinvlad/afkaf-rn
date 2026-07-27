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
