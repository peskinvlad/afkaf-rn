-- Снимок от 2026-09-25. RPC для «+N walking nearby». SECURITY DEFINER.
-- Гранты: REVOKE PUBLIC/anon, GRANT authenticated. Принятый варнинг Advisor №2.
--
-- Закрыта дыра триангуляции (была: расстояние 2 км по ТОЧНЫМ координатам скрытых
-- прогулок + без лимита → серией вызовов со сдвигом user_lat/user_lng можно было
-- вычислить, где гуляет скрытый человек):
--   • расстояние 2 км считается по координатам скрытой прогулки, ОКРУГЛЁННЫМ к
--     сетке ~500 м (0.0045° ≈ 500 м по широте на широтах Гуш-Дана; по долготе на
--     ~32° с.ш. ~420 м — того же порядка). Сетка грубее, чем в get_nearby_walks
--     (~111 м): здесь наружу уходит только СЧЁТЧИК присутствия, но и он не должен
--     позволять локализовать скрытого точнее ~полукилометра. Округляется точка
--     прогулки (не user_lat/lng), поэтому граница круга «прилипает» к сетке и
--     сканирование выдаёт лишь ячейку ~500 м, а не координату;
--   • лимит 20 вызовов/мин на пользователя через public.rpc_rate_limit (отдельный
--     bucket 'get_hidden_walks_count'). 20 — как в get_nearby_walks: функция
--     вызывается тем же load() на MapScreen и WalkScreen (оба смонтированы во
--     время прогулки), опрос раз в 30 сек + рефетч на фокус/фон → легитимный пик
--     ~6–8/мин; 20 покрывает с запасом и режет скриптовый сэмплинг.
--
-- Стала plpgsql VOLATILE (было STABLE sql): rpc_rate_limit пишет, а в STABLE
-- запись запрещена. Сигнатура (аргументы + RETURNS integer) НЕ изменилась —
-- старый клиент (в т.ч. Android до переноса) вызывает так же; при PT429 клиент
-- получает ошибку, hidden = null → setHiddenCount(0) (без краха и Alert).
-- RAISE — без строки формата (иначе конфликт с USING MESSAGE: «RAISE option
-- already specified: MESSAGE»).
CREATE OR REPLACE FUNCTION public.get_hidden_walks_count(user_lat double precision, user_lng double precision)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.rpc_rate_limit('get_hidden_walks_count', 20, interval '1 minute') THEN
    RAISE EXCEPTION
      USING ERRCODE = 'PT429',
            MESSAGE = 'rpc_rate_limit',
            DETAIL  = 'get_hidden_walks_count called too often',
            HINT    = 'Too many requests, slow down';
  END IF;

  RETURN (
    SELECT count(*)::integer
    FROM active_walks aw
    WHERE aw.updated_at > now() - interval '30 minutes'
      AND aw.user_id <> auth.uid()
      AND (
        6371 * 2 * asin(sqrt(
          power(sin(radians(round((aw.lat / 0.0045))::double precision * 0.0045 - user_lat) / 2), 2) +
          cos(radians(user_lat)) * cos(radians(round((aw.lat / 0.0045))::double precision * 0.0045)) *
          power(sin(radians(round((aw.lng / 0.0045))::double precision * 0.0045 - user_lng) / 2), 2)
        ))
      ) <= 2
      AND NOT (
        aw.visibility = 'everyone'
        OR (
          aw.visibility = 'friends'
          AND EXISTS (
            SELECT 1 FROM friendships f
            WHERE f.status = 'accepted'
            AND (
              (f.requester_id = auth.uid() AND f.addressee_id = aw.user_id)
              OR (f.addressee_id = auth.uid() AND f.requester_id = aw.user_id)
            )
          )
        )
      )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_hidden_walks_count(double precision, double precision) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_hidden_walks_count(double precision, double precision) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_hidden_walks_count(double precision, double precision) TO authenticated;
