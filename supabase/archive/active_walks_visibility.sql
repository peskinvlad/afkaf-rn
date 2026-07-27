-- ============================================================
-- active_walks — visibility column + RLS hardening
-- (run once in Supabase SQL Editor — active_walks already exists,
--  this migrates it in place)
-- ============================================================

ALTER TABLE active_walks
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'everyone';

-- 'nobody' never reaches the table (app just skips the insert), so the
-- column only needs to distinguish 'everyone' from 'friends'.
ALTER TABLE active_walks
  DROP CONSTRAINT IF EXISTS active_walks_visibility_check;

ALTER TABLE active_walks
  ADD CONSTRAINT active_walks_visibility_check CHECK (visibility IN ('everyone', 'friends'));

-- Replace the old "anyone authenticated sees every fresh walk" policy with
-- a visibility-aware one: always see your own row, 'everyone' rows, and
-- 'friends' rows only if you're an accepted friend of that walker.
DROP POLICY IF EXISTS "active_walks_select" ON active_walks;

CREATE POLICY "active_walks_select" ON active_walks
  FOR SELECT TO authenticated
  USING (
    updated_at > now() - interval '30 minutes'
    AND (
      user_id = auth.uid()
      OR visibility = 'everyone'
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
  );

-- ============================================================
-- get_hidden_walks_count()
-- Returns just the count of fresh walks NOT visible to the caller under
-- the policy above (friends-only walks from non-friends) — no coordinates,
-- no user_id. SECURITY DEFINER bypasses RLS on active_walks AND friendships
-- so it can evaluate every walker's visibility, not just the ones already
-- visible to auth.uid() through the normal RLS-filtered view.
-- ============================================================

CREATE OR REPLACE FUNCTION get_hidden_walks_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer
  FROM active_walks aw
  WHERE aw.updated_at > now() - interval '30 minutes'
    AND aw.user_id <> auth.uid()
    AND NOT (
      aw.visibility = 'everyone'
      OR (
        aw.visibility = 'friends'
        AND EXISTS (
          SELECT 1 FROM friendships f
          WHERE f.status = 'accepted'
          AND (
            (f.requester_id = auth.uid() AND f.addressee_id = aw.user_id)
            OR (f.addressee_id = auth.uid() AND f.requester_id = aw.user_id)
          )
        )
      )
    );
$$;

GRANT EXECUTE ON FUNCTION get_hidden_walks_count() TO authenticated;
