-- Снимок от 15.07.2026. Триггер trg_extend_marker_expiry (marker_votes, AFTER INSERT only).
-- Cap: created_at + 7 days (LEAST). Гранты: REVOKE от всех, включая authenticated —
-- триггер выполняется от владельца, прямой EXECUTE не нужен.
-- Смок-тест голосом «Ещё тут» pending (живой тест). Если голос упадёт permission denied:
-- GRANT EXECUTE ON FUNCTION public.extend_marker_expiry() TO authenticated; и принять варнинг.
CREATE OR REPLACE FUNCTION public.extend_marker_expiry()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.vote = 'still_there' THEN
    UPDATE markers
    SET expires_at = LEAST(now() + interval '24 hours',
                           created_at + interval '7 days')
    WHERE id = NEW.marker_id
      AND expires_at IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$function$;
