-- Снимок от 2026-11-14 (fix/security-1, markers_privacy_step1). Счётчики голосов
-- по метке + ТОЛЬКО мой голос (my_vote), без раскрытия чужих user_id. Заменяет
-- прямое чтение marker_votes в MarkerCallout.
-- Гранты: GRANT anon + authenticated (счётчики не чувствительны; у гостя my_vote=NULL).
CREATE OR REPLACE FUNCTION public.get_marker_votes(p_marker_id uuid)
 RETURNS TABLE(still_there integer, gone integer, my_vote text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  select
    (count(*) filter (where v.vote = 'still_there'))::int,
    (count(*) filter (where v.vote = 'gone'))::int,
    max(v.vote) filter (where v.user_id = auth.uid())
  from marker_votes v
  where v.marker_id = p_marker_id;
$function$;

GRANT EXECUTE ON FUNCTION public.get_marker_votes(uuid) TO anon, authenticated;
