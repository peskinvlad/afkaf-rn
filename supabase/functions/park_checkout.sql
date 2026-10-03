-- Снимок от 2026-09-29 (feat/park-checkin). Закрыть свой открытый чек-ин.
-- SECURITY DEFINER: у park_checkins нет write-политик.
--
-- p_reason: 'left' (детектор: подтверждённо вышел из зоны) или 'walk_end'
-- (конец прогулки / восстановление после краша). 'expired' и 'switched' ставит
-- только сервер. Если срок уже истёк — пишется 'expired' и ended_at = expires_at.
-- Свежая прогулка НЕ требуется: закрыть свой чек-ин можно всегда.
-- Возвращает true, если открытый чек-ин был.
--
-- Рейт-лимит 20/мин (bucket 'park_checkout'). Гранты: REVOKE PUBLIC/anon, GRANT authenticated.
CREATE OR REPLACE FUNCTION public.park_checkout(p_reason text DEFAULT 'left')
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  n   integer;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'PT401', MESSAGE = 'not_authenticated';
  END IF;
  IF p_reason NOT IN ('left', 'walk_end') THEN
    RAISE EXCEPTION USING ERRCODE = 'PT422', MESSAGE = 'bad_reason';
  END IF;
  IF NOT public.rpc_rate_limit('park_checkout', 20, interval '1 minute') THEN
    RAISE EXCEPTION
      USING ERRCODE = 'PT429',
            MESSAGE = 'rpc_rate_limit',
            DETAIL  = 'park_checkout called too often',
            HINT    = 'Too many requests, slow down';
  END IF;

  UPDATE park_checkins
     SET ended_at   = LEAST(now(), expires_at),
         end_reason = CASE WHEN expires_at <= now() THEN 'expired' ELSE p_reason END
   WHERE user_id = uid AND ended_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END;
$function$;

REVOKE ALL ON FUNCTION public.park_checkout(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.park_checkout(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.park_checkout(text) TO authenticated;
