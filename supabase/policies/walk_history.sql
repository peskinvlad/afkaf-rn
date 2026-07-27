-- Снимок RLS от 15.07.2026. Append-only: UPDATE/DELETE-политик нет by design.
ALTER TABLE public.walk_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS walk_history_select ON public.walk_history;
CREATE POLICY walk_history_select ON public.walk_history
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS walk_history_insert ON public.walk_history;
CREATE POLICY walk_history_insert ON public.walk_history
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
