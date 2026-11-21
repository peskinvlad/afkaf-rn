-- 2026-11-16  markers privacy — ШАГ 3 (закрытие прямого доступа).
-- applied 2026-11-16 (через Supabase MCP). Файл приведён к состоянию живой БД
-- (сверено pg_policy / pg_get_functiondef / pg_class.relacl).
--
-- Контекст: ШАГ 1 (2026-11-14, см. 2026-11-14_markers_privacy_step1.sql) добавил
-- серверные RPC (get_map_markers, get_marker_votes, cast_marker_vote) и серверную
-- простановку markers.user_id, НЕ закрывая прямой доступ — чтобы старые iOS/Android
-- сборки продолжали работать. После того как клиент перешёл на RPC (коммиты
-- cf62e30 «markers privacy step 2» и 3c7debf), ШАГ 3 закрывает прямой SELECT на
-- markers/marker_votes и привязывает get_trust_status к auth.uid().
--
-- Проверено после применения: anon — нет доступа к markers/marker_votes;
-- authenticated — markers только свои строки (карта/голоса/лента/доверие идут
-- через get_map_markers / get_marker_votes / cast_marker_vote / get_trust_status).
--
-- Снапшоты обновлены тем же коммитом:
--   policies/markers.sql, policies/marker_votes.sql, functions/get_trust_status.sql.
BEGIN;

-- 1) markers: гость больше не читает таблицу напрямую (карта идёт через
--    get_map_markers, SECURITY DEFINER, с shadow-фильтром). Снимаем anon-политику
--    и табличные гранты anon.
DROP POLICY IF EXISTS markers_select_anon ON public.markers;
REVOKE ALL ON public.markers FROM anon;

-- authenticated читает прямым SELECT ТОЛЬКО свои строки (чужие метки — через
-- get_map_markers). Shadow-ветку из прямой политики убираем: она теперь внутри
-- get_map_markers.
DROP POLICY IF EXISTS markers_select_auth ON public.markers;
CREATE POLICY markers_select_auth ON public.markers
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 2) marker_votes: прямой доступ закрыт полностью. Голоса читаются только
--    агрегатами через get_marker_votes, пишутся через cast_marker_vote (оба
--    SECURITY DEFINER). Снимаем все политики и табличные гранты обеих ролей — так
--    user_id голосовавших больше не утекает (закрыт прежний votes_select USING(true)).
DROP POLICY IF EXISTS votes_select ON public.marker_votes;
DROP POLICY IF EXISTS votes_insert ON public.marker_votes;
DROP POLICY IF EXISTS votes_update ON public.marker_votes;
DROP POLICY IF EXISTS votes_delete ON public.marker_votes;
REVOKE ALL ON public.marker_votes FROM anon, authenticated;

-- 3) get_trust_status -> SECURITY DEFINER и жёстко привязан к auth.uid():
--    параметр p_user_id больше не используется в теле (нельзя посчитать чужой
--    confirmed-count; оставлен в сигнатуре ради совместимости со старыми клиентами).
--    anon-доступ не нужен.
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

COMMIT;
