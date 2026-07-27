-- Снимок RLS от 15.07.2026. votes_select USING(true) раскрывает user_id
-- голосовавших — известный НИЗКИЙ риск, в бэклоге.
ALTER TABLE public.marker_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS votes_select ON public.marker_votes;
CREATE POLICY votes_select ON public.marker_votes
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS votes_insert ON public.marker_votes;
CREATE POLICY votes_insert ON public.marker_votes
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND auth.uid() <> (SELECT markers.user_id FROM markers WHERE markers.id = marker_votes.marker_id)
  );

DROP POLICY IF EXISTS votes_update ON public.marker_votes;
CREATE POLICY votes_update ON public.marker_votes
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND auth.uid() <> (SELECT markers.user_id FROM markers WHERE markers.id = marker_votes.marker_id)
  );

DROP POLICY IF EXISTS votes_delete ON public.marker_votes;
CREATE POLICY votes_delete ON public.marker_votes
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
