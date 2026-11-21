-- Снимок RLS от 16.11.2026 (markers privacy ШАГ 3, applied 2026-11-16).
-- Прямой доступ anon закрыт: карта читается через get_map_markers (SECURITY
-- DEFINER, shadow-фильтр внутри). authenticated видит прямым SELECT ТОЛЬКО свои
-- строки; чужие метки для карты отдаёт get_map_markers.
-- UPDATE-политики нет by design (метки не редактируются).
ALTER TABLE public.markers ENABLE ROW LEVEL SECURITY;

-- anon: ни политики SELECT, ни табличных грантов (сняты в ШАГЕ 3).
REVOKE ALL ON public.markers FROM anon;

DROP POLICY IF EXISTS markers_select_anon ON public.markers;

DROP POLICY IF EXISTS markers_select_auth ON public.markers;
CREATE POLICY markers_select_auth ON public.markers
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "markers: auth insert" ON public.markers;
CREATE POLICY "markers: auth insert" ON public.markers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "markers: owner delete" ON public.markers;
CREATE POLICY "markers: owner delete" ON public.markers
  FOR DELETE USING (auth.uid() = user_id);
