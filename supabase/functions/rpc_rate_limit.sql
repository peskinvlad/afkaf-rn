-- Снимок от 2026-09-25. Общий helper рейт-лимита для SECURITY DEFINER RPC.
-- Токен-бакет на пользователя+bucket: одна строка на (user_id, bucket), окно
-- сбрасывается по времени. В БД раньше отдельной rpc_rate_limit-функции НЕ было
-- (в markers_guard_insert лимит инлайновый через COUNT + RAISE 'PT429'); этот
-- helper — первый общий, добавлен вместе с get_nearby_walks (заход А приватности
-- 'everyone', квантование координат для не-друзей).
--
-- Использование:
--   IF NOT public.rpc_rate_limit('get_nearby_walks', 20, interval '1 minute') THEN
--     RAISE EXCEPTION 'rpc_rate_limit' USING ERRCODE='PT429', ...;
--   END IF;
--
-- Таблица под RLS БЕЗ политик — клиент не читает/не пишет её напрямую, только
-- SECURITY DEFINER-функции (владелец обходит RLS). Гранты RPC — не anon.

CREATE TABLE IF NOT EXISTS public.rpc_rate_limit (
  user_id      uuid        NOT NULL,
  bucket       text        NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  count        integer     NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, bucket)
);

ALTER TABLE public.rpc_rate_limit ENABLE ROW LEVEL SECURITY;
-- Политик нет: доступ только через SECURITY DEFINER-функции.

-- Возвращает true, если вызов в пределах лимита (и учитывает его), иначе false.
-- VOLATILE обязателен: функция пишет (INSERT/UPDATE) — в STABLE/IMMUTABLE запись
-- запрещена. auth.uid() читает JWT вызывающего даже под SECURITY DEFINER.
CREATE OR REPLACE FUNCTION public.rpc_rate_limit(p_bucket text, p_max integer, p_window interval)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  cur integer;
BEGIN
  IF uid IS NULL THEN
    RETURN false; -- аноним не проходит лимит (и не должен вызывать эти RPC)
  END IF;

  INSERT INTO public.rpc_rate_limit AS r (user_id, bucket, window_start, count)
  VALUES (uid, p_bucket, now(), 1)
  ON CONFLICT (user_id, bucket) DO UPDATE
    SET count        = CASE WHEN r.window_start < now() - p_window THEN 1     ELSE r.count + 1 END,
        window_start = CASE WHEN r.window_start < now() - p_window THEN now() ELSE r.window_start END
  RETURNING r.count INTO cur;

  RETURN cur <= p_max;
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_rate_limit(text, integer, interval) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_rate_limit(text, integer, interval) FROM anon;
-- Вызывается только из других SECURITY DEFINER-функций; прямой EXECUTE клиенту не нужен.
