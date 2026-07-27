-- ============================================================
-- get_hidden_walks_count — now radius-aware
-- (run once in Supabase SQL Editor — replaces the zero-arg version)
--
-- Takes the caller's position and returns only the COUNT of fresh walks
-- within 2km that are hidden from them by visibility (friends-only from a
-- non-friend). Distance is computed with the same haversine formula used
-- client-side (src/lib/geo.ts, R=6371km) — entirely inside this SECURITY
-- DEFINER function, so no coordinates of the hidden walkers ever leave
-- the database.
--
-- 2km must stay in sync with RADIUS_KM in src/hooks/useNearbyDogs.ts.
-- ============================================================

DROP FUNCTION IF EXISTS get_hidden_walks_count();

CREATE OR REPLACE FUNCTION get_hidden_walks_count(user_lat double precision, user_lng double precision)
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
    AND (
      6371 * 2 * asin(sqrt(
        power(sin(radians(aw.lat - user_lat) / 2), 2) +
        cos(radians(user_lat)) * cos(radians(aw.lat)) *
        power(sin(radians(aw.lng - user_lng) / 2), 2)
      ))
    ) <= 2
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

GRANT EXECUTE ON FUNCTION get_hidden_walks_count(double precision, double precision) TO authenticated;
