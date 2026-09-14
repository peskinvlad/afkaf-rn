-- Снимок от 2026-09-14. Триггерная функция markers_guard_insert (BEFORE INSERT
-- на public.markers). НЕ SECURITY DEFINER: считаем свои строки под RLS
-- (markers_select_auth: user_id = auth.uid()) — прав хватает.
-- Триггер — в supabase/triggers.sql. Применяемый скрипт — docs/sql/markers-guard.sql.
--
--   0) auth.uid() IS NULL → выход ДО rate-limit и до блока expires_at:
--      вставки через service role / SQL Editor (кураторские и постоянные
--      метки с expires_at = NULL) не ограничиваем и не переписываем;
--   A) rate limit — не более 20 меток на auth.uid() за последний час,
--      иначе RAISE EXCEPTION с SQLSTATE 'PT429' (PostgREST → HTTP 429;
--      клиент ловит error.code === 'PT429' и показывает common.rate_limit);
--   B) created_at всегда серверное (now());
--   C) expires_at: NULL → выставляем по типу метки (сейчас единый 24h для
--      всех типов, см. src/screens/AddMarkerScreen.tsx). Ненулевой клиентский
--      expires_at капается максимальным TTL типа (least).
CREATE OR REPLACE FUNCTION public.markers_guard_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  recent_count integer;
  max_ttl      interval;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO recent_count
  FROM public.markers
  WHERE user_id = auth.uid()
    AND created_at > now() - interval '1 hour';

  IF recent_count >= 20 THEN
    RAISE EXCEPTION 'markers_rate_limit'
      USING ERRCODE = 'PT429',
            MESSAGE = 'markers_rate_limit',
            DETAIL  = 'more than 20 markers created in the last hour',
            HINT    = 'Слишком много отметок, подожди немного';
  END IF;

  NEW.created_at := now();

  max_ttl := CASE NEW.type
    WHEN 'hazard'         THEN interval '24 hours'
    WHEN 'aggressive_dog' THEN interval '24 hours'
    WHEN 'forbidden'      THEN interval '24 hours'
    WHEN 'danger'         THEN interval '24 hours'
    ELSE interval '24 hours'
  END;

  IF NEW.expires_at IS NULL THEN
    NEW.expires_at := now() + max_ttl;
  ELSE
    NEW.expires_at := least(NEW.expires_at, now() + max_ttl);
  END IF;

  RETURN NEW;
END;
$function$;
