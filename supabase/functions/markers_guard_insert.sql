-- Снимок от 2026-09-13. Триггерная функция markers_guard_insert (BEFORE INSERT
-- на public.markers). НЕ SECURITY DEFINER: считаем свои строки под RLS
-- (markers_select_auth: user_id = auth.uid()) — прав хватает.
-- Триггер — в supabase/triggers.sql.
--
--   0) auth.uid() IS NULL → выход: вставки через service role / SQL Editor
--      (кураторские метки) не ограничиваем и не переписываем их таймстемпы;
--   1) rate limit — не более 20 меток на auth.uid() за последний час;
--   2) created_at всегда серверное (now());
--   3) expires_at капается максимальным TTL типа. Код AddMarkerScreen выставляет
--      единый 24h для всех типов, поэтому максимум для любого типа = now() + 24h.
CREATE OR REPLACE FUNCTION public.markers_guard_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  recent_count integer;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;

  SELECT count(*) INTO recent_count
  FROM public.markers
  WHERE user_id = auth.uid()
    AND created_at > now() - interval '1 hour';

  IF recent_count >= 20 THEN
    RAISE EXCEPTION 'rate limit';
  END IF;

  NEW.created_at := now();

  -- least() игнорирует NULL: пропущенный или раздутый клиентский expires_at
  -- схлопывается к капу now() + 24h.
  NEW.expires_at := least(NEW.expires_at, now() + interval '24 hours');

  RETURN NEW;
END;
$function$;
