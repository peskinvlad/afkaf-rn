-- Снимок от 15.07.2026. SECURITY DEFINER — обязателен: вызывается из RLS-политики
-- markers_select_auth (без DEFINER — рекурсия политик, известный баг).
-- Гранты: REVOKE PUBLIC/anon, GRANT authenticated ОБЯЗАТЕЛЕН (иначе auth-чтение
-- меток ломается). Принятый варнинг Advisor №3.
CREATE OR REPLACE FUNCTION public.get_shadow_status(p_user_id uuid, p_threshold integer DEFAULT 3)
 RETURNS TABLE(is_shadow_banned boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    count(*) >= p_threshold AS is_shadow_banned
  FROM markers m
  WHERE m.user_id = p_user_id
    AND m.created_at >= now() - interval '7 days'
    AND (
      SELECT coalesce(count(*) FILTER (WHERE v.vote = 'gone'), 0)
           - coalesce(count(*) FILTER (WHERE v.vote = 'still_there'), 0)
      FROM marker_votes v
      WHERE v.marker_id = m.id
    ) > 0;
$function$;
