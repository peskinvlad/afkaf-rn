-- Снимок RLS. Идемпотентно.
-- 2026-11-04 (feat/moderation): active_walks_select ужесточена.
--   • + NOT public.is_blocked(user_id) — заблокированный (в обе стороны) не читает
--     чужую строку прямым select (functions/is_blocked.sql);
--   • убрана ветка «visibility='everyone' для всех»: прямой select чужой строки —
--     ТОЛЬКО при принятой дружбе. Точные координаты 'everyone'-прогулок не-друзьям
--     отдаёт лишь get_nearby_walks (с округлением ~111 м). Это закрывало прямой
--     обход округления (security backlog «Квантование everyone»).
--   Безопасно: все читатели active_walks в БД — SECURITY DEFINER
--   (get_nearby_walks/get_user_previews/get_park_presence/get_hidden_walks_count/
--    park_checkin), realtime-подписок/вью/триггеров нет; клиент (iOS и exp/android)
--    читает чужое только через get_nearby_walks, свою строку — по user_id=self.
--   visibility IN ('friends','everyone') оставлено явным на случай будущего 'nobody'.
--   Применено миграцией supabase/migrations/2026-11-04_active_walks_tighten.sql.
ALTER TABLE public.active_walks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS active_walks_select ON public.active_walks;
CREATE POLICY active_walks_select ON public.active_walks
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      updated_at > now() - interval '30 minutes'
      AND NOT public.is_blocked(user_id)
      AND visibility IN ('friends','everyone')
      AND EXISTS (
        SELECT 1 FROM friendships f
        WHERE f.status = 'accepted'
          AND (
            (f.requester_id = auth.uid() AND f.addressee_id = active_walks.user_id)
            OR (f.addressee_id = auth.uid() AND f.requester_id = active_walks.user_id)
          )
      )
    )
  );

DROP POLICY IF EXISTS active_walks_insert ON public.active_walks;
CREATE POLICY active_walks_insert ON public.active_walks
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS active_walks_update ON public.active_walks;
CREATE POLICY active_walks_update ON public.active_walks
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS active_walks_delete ON public.active_walks;
CREATE POLICY active_walks_delete ON public.active_walks
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
