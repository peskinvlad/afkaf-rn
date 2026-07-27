-- ============================================================
-- active_walks — distance snapshot + fix self-visibility
-- (run once in Supabase SQL Editor — active_walks already exists)
-- ============================================================

ALTER TABLE active_walks
  ADD COLUMN IF NOT EXISTS distance_km double precision NOT NULL DEFAULT 0;

-- ------------------------------------------------------------
-- Bug found while building this: the current active_walks_select policy
-- ANDs the 30-minute freshness check onto EVERY row, including the
-- caller's own (user_id = auth.uid()). That means once your own walk
-- snapshot goes stale past 30 minutes, RLS hides it from you too — the
-- exact case the "forgotten walk" recovery card needs to catch (phone
-- backgrounded overnight, etc). Fix: your own row is always visible to
-- you regardless of age; the freshness+visibility gate still applies to
-- everyone else's rows exactly as before.
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "active_walks_select" ON active_walks;

CREATE POLICY "active_walks_select" ON active_walks
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
