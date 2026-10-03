-- Снимок от 2026-09-29 (feat/park-checkin). Чек-ин на собачьей площадке.
-- Обновлено 2026-10-02: порог свежести active_walks 10 → 30 мин (как в
-- get_park_presence; фоновый пинг при погашенном экране реже раза в 10 мин).
-- SECURITY DEFINER: у park_checkins нет write-политик, писать можно только здесь.
--
-- Вызывается клиентом в двух случаях:
--   • авто (p_manual=false) — детектор зоны: ≥5 мин в радиусе 40 м от dog_park;
--   • ручной «Я здесь» (p_manual=true) — согласие быть видимым по имени для всех.
--
-- Проверки:
--   • метка — постоянная dog_park (expires_at IS NULL), иначе PT422 not_a_dog_park;
--   • у вызывающего свежая active_walks (≤30 мин) с visibility <> 'nobody'.
--     Нет строки = «никто» / домашняя зона / не на прогулке → PT409 no_active_walk.
--     Это серверная гарантия правила «чек-ин только во время прогулки»;
--   • последняя позиция active_walks не дальше 150 м от площадки (пинг раз в 60 с,
--     запас на устаревшую точку) → иначе PT422 too_far. Защита от «Я здесь» без GPS.
--
-- Тот же marker → manual = manual OR p_manual (срок НЕ продлевается).
-- Другой открытый → закрывается с 'switched'. Просроченный → 'expired' (задним
-- числом, ended_at = expires_at). FOR UPDATE на active_walks сериализует
-- параллельные чек-ины одного пользователя (уникальный индекс one_open_per_user).
--
-- Рейт-лимит 10/мин (bucket 'park_checkin'). Гранты: REVOKE PUBLIC/anon, GRANT authenticated.
CREATE OR REPLACE FUNCTION public.park_checkin(p_marker_id uuid, p_manual boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid      uuid := auth.uid();
  m        record;
  aw       record;
  cur      record;
  dist_m   double precision;
  res      public.park_checkins%ROWTYPE;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'PT401', MESSAGE = 'not_authenticated';
  END IF;

  IF NOT public.rpc_rate_limit('park_checkin', 10, interval '1 minute') THEN
    RAISE EXCEPTION
      USING ERRCODE = 'PT429',
            MESSAGE = 'rpc_rate_limit',
            DETAIL  = 'park_checkin called too often',
            HINT    = 'Too many requests, slow down';
  END IF;

  SELECT id, lat, lng INTO m
  FROM markers
  WHERE id = p_marker_id AND type = 'dog_park' AND expires_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'PT422', MESSAGE = 'not_a_dog_park';
  END IF;

  -- FOR UPDATE сериализует параллельные чек-ины одного пользователя.
  SELECT lat, lng INTO aw
  FROM active_walks
  WHERE user_id = uid
    AND updated_at > now() - interval '30 minutes'
    AND visibility <> 'nobody'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'PT409', MESSAGE = 'no_active_walk';
  END IF;

  dist_m := 6371000 * 2 * asin(sqrt(
    power(sin(radians(m.lat - aw.lat) / 2), 2) +
    cos(radians(aw.lat)) * cos(radians(m.lat)) *
    power(sin(radians(m.lng - aw.lng) / 2), 2)
  ));
  IF dist_m > 150 THEN
    RAISE EXCEPTION USING ERRCODE = 'PT422', MESSAGE = 'too_far';
  END IF;

  -- Просроченный открытый чек-ин закрываем задним числом по его сроку.
  UPDATE park_checkins
     SET ended_at = expires_at, end_reason = 'expired'
   WHERE user_id = uid AND ended_at IS NULL AND expires_at <= now();

  SELECT * INTO cur
  FROM park_checkins
  WHERE user_id = uid AND ended_at IS NULL;

  IF FOUND AND cur.marker_id = p_marker_id THEN
    UPDATE park_checkins
       SET manual = manual OR p_manual
     WHERE id = cur.id
    RETURNING * INTO res;
  ELSE
    IF FOUND THEN
      UPDATE park_checkins
         SET ended_at = now(), end_reason = 'switched'
       WHERE id = cur.id;
    END IF;
    INSERT INTO park_checkins (user_id, marker_id, manual)
    VALUES (uid, p_marker_id, p_manual)
    RETURNING * INTO res;
  END IF;

  RETURN jsonb_build_object(
    'id',         res.id,
    'marker_id',  res.marker_id,
    'manual',     res.manual,
    'started_at', res.started_at,
    'expires_at', res.expires_at
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.park_checkin(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.park_checkin(uuid, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.park_checkin(uuid, boolean) TO authenticated;
