-- Снимок от 2026-11-15 (fix/security-1, markers_privacy_step2). Лента «ещё там»
-- на МОИХ метках для NotificationsScreen. Заменяет прямое чтение marker_votes
-- (votes_select USING(true) раскрывает чужой user_id голосовавшего). SECURITY
-- DEFINER + фильтр markers.user_id = auth.uid() отдаёт только
-- id/marker_id/vote/created_at. Фильтр/лимит/сортировка 1:1 с клиентом:
-- vote='still_there', created_at desc, 20.
-- Гранты: REVOKE public+anon; GRANT EXECUTE только authenticated.
CREATE OR REPLACE FUNCTION public.get_my_marker_confirmations()
 RETURNS TABLE(id uuid, marker_id uuid, vote text, created_at timestamptz)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  select v.id, v.marker_id, v.vote, v.created_at
  from marker_votes v
  join markers m on m.id = v.marker_id
  where m.user_id = auth.uid()
    and v.vote = 'still_there'
  order by v.created_at desc
  limit 20;
$function$;

REVOKE ALL ON FUNCTION public.get_my_marker_confirmations() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_my_marker_confirmations() TO authenticated;
