-- Снимок RLS от 15.07.2026. markers_select_auth требует
-- GRANT EXECUTE ON FUNCTION get_shadow_status TO authenticated.
-- UPDATE-политики нет by design (метки не редактируются).
ALTER TABLE public.markers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS markers_select_anon ON public.markers;
CREATE POLICY markers_select_anon ON public.markers
  FOR SELECT TO anon
  USING (true);

DROP POLICY IF EXISTS markers_select_auth ON public.markers;
CREATE POLICY markers_select_auth ON public.markers
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR NOT (SELECT is_shadow_banned FROM get_shadow_status(markers.user_id))
  );

DROP POLICY IF EXISTS "markers: auth insert" ON public.markers;
CREATE POLICY "markers: auth insert" ON public.markers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "markers: owner delete" ON public.markers;
CREATE POLICY "markers: owner delete" ON public.markers
  FOR DELETE USING (auth.uid() = user_id);
