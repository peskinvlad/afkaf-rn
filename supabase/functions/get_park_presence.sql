-- Снимок от 2026-09-29 (feat/park-checkin). «Сейчас здесь» для карточки площадки.
-- Обновлено 2026-10-02: порог свежести active_walks 10 → 30 мин (фоновый пинг при
-- погашенном экране реже, чем раз в 10 мин; присутствие держим дольше).
-- SECURITY DEFINER: park_checkins под RLS отдаёт клиенту только свои строки.
--
-- Присутствует = открытый непросроченный чек-ин И свежая active_walks (≤30 мин)
-- с visibility <> 'nobody'. Упавшие/брошенные прогулки выпадают сами (без cron);
-- «никто» и домашняя зона не попадают даже в счётчик (у них нет строки active_walks).
--
-- С именем (named) видны:
--   • я сам;
--   • ручное «Я здесь» (manual) — согласие быть видимым по имени для всех;
--   • visibility='everyone' — всем;
--   • visibility='friends' — только принятым друзьям.
-- Остальные — анонимы, только в счётчике.
--
-- k-анонимность (k=2): если анонимов < 2, наружу anon = 0 и total = named_count.
-- Т.е. total − named ∈ {0} ∪ [2..∞) — одиночку по разнице не вычислить.
-- Сырое число анонимов наружу не уходит.
--
-- Собака — первая по created_at, как в get_user_previews.
--
-- Ответ: { total, anon, named: [{user_id, display_name, dog_name, dog_avatar,
--          is_friend, is_me, manual, since}], me: {checked_in, manual} }
--
-- Рейт-лимит 20/мин (bucket 'get_park_presence'): карточка опрашивает раз в 30 с,
-- плюс открытия/закрытия. При превышении — PT429 (клиент оставляет прошлые данные).
-- Гранты: REVOKE PUBLIC/anon, GRANT authenticated.
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

REVOKE ALL ON FUNCTION public.get_park_presence(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_park_presence(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_park_presence(uuid) TO authenticated;
