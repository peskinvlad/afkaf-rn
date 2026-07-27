-- Снимок RLS от 15.07.2026. Только чтение: write-политик нет by design
-- (данные OSM/artza грузятся вручную).
ALTER TABLE public.water_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "water_sources: public read" ON public.water_sources;
CREATE POLICY "water_sources: public read" ON public.water_sources
  FOR SELECT USING (true);
