-- Снимок от 15.07.2026. RPC Trust Level. НЕ SECURITY DEFINER (работает под RLS).
-- Гранты: REVOKE PUBLIC/anon, GRANT authenticated (выполнено 15.07.2026 для
-- единообразия паттерна; дыры не было — RLS anon всё равно не пропускал).
CREATE OR REPLACE FUNCTION public.get_trust_status(p_user_id uuid, p_threshold integer DEFAULT 3)
 RETURNS TABLE(is_trusted boolean, confirmed_count integer)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT
    count(*) >= p_threshold AS is_trusted,
    count(*)::integer       AS confirmed_count
  FROM markers m
  WHERE m.user_id = p_user_id
    AND m.created_at >= now() - interval '7 days'
    AND (
      SELECT coalesce(count(*) FILTER (WHERE v.vote = 'still_there'), 0)
           - coalesce(count(*) FILTER (WHERE v.vote = 'gone'), 0)
      FROM marker_votes v
      WHERE v.marker_id = m.id
    ) > 0;
$function$;
