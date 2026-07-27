-- ============================================================
-- active_walks  (run once in Supabase SQL Editor)
--
-- One row per user currently on a walk. Client upserts lat/lng/updated_at
-- every ~60s while walking, deletes the row on stop. Rows older than 30min
-- are treated as stale and filtered out at the RLS level (SELECT policy),
-- so a crashed client without a clean stop can't leave a ghost walker.
-- ============================================================

CREATE TABLE IF NOT EXISTS active_walks (
  id          uuid              DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid              NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dog_id      uuid              REFERENCES dogs(id) ON DELETE SET NULL,
  lat         double precision  NOT NULL,
  lng         double precision  NOT NULL,
  started_at  timestamptz       NOT NULL DEFAULT now(),
  updated_at  timestamptz       NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_active_walks_updated_at ON active_walks (updated_at);

ALTER TABLE active_walks ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can see walks, but only if updated in the last 30 min
CREATE POLICY "active_walks_select" ON active_walks
  FOR SELECT TO authenticated
  USING (updated_at > now() - interval '30 minutes');

-- Users can only start their own walk
CREATE POLICY "active_walks_insert" ON active_walks
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can only update their own walk (position pings)
CREATE POLICY "active_walks_update" ON active_walks
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can only stop/delete their own walk
CREATE POLICY "active_walks_delete" ON active_walks
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
