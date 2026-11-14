-- Снимок от 2026-11-14 (fix/security-1, markers_privacy_step1). Запись голоса за
-- актуальность метки через RPC: user_id = auth.uid() (клиент его не шлёт),
-- rate-limit 30/мин (PT429), запрет голоса за свою метку (PT403), upsert
-- ON CONFLICT (marker_id,user_id). Внутри SECURITY DEFINER владелец имеет SELECT,
-- поэтому upsert работает и после закрытия прямого доступа (шаг 3).
-- Коды: PT401 не авторизован, PT400 плохой голос, PT429 лимит, PT403 своя метка.
-- Гранты: REVOKE PUBLIC/anon, GRANT authenticated (гости не голосуют).
CREATE OR REPLACE FUNCTION public.cast_marker_vote(p_marker_id uuid, p_vote text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare uid uuid := auth.uid();
begin
  if uid is null then
    raise exception using errcode = 'PT401', message = 'not_authenticated';
  end if;
  if p_vote is null or p_vote not in ('still_there','gone') then
    raise exception using errcode = 'PT400', message = 'bad_vote';
  end if;
  if not public.rpc_rate_limit('cast_marker_vote', 30, interval '1 minute') then
    raise exception using errcode = 'PT429', message = 'rpc_rate_limit',
      detail = 'cast_marker_vote called too often', hint = 'Too many requests, slow down';
  end if;
  if (select m.user_id from markers m where m.id = p_marker_id) = uid then
    raise exception using errcode = 'PT403', message = 'own_marker';
  end if;
  insert into marker_votes (marker_id, user_id, vote)
  values (p_marker_id, uid, p_vote)
  on conflict (marker_id, user_id) do update set vote = excluded.vote;
end;
$function$;

REVOKE ALL ON FUNCTION public.cast_marker_vote(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cast_marker_vote(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.cast_marker_vote(uuid, text) TO authenticated;
