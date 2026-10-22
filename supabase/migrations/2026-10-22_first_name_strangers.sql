-- 2026-10-22  Незнакомые видят только первое имя (fix/first-name-strangers).
-- Применять в Supabase SQL Editor целиком (одна транзакция).
-- Откат: supabase/migrations/2026-10-22_first_name_strangers_rollback.sql.
-- Проверка: supabase/migrations/2026-10-22_first_name_strangers_checks.sql.
--
-- Правило: полное profiles.display_name отдаётся только принятым друзьям
-- (friendships.status = 'accepted') и самому себе. Всем остальным — первое
-- слово: substring(display_name FROM '\S+') = первая группа непробельных
-- символов (ведущие пробелы пропускаются). NULL / пустое / из одних пробелов —
-- COALESCE возвращает исходное значение, т.е. поведение как раньше.
--
-- Затронуто (набор выходных полей НЕ меняется → CREATE OR REPLACE, без DROP):
--   • get_user_previews(uuid[]) — список друзей/заявок, «гуляют рядом», облачко;
--   • get_park_presence(uuid)   — «Сейчас здесь» на площадке.
-- SECURITY DEFINER, search_path и гранты — как были; гранты повторены явно.
-- Снапшоты обновлены тем же коммитом: supabase/functions/get_user_previews.sql,
-- supabase/functions/get_park_presence.sql.
BEGIN;

CREATE OR REPLACE FUNCTION public.get_user_previews(ids uuid[])
 RETURNS TABLE(id uuid, display_name text, dog_name text, dog_avatar text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    p.id,
    -- Полное имя — только принятым друзьям; остальным первое слово (первая
    -- непробельная группа). Пустое/из одних пробелов имя — как было.
    CASE
      WHEN EXISTS (
        SELECT 1 FROM friendships fa
        WHERE fa.status = 'accepted'
          AND ((fa.requester_id = auth.uid() AND fa.addressee_id = p.id)
            OR (fa.addressee_id = auth.uid() AND fa.requester_id = p.id))
      ) THEN p.display_name
      ELSE COALESCE(substring(p.display_name FROM '\S+'), p.display_name)
    END AS display_name,
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
    AND (
      -- любая строка дружбы между мной и этим пользователем (любой статус)
      EXISTS (
        SELECT 1 FROM friendships f
        WHERE (f.requester_id = auth.uid() AND f.addressee_id = p.id)
           OR (f.addressee_id = auth.uid() AND f.requester_id = p.id)
      )
      -- ИЛИ у пользователя есть active_walk, видимый мне (та же логика, что RLS)
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
          -- Полное имя — себе и принятым друзьям; остальным первое слово
          -- (первая непробельная группа). Пустое имя — как было.
          'display_name', CASE
                            WHEN cl.is_me OR cl.is_friend THEN pr.display_name
                            ELSE COALESCE(substring(pr.display_name FROM '\S+'), pr.display_name)
                          END,
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

  -- k-анонимность (k=2): одиночный аноним не раскрывается даже счётчиком.
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

REVOKE ALL ON FUNCTION public.get_user_previews(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_user_previews(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_user_previews(uuid[]) TO authenticated;

REVOKE ALL ON FUNCTION public.get_park_presence(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_park_presence(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_park_presence(uuid) TO authenticated;

COMMIT;
