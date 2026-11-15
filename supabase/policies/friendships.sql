-- Снимок RLS. Идемпотентно. Ужесточение INSERT/UPDATE — 2026-09-14
-- (docs/sql/friendships-guard.sql): INSERT только 'pending', иммутабельность
-- сторон при UPDATE — триггером friendships_guard_update (см. supabase/triggers.sql
-- и supabase/functions/friendships_guard_update.sql).
-- 2026-11-04 (feat/moderation): friendships_insert + NOT public.is_blocked(addressee_id)
-- — нельзя слать заявку заблокированному/заблокировавшему (блок в обе стороны,
-- functions/is_blocked.sql). Сам блок (block_user) удаляет уже существующие строки
-- дружбы/заявок в обе стороны.
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS friendships_select ON public.friendships;
CREATE POLICY friendships_select ON public.friendships
  FOR SELECT TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

DROP POLICY IF EXISTS friendships_insert ON public.friendships;
CREATE POLICY friendships_insert ON public.friendships
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = requester_id
    AND status = 'pending'
    AND NOT public.is_blocked(addressee_id)
    AND NOT EXISTS (
      SELECT 1 FROM friendships f
      WHERE f.requester_id = friendships.addressee_id
        AND f.addressee_id = friendships.requester_id
    )
  );

DROP POLICY IF EXISTS friendships_update ON public.friendships;
CREATE POLICY friendships_update ON public.friendships
  FOR UPDATE TO authenticated
  USING (auth.uid() = addressee_id)
  WITH CHECK (auth.uid() = addressee_id);

DROP POLICY IF EXISTS friendships_delete ON public.friendships;
CREATE POLICY friendships_delete ON public.friendships
  FOR DELETE TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
