-- Снимок от 2026-09-25. RPC для пинов/списка «гуляют рядом» (заход А приватности
-- 'everyone'). Заменяет прямой SELECT из active_walks в клиенте (useNearbyDogs).
-- SECURITY DEFINER: сама решает, что отдать, и КВАНТУЕТ координаты не-друзьям.
--
--   • друзьям (принятая дружба) — ТОЧНЫЕ координаты;
--   • 'everyone'-незнакомцам — округлённые round(...,3) ≈ 111 м (анти-триангуляция);
--   • фильтр 2 км (та же формула гаверсинуса, что в get_hidden_walks_count);
--   • свою строку и всё старше 30 мин не отдаёт.
--
-- Рейт-лимит: 20 вызовов/мин на пользователя через public.rpc_rate_limit
-- (см. rpc_rate_limit.sql). Почему 20, а не 6: во время прогулки одновременно
-- смонтированы MapScreen и WalkScreen, каждый опрашивает раз в 30 сек (=4/мин)
-- плюс рефетч на фокус/возврат из фона — легитимный пик ~6–8/мин, 6 бы срывался.
-- 20/мин с запасом покрывает норму и всё равно режет скриптовый сэмплинг; главная
-- защита координат — само округление, а не частота. При превышении — RAISE 'PT429'
-- (не пустой результат): пустой список клиент принял бы за «рядом никого» и стёр
-- бы пины/карточки; ошибку же клиент ловит и ОСТАВЛЯЕТ прошлые данные.
--
-- VOLATILE (по умолчанию): внутри пишет rpc_rate_limit — в STABLE запись нельзя.
-- Гранты: REVOKE PUBLIC/anon, GRANT authenticated (RLS active_walks в заходе А НЕ
-- трогаем — прямой доступ к сырым координатам сузим в заходе Б).

CREATE OR REPLACE FUNCTION public.get_nearby_walks(user_lat double precision, user_lng double precision)
 RETURNS TABLE(user_id uuid, lat double precision, lng double precision, updated_at timestamptz, is_friend boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.rpc_rate_limit('get_nearby_walks', 20, interval '1 minute') THEN
    RAISE EXCEPTION 'rpc_rate_limit'
      USING ERRCODE = 'PT429',
            MESSAGE = 'rpc_rate_limit',
            DETAIL  = 'get_nearby_walks called too often',
            HINT    = 'Too many requests, slow down';
  END IF;

  RETURN QUERY
  SELECT
    aw.user_id,
    CASE WHEN fr.is_friend THEN aw.lat ELSE round(aw.lat::numeric, 3)::double precision END AS lat,
    CASE WHEN fr.is_friend THEN aw.lng ELSE round(aw.lng::numeric, 3)::double precision END AS lng,
    aw.updated_at,
    fr.is_friend
  FROM active_walks aw
  CROSS JOIN LATERAL (
    SELECT EXISTS (
      SELECT 1 FROM friendships f
      WHERE f.status = 'accepted'
        AND ((f.requester_id = auth.uid() AND f.addressee_id = aw.user_id)
          OR (f.addressee_id = auth.uid() AND f.requester_id = aw.user_id))
    ) AS is_friend
  ) fr
  WHERE aw.updated_at > now() - interval '30 minutes'
    AND aw.user_id <> auth.uid()
    AND (aw.visibility = 'everyone' OR (aw.visibility = 'friends' AND fr.is_friend))
    AND (
      6371 * 2 * asin(sqrt(
        power(sin(radians(aw.lat - user_lat) / 2), 2) +
        cos(radians(user_lat)) * cos(radians(aw.lat)) *
        power(sin(radians(aw.lng - user_lng) / 2), 2)
      ))
    ) <= 2;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_nearby_walks(double precision, double precision) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_nearby_walks(double precision, double precision) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_nearby_walks(double precision, double precision) TO authenticated;
