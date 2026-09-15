-- 2026-09-15  dog_park + food (enum-check), infra-guard в триггере, unique(osm_id).
-- Применять в Supabase SQL Editor (роль postgres → auth.uid() IS NULL).
-- Применено на живой БД 2026-09-15. Снапшоты обновлены тем же коммитом:
--   markers_type_check → supabase/tables.sql
--   markers_guard_insert → supabase/functions/markers_guard_insert.sql
--   water_sources_osm_id_key — отдельный индекс, в tables.sql не фиксируется
--     (см. правило шапки tables.sql), источник правды — этот файл.
BEGIN;

-- (A) markers.type: добавляем dog_park (инфраструктура) и food (будущий
--     пользовательский тип, пост-бета). Существующие строки укладываются
--     в старый набор — ревалидация пройдёт без ошибок.
ALTER TABLE public.markers DROP CONSTRAINT markers_type_check;
ALTER TABLE public.markers ADD CONSTRAINT markers_type_check
  CHECK (type = ANY (ARRAY[
    'park'::text, 'water'::text, 'danger'::text, 'hazard'::text,
    'aggressive_dog'::text, 'forbidden'::text, 'dog_park'::text, 'food'::text
  ]));

-- (B) Триггерная функция вставки меток.
--     Добавлен блок: инфраструктурные типы (water/park/dog_park) может
--     создавать только service_role / SQL (auth.uid() IS NULL — ранний выход
--     выше). Обычный аутентифицированный юзер получит PT403 (→ HTTP 403).
--     food НЕ инфраструктурный — идёт общим путём (rate-limit + TTL 24h из ELSE).
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

  -- Инфраструктурные (кураторские) типы — только через service_role / SQL.
  IF NEW.type IN ('water', 'park', 'dog_park') THEN
    RAISE EXCEPTION 'markers_type_forbidden'
      USING ERRCODE = 'PT403',
            MESSAGE = 'markers_type_forbidden',
            DETAIL  = 'infrastructure marker types are curated-only',
            HINT    = 'Этот тип метки нельзя создавать вручную';
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

-- (C) Дедуп water_sources по osm_id для импорта (ON CONFLICT (osm_id)).
--     osm_id уже существует (text, 109/109 заполнены, дублей нет).
--     NULL-osm_id допускаются множественно (стандарт Postgres) — не мешает.
CREATE UNIQUE INDEX IF NOT EXISTS water_sources_osm_id_key
  ON public.water_sources (osm_id);

COMMIT;
