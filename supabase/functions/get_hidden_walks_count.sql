-- Снимок от 15.07.2026. RPC для «+N walking nearby». SECURITY DEFINER.
-- Гранты: REVOKE PUBLIC/anon, GRANT authenticated. Принятый варнинг Advisor №2.
-- Бэклог пост-бета: rate-limit/квантование координат (триангуляция).
CREATE OR REPLACE FUNCTION public.get_hidden_walks_count(user_lat double precision, user_lng double precision)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT count(*)::integer
  FROM active_walks aw
  WHERE aw.updated_at > now() - interval '30 minutes'
    AND aw.user_id <> auth.uid()
    AND (
      6371 * 2 * asin(sqrt(
        power(sin(radians(aw.lat - user_lat) / 2), 2) +
        cos(radians(user_lat)) * cos(radians(aw.lat)) *
        power(sin(radians(aw.lng - user_lng) / 2), 2)
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
    );
$function$;
