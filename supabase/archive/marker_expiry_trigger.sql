-- ============================================================
-- marker_expiry_trigger  (run once in Supabase SQL Editor)
--
-- "Still there" голос продлевает жизнь метки на 24 часа от
-- момента голоса. "Gone" ничего не делает — метка просто
-- истекает сама по expires_at.
--
-- SECURITY DEFINER: функция выполняется с правами владельца
-- (обычно postgres), поэтому обходит RLS на markers — голосующему
-- не нужен отдельный UPDATE-доступ к markers.
--
-- Постоянные метки (expires_at IS NULL, ставит Влад вручную)
-- триггер НЕ трогает — иначе голос "still_there" превратил бы
-- постоянную метку во временную (24ч).
-- ============================================================

CREATE OR REPLACE FUNCTION extend_marker_expiry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.vote = 'still_there' THEN
    UPDATE markers
    SET expires_at = now() + interval '24 hours'
    WHERE id = NEW.marker_id
      AND expires_at IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_extend_marker_expiry ON marker_votes;

CREATE TRIGGER trg_extend_marker_expiry
  AFTER INSERT OR UPDATE ON marker_votes
  FOR EACH ROW
  EXECUTE FUNCTION extend_marker_expiry();
