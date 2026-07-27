-- ============================================================
-- walk_history + user_badges  (run once in Supabase SQL Editor)
--
-- active_walks is ephemeral (deleted when a walk ends) — it's presence,
-- not history. walk_history is the permanent append-only log a valid
-- finished walk writes to, used to compute total km / streaks for badges.
-- Marker badges don't need a new table: get_trust_status() already
-- returns confirmed_count for the caller (src/hooks/useApp.tsx).
-- ============================================================

CREATE TABLE IF NOT EXISTS walk_history (
  id           uuid              DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid              NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  distance_km  double precision  NOT NULL,
  duration_min integer           NOT NULL,
  started_at   timestamptz       NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_walk_history_user_id ON walk_history (user_id);
CREATE INDEX IF NOT EXISTS idx_walk_history_user_started ON walk_history (user_id, started_at);

ALTER TABLE walk_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "walk_history_select" ON walk_history
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "walk_history_insert" ON walk_history
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- No UPDATE/DELETE policy on purpose — it's an append-only log. With RLS
-- enabled and no matching policy, both are denied by default.

-- ============================================================

CREATE TABLE IF NOT EXISTS user_badges (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id   text        NOT NULL,
  earned_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON user_badges (user_id);

ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_badges_select" ON user_badges
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "user_badges_insert" ON user_badges
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- No UPDATE/DELETE policy on purpose — a badge, once earned, is forever.
