-- Снимок от 16.11.2026 (markers privacy ШАГ 3, applied 2026-11-16). RPC Trust Level.
-- Теперь SECURITY DEFINER и жёстко привязан к auth.uid(): параметр p_user_id
-- в теле НЕ используется (оставлен в сигнатуре ради совместимости со старыми
-- клиентами) — посчитать чужой confirmed-count нельзя. Гранты: только authenticated.
CREATE OR REPLACE FUNCTION public.get_trust_status(p_user_id uuid, p_threshold integer DEFAULT 3)
 RETURNS TABLE(is_trusted boolean, confirmed_count integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    count(*) >= p_threshold AS is_trusted,
    count(*)::integer       AS confirmed_count
  FROM markers m
  WHERE m.user_id = auth.uid()
    AND m.created_at >= now() - interval '7 days'
    AND (
      SELECT coalesce(count(*) FILTER (WHERE v.vote = 'still_there'), 0)
           - coalesce(count(*) FILTER (WHERE v.vote = 'gone'), 0)
      FROM marker_votes v
      WHERE v.marker_id = m.id
    ) > 0;
$function$;
REVOKE ALL ON FUNCTION public.get_trust_status(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_trust_status(uuid, integer) TO authenticated;
