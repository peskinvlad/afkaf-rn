-- Снимок RLS от 15.07.2026. Политика "public read for active checkin owners"
-- удалена 15.07.2026 вместе с таблицей checkins (наследие PWA).
ALTER TABLE public.dogs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dogs: owner read" ON public.dogs;
CREATE POLICY "dogs: owner read" ON public.dogs
  FOR SELECT USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "dogs: owner insert" ON public.dogs;
CREATE POLICY "dogs: owner insert" ON public.dogs
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "dogs: owner update" ON public.dogs;
CREATE POLICY "dogs: owner update" ON public.dogs
  FOR UPDATE USING (auth.uid() = owner_id);
-- WITH CHECK не указан: Postgres применяет USING и к новой строке.

DROP POLICY IF EXISTS "dogs: owner delete" ON public.dogs;
CREATE POLICY "dogs: owner delete" ON public.dogs
  FOR DELETE USING (auth.uid() = owner_id);
