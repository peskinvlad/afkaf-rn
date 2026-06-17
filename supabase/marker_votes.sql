-- ============================================================
-- marker_votes  (run once in Supabase SQL Editor)
-- ============================================================

CREATE TABLE IF NOT EXISTS marker_votes (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  marker_id   uuid        NOT NULL REFERENCES markers(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote        text        NOT NULL CHECK (vote IN ('still_there', 'gone')),
  created_at  timestamptz DEFAULT now() NOT NULL,
  UNIQUE (marker_id, user_id)
);

ALTER TABLE marker_votes ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read votes
CREATE POLICY "votes_select" ON marker_votes
  FOR SELECT TO authenticated USING (true);

-- Authenticated users can insert their own vote, but NOT on their own markers
CREATE POLICY "votes_insert" ON marker_votes
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND auth.uid() != (SELECT user_id FROM markers WHERE id = marker_id)
  );

-- Users can change their own vote (UPSERT path) — same anti-self-vote guard as insert
CREATE POLICY "votes_update" ON marker_votes
  FOR UPDATE TO authenticated
  USING  (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND auth.uid() != (SELECT user_id FROM markers WHERE id = marker_id)
  );

-- Users can retract their own vote
CREATE POLICY "votes_delete" ON marker_votes
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
