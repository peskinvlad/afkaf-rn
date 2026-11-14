-- Снимок от 2026-11-14 (fix/security-1, markers_privacy_step1). Чтение меток для
-- карты БЕЗ раскрытия user_id: отдаёт is_mine = (user_id = auth.uid()) и кэш-
-- счётчики confirmations/denials. Фильтр shadow-ban ЕДИН для anon и authenticated
-- (у прямого markers_select_anon фильтра нет — через эту функцию гость и вошедший
-- равны). Те же условия TTL, что было у прямого чтения useMapMarkers.
-- Гранты: GRANT anon + authenticated.
CREATE OR REPLACE FUNCTION public.get_map_markers()
 RETURNS TABLE(id uuid, type text, lat double precision, lng double precision,
               description text, created_at timestamptz, expires_at timestamptz,
               confirmations integer, denials integer, is_mine boolean)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  select m.id, m.type, m.lat, m.lng, m.description, m.created_at, m.expires_at,
         m.confirmations, m.denials,
         coalesce(m.user_id = auth.uid(), false) as is_mine
  from markers m
  where (m.expires_at is null or m.expires_at > now())
    and (
      m.user_id = auth.uid()
      or not (select s.is_shadow_banned from get_shadow_status(m.user_id) s)
    );
$function$;

GRANT EXECUTE ON FUNCTION public.get_map_markers() TO anon, authenticated;
