-- ============================================================
-- friendships  (run once in Supabase SQL Editor)
-- ============================================================

CREATE TABLE IF NOT EXISTS friendships (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status        text        NOT NULL CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  CHECK (requester_id <> addressee_id),
  UNIQUE (requester_id, addressee_id)
);

CREATE INDEX IF NOT EXISTS idx_friendships_requester_id ON friendships (requester_id);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee_id ON friendships (addressee_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION friendships_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_friendships_set_updated_at ON friendships;
CREATE TRIGGER trg_friendships_set_updated_at
  BEFORE UPDATE ON friendships
  FOR EACH ROW
  EXECUTE FUNCTION friendships_set_updated_at();

ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

-- User sees rows where they are requester or addressee
CREATE POLICY "friendships_select" ON friendships
  FOR SELECT TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- User can only send a request as themselves, and only if the reverse pair
-- (other user -> me) doesn't already exist
CREATE POLICY "friendships_insert" ON friendships
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = requester_id
    AND NOT EXISTS (
      SELECT 1 FROM friendships f
      WHERE f.requester_id = friendships.addressee_id
        AND f.addressee_id = friendships.requester_id
    )
  );

-- Only the addressee can update status (accept/decline)
CREATE POLICY "friendships_update" ON friendships
  FOR UPDATE TO authenticated
  USING (auth.uid() = addressee_id)
  WITH CHECK (auth.uid() = addressee_id);

-- Either side can delete (remove friend / withdraw request)
CREATE POLICY "friendships_delete" ON friendships
  FOR DELETE TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- ============================================================
-- get_friendship_status(other_user_id uuid)
-- Returns: 'friends' | 'pending_sent' | 'pending_received' | 'none'
-- ============================================================
CREATE OR REPLACE FUNCTION get_friendship_status(other_user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_status    text;
  v_requester uuid;
BEGIN
  SELECT status, requester_id
  INTO v_status, v_requester
  FROM friendships
  WHERE (requester_id = auth.uid() AND addressee_id = other_user_id)
     OR (requester_id = other_user_id AND addressee_id = auth.uid())
  LIMIT 1;

  IF v_status IS NULL THEN
    RETURN 'none';
  ELSIF v_status = 'accepted' THEN
    RETURN 'friends';
  ELSIF v_status = 'pending' AND v_requester = auth.uid() THEN
    RETURN 'pending_sent';
  ELSIF v_status = 'pending' AND v_requester = other_user_id THEN
    RETURN 'pending_received';
  ELSE
    RETURN 'none';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION get_friendship_status(uuid) TO authenticated;
