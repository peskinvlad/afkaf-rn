-- Снимок RLS от 16.11.2026 (markers privacy ШАГ 3, applied 2026-11-16).
-- Прямой доступ к marker_votes закрыт ПОЛНОСТЬЮ: RLS включён, политик нет,
-- табличные гранты anon/authenticated сняты. Голоса читаются только агрегатами
-- через get_marker_votes и пишутся через cast_marker_vote (оба SECURITY DEFINER).
-- Так user_id голосовавших больше не утекает (закрыт прежний votes_select USING(true)).
ALTER TABLE public.marker_votes ENABLE ROW LEVEL SECURITY;

-- Табличные гранты сняты у обеих ролей — доступ только через definer-функции.
REVOKE ALL ON public.marker_votes FROM anon, authenticated;

-- Политик нет by design: при включённом RLS и отсутствии политик прямой
-- SELECT/INSERT/UPDATE/DELETE от anon и authenticated запрещён.
DROP POLICY IF EXISTS votes_select ON public.marker_votes;
DROP POLICY IF EXISTS votes_insert ON public.marker_votes;
DROP POLICY IF EXISTS votes_update ON public.marker_votes;
DROP POLICY IF EXISTS votes_delete ON public.marker_votes;
