-- Снимок RLS от 15.07.2026 (pg_policies). Идемпотентно.
ALTER TABLE public.active_walks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS active_walks_select ON public.active_walks;
CREATE POLICY active_walks_select ON public.active_walks
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      updated_at > now() - interval '30 minutes'
      AND (
        visibility = 'everyone'
        OR (
          visibility = 'friends'
          AND EXISTS (
            SELECT 1 FROM friendships f
            WHERE f.status = 'accepted'
              AND (
                (f.requester_id = auth.uid() AND f.addressee_id = active_walks.user_id)
                OR (f.addressee_id = auth.uid() AND f.requester_id = active_walks.user_id)
              )
          )
        )
      )
    )
  );

DROP POLICY IF EXISTS active_walks_insert ON public.active_walks;
CREATE POLICY active_walks_insert ON public.active_walks
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS active_walks_update ON public.active_walks;
CREATE POLICY active_walks_update ON public.active_walks
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS active_walks_delete ON public.active_walks;
CREATE POLICY active_walks_delete ON public.active_walks
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
