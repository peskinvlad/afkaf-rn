-- 2026-11-04  feat/moderation: жалобы (reports) + блокировка (blocks) — UGC-требование Google Play.
-- Применять в Supabase SQL Editor (роль postgres). Применено на живой БД 2026-11-04
-- через Supabase MCP. Снапшоты обновлены тем же коммитом:
--   blocks / reports (DDL + индекс)      → supabase/tables.sql
--   RLS blocks / reports                 → supabase/policies/blocks.sql, reports.sql
--   is_blocked / block_user / unblock_user / get_my_blocks → supabase/functions/*.sql
--   get_nearby_walks / get_user_previews / get_park_presence (+ is_blocked) → supabase/functions/*.sql
--   friendships_insert (+ is_blocked)    → supabase/policies/friendships.sql
--   active_walks (+ is_blocked)          → supabase/policies/active_walks.sql
--     (сужение ветки 'everyone' — отдельной миграцией 2026-11-04_active_walks_tighten.sql)
-- markers НЕ трогаются (решение: метки анонимны; скрытие меток опасности при блоке
--   ухудшает безопасность — см. CLAUDE.md, раздел «Карта (MapView)»).
BEGIN;

-- ---------- blocks (клиент: ТОЛЬКО SELECT своих строк) ----------
CREATE TABLE public.blocks (
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blocks_pkey PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT blocks_not_self CHECK (blocker_id <> blocked_id)
);
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS blocks_select ON public.blocks;
CREATE POLICY blocks_select ON public.blocks
  FOR SELECT TO authenticated USING (blocker_id = auth.uid());

REVOKE ALL ON public.blocks FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.blocks FROM authenticated;
GRANT SELECT ON public.blocks TO authenticated;

-- ---------- reports ----------
CREATE TABLE public.reports (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  reporter_id uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type text        NOT NULL CHECK (target_type IN ('marker','user')),
  target_id   uuid        NOT NULL,
  reason      text        NOT NULL CHECK (reason IN
                ('missing','wrong_location','wrong_type','inappropriate',
                 'spam','harassment','impersonation','dangerous','other')),
  comment     text        CHECK (comment IS NULL OR length(comment) <= 1000),
  status      text        NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewed','dismissed')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reports_pkey PRIMARY KEY (id)
);
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX reports_one_open_per_target
  ON public.reports (reporter_id, target_type, target_id)
  WHERE status = 'open';

DROP POLICY IF EXISTS reports_select_own ON public.reports;
CREATE POLICY reports_select_own ON public.reports
  FOR SELECT TO authenticated USING (reporter_id = auth.uid());

DROP POLICY IF EXISTS reports_insert ON public.reports;
CREATE POLICY reports_insert ON public.reports
  FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid());

REVOKE ALL ON public.reports FROM anon;
REVOKE UPDATE, DELETE, TRUNCATE ON public.reports FROM authenticated;
GRANT SELECT, INSERT ON public.reports TO authenticated;

-- ---------- is_blocked (обе стороны; SECURITY DEFINER) ----------
CREATE OR REPLACE FUNCTION public.is_blocked(p_other uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM blocks b
    WHERE (b.blocker_id = auth.uid() AND b.blocked_id = p_other)
       OR (b.blocker_id = p_other   AND b.blocked_id = auth.uid())
  );
$function$;
REVOKE ALL ON FUNCTION public.is_blocked(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_blocked(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_blocked(uuid) TO authenticated;

-- ---------- block_user / unblock_user ----------
CREATE OR REPLACE FUNCTION public.block_user(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'PT401', MESSAGE = 'not_authenticated';
  END IF;
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION USING ERRCODE = 'PT400', MESSAGE = 'cannot_block_self';
  END IF;

  INSERT INTO blocks (blocker_id, blocked_id)
  VALUES (auth.uid(), p_user_id)
  ON CONFLICT DO NOTHING;

  DELETE FROM friendships
  WHERE (requester_id = auth.uid() AND addressee_id = p_user_id)
     OR (requester_id = p_user_id  AND addressee_id = auth.uid());
END;
$function$;
REVOKE ALL ON FUNCTION public.block_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.block_user(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.block_user(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.unblock_user(p_user_id uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  DELETE FROM blocks WHERE blocker_id = auth.uid() AND blocked_id = p_user_id;
$function$;
REVOKE ALL ON FUNCTION public.unblock_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.unblock_user(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.unblock_user(uuid) TO authenticated;

-- ---------- get_my_blocks ----------
CREATE OR REPLACE FUNCTION public.get_my_blocks()
 RETURNS TABLE(user_id uuid, display_name text, dog_name text, dog_avatar text, created_at timestamptz)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    b.blocked_id,
    p.display_name,
    d.name AS dog_name,
    d.icon AS dog_avatar,
    b.created_at
  FROM blocks b
  LEFT JOIN profiles p ON p.id = b.blocked_id
  LEFT JOIN LATERAL (
    SELECT dg.name, dg.icon
    FROM dogs dg
    WHERE dg.owner_id = b.blocked_id
    ORDER BY dg.created_at ASC
    LIMIT 1
  ) d ON true
  WHERE b.blocker_id = auth.uid()
  ORDER BY b.created_at DESC;
$function$;
REVOKE ALL ON FUNCTION public.get_my_blocks() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_blocks() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_blocks() TO authenticated;

-- ---------- active_walks RLS: + NOT is_blocked (3а; сужение 'everyone' — отд. миграцией) ----------
DROP POLICY IF EXISTS active_walks_select ON public.active_walks;
CREATE POLICY active_walks_select ON public.active_walks
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      updated_at > now() - interval '30 minutes'
      AND NOT public.is_blocked(user_id)
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

-- ---------- get_nearby_walks (+ NOT is_blocked) ----------
CREATE OR REPLACE FUNCTION public.get_nearby_walks(user_lat double precision, user_lng double precision)
 RETURNS TABLE(user_id uuid, lat double precision, lng double precision, updated_at timestamptz, is_friend boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.rpc_rate_limit('get_nearby_walks', 20, interval '1 minute') THEN
    RAISE EXCEPTION
      USING ERRCODE = 'PT429',
            MESSAGE = 'rpc_rate_limit',
            DETAIL  = 'get_nearby_walks called too often',
            HINT    = 'Too many requests, slow down';
  END IF;

  RETURN QUERY
  SELECT c.user_id, c.eff_lat AS lat, c.eff_lng AS lng, c.updated_at, c.is_friend
  FROM (
    SELECT
      aw.user_id,
      aw.updated_at,
      fr.is_friend,
      CASE WHEN fr.is_friend THEN aw.lat ELSE round(aw.lat::numeric, 3)::double precision END AS eff_lat,
      CASE WHEN fr.is_friend THEN aw.lng ELSE round(aw.lng::numeric, 3)::double precision END AS eff_lng
    FROM active_walks aw
    CROSS JOIN LATERAL (
      SELECT EXISTS (
        SELECT 1 FROM friendships f
        WHERE f.status = 'accepted'
          AND ((f.requester_id = auth.uid() AND f.addressee_id = aw.user_id)
            OR (f.addressee_id = auth.uid() AND f.requester_id = aw.user_id))
      ) AS is_friend
    ) fr
    WHERE aw.updated_at > now() - interval '30 minutes'
      AND aw.user_id <> auth.uid()
      AND NOT public.is_blocked(aw.user_id)
      AND (aw.visibility = 'everyone' OR (aw.visibility = 'friends' AND fr.is_friend))
  ) c
  WHERE (
    6371 * 2 * asin(sqrt(
      power(sin(radians(c.eff_lat - user_lat) / 2), 2) +
      cos(radians(user_lat)) * cos(radians(c.eff_lat)) *
      power(sin(radians(c.eff_lng - user_lng) / 2), 2)
    ))
  ) <= 2;
END;
$function$;
REVOKE ALL ON FUNCTION public.get_nearby_walks(double precision, double precision) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_nearby_walks(double precision, double precision) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_nearby_walks(double precision, double precision) TO authenticated;

-- ---------- get_user_previews (+ NOT is_blocked) ----------
CREATE OR REPLACE FUNCTION public.get_user_previews(ids uuid[])
 RETURNS TABLE(id uuid, display_name text, dog_name text, dog_avatar text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    p.id,
    p.display_name,
    d.name AS dog_name,
    d.icon AS dog_avatar
  FROM profiles p
  LEFT JOIN LATERAL (
    SELECT dg.name, dg.icon
    FROM dogs dg
    WHERE dg.owner_id = p.id
    ORDER BY dg.created_at ASC
    LIMIT 1
  ) d ON true
  WHERE p.id = ANY(ids)
    AND p.id <> auth.uid()
    AND NOT public.is_blocked(p.id)
    AND (
      EXISTS (
        SELECT 1 FROM friendships f
        WHERE (f.requester_id = auth.uid() AND f.addressee_id = p.id)
           OR (f.addressee_id = auth.uid() AND f.requester_id = p.id)
      )
      OR EXISTS (
        SELECT 1 FROM active_walks aw
        WHERE aw.user_id = p.id
          AND aw.updated_at > now() - interval '30 minutes'
          AND (
            aw.visibility = 'everyone'
            OR (
              aw.visibility = 'friends'
              AND EXISTS (
                SELECT 1 FROM friendships f2
                WHERE f2.status = 'accepted'
                  AND (
                    (f2.requester_id = auth.uid() AND f2.addressee_id = aw.user_id)
                    OR (f2.addressee_id = auth.uid() AND f2.requester_id = aw.user_id)
                  )
              )
            )
          )
      )
    );
$function$;
REVOKE ALL ON FUNCTION public.get_user_previews(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_user_previews(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_user_previews(uuid[]) TO authenticated;

-- ---------- get_park_presence (+ NOT is_blocked В present CTE, k-анон ПОСЛЕ) ----------
CREATE OR REPLACE FUNCTION public.get_park_presence(p_marker_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid          uuid := auth.uid();
  v_named      jsonb;
  v_named_cnt  integer;
  v_anon       integer;
  v_me         record;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'PT401', MESSAGE = 'not_authenticated';
  END IF;

  IF NOT public.rpc_rate_limit('get_park_presence', 20, interval '1 minute') THEN
    RAISE EXCEPTION
      USING ERRCODE = 'PT429',
            MESSAGE = 'rpc_rate_limit',
            DETAIL  = 'get_park_presence called too often',
            HINT    = 'Too many requests, slow down';
  END IF;

  WITH present AS (
    SELECT
      c.user_id,
      c.started_at,
      c.manual,
      aw.visibility,
      EXISTS (
        SELECT 1 FROM friendships f
        WHERE f.status = 'accepted'
          AND ((f.requester_id = uid AND f.addressee_id = c.user_id)
            OR (f.addressee_id = uid AND f.requester_id = c.user_id))
      ) AS is_friend
    FROM park_checkins c
    JOIN active_walks aw ON aw.user_id = c.user_id
    WHERE c.marker_id = p_marker_id
      AND c.ended_at IS NULL
      AND c.expires_at > now()
      AND aw.updated_at > now() - interval '30 minutes'
      AND aw.visibility <> 'nobody'
      AND NOT public.is_blocked(c.user_id)
  ),
  classified AS (
    SELECT
      p.*,
      (p.user_id = uid) AS is_me,
      (   p.user_id = uid
       OR p.manual
       OR p.visibility = 'everyone'
       OR (p.visibility = 'friends' AND p.is_friend)
      ) AS is_named
    FROM present p
  )
  SELECT
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'user_id',      cl.user_id,
          'display_name', pr.display_name,
          'dog_name',     d.name,
          'dog_avatar',   d.icon,
          'is_friend',    cl.is_friend,
          'is_me',        cl.is_me,
          'manual',       cl.manual,
          'since',        cl.started_at
        )
        ORDER BY cl.is_me DESC, cl.is_friend DESC, cl.started_at ASC
      ) FILTER (WHERE cl.is_named),
      '[]'::jsonb
    ),
    count(*) FILTER (WHERE cl.is_named),
    count(*) FILTER (WHERE NOT cl.is_named)
  INTO v_named, v_named_cnt, v_anon
  FROM classified cl
  LEFT JOIN profiles pr ON pr.id = cl.user_id
  LEFT JOIN LATERAL (
    SELECT dg.name, dg.icon
    FROM dogs dg
    WHERE dg.owner_id = cl.user_id
    ORDER BY dg.created_at ASC
    LIMIT 1
  ) d ON true;

  IF v_anon < 2 THEN
    v_anon := 0;
  END IF;

  SELECT c.manual INTO v_me
  FROM park_checkins c
  WHERE c.user_id = uid
    AND c.marker_id = p_marker_id
    AND c.ended_at IS NULL
    AND c.expires_at > now();

  RETURN jsonb_build_object(
    'total', v_named_cnt + v_anon,
    'anon',  v_anon,
    'named', v_named,
    'me',    jsonb_build_object(
               'checked_in', FOUND,
               'manual',     COALESCE(v_me.manual, false)
             )
  );
END;
$function$;
REVOKE ALL ON FUNCTION public.get_park_presence(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_park_presence(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_park_presence(uuid) TO authenticated;

-- ---------- friendships_insert (+ NOT is_blocked) ----------
DROP POLICY IF EXISTS friendships_insert ON public.friendships;
CREATE POLICY friendships_insert ON public.friendships
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = requester_id
    AND status = 'pending'
    AND NOT public.is_blocked(addressee_id)
    AND NOT EXISTS (
      SELECT 1 FROM friendships f
      WHERE f.requester_id = friendships.addressee_id
        AND f.addressee_id = friendships.requester_id
    )
  );

COMMIT;
