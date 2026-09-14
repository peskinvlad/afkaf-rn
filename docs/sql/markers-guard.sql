-- ============================================================
-- markers-guard.sql  (run once in Supabase SQL Editor)
--
-- ВАЖНО: Маркеры не удаляются физически — только истекают через
-- expires_at. Не добавлять чистку (cron/DELETE). История строк нужна
-- для сводки района; выборка на карту фильтрует по expires_at на клиенте
-- (src/hooks/useMapMarkers.ts: .or('expires_at.is.null,expires_at.gt.<now>')).
--
-- Защитный BEFORE INSERT триггер на public.markers:
--   0) auth.uid() IS NULL → выход: кураторские вставки (service role /
--      SQL Editor, постоянные метки с expires_at = NULL) не трогаем;
--   A) rate limit — не больше 20 меток на auth.uid() за последний час,
--      иначе RAISE EXCEPTION с кодом SQLSTATE 'PT429' (PostgREST отдаёт
--      HTTP 429; клиент ловит error.code === 'PT429' → «слишком много
--      отметок, подожди»);
--   B) created_at всегда серверное (now());
--   C) expires_at: если NULL — ставим по типу метки (сейчас все типы 24h,
--      см. src/screens/AddMarkerScreen.tsx:271). Если клиент прислал свой
--      expires_at — капаем его максимальным TTL типа (least), чтобы нельзя
--      было раздуть срок.
--
-- НЕ SECURITY DEFINER: count(*) идёт под RLS (markers_select_auth:
-- user_id = auth.uid()) — своих строк видно достаточно.
-- ============================================================

CREATE OR REPLACE FUNCTION public.markers_guard_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  recent_count integer;
  max_ttl      interval;
BEGIN
  -- 0) кураторские вставки не ограничиваем и не переписываем
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- A) rate limit: >= 20 меток за час
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

  -- B) created_at всегда серверное
  NEW.created_at := now();

  -- C) максимальный TTL по типу метки (сейчас единый 24h для всех типов,
  --    см. AddMarkerScreen.tsx:271; разнести здесь, если сроки разъедутся)
  max_ttl := CASE NEW.type
    WHEN 'hazard'         THEN interval '24 hours'
    WHEN 'aggressive_dog' THEN interval '24 hours'
    WHEN 'forbidden'      THEN interval '24 hours'
    WHEN 'danger'         THEN interval '24 hours'
    ELSE interval '24 hours'
  END;

  IF NEW.expires_at IS NULL THEN
    -- пропущенный клиентский expires_at → ставим по типу
    NEW.expires_at := now() + max_ttl;
  ELSE
    -- раздутый клиентский expires_at → капаем максимальным TTL типа
    NEW.expires_at := least(NEW.expires_at, now() + max_ttl);
  END IF;

  RETURN NEW;
END;
$function$;

-- Триггер (идемпотентно). Функция расшарена с supabase/triggers.sql.
DROP TRIGGER IF EXISTS markers_guard_insert ON public.markers;
CREATE TRIGGER markers_guard_insert
  BEFORE INSERT ON public.markers
  FOR EACH ROW EXECUTE FUNCTION public.markers_guard_insert();
