-- Снимок RLS от 2026-11-04 (feat/moderation). Идемпотентно.
-- Клиент видит ТОЛЬКО свои строки блокировки (для экрана «Заблокированные» имена
-- отдаёт отдельная RPC get_my_blocks). Write-политик НЕТ by design: INSERT/DELETE
-- идут только через SECURITY DEFINER RPC block_user / unblock_user — чтобы блок
-- атомарно рвал дружбу, а прямой INSERT этого бы не делал.
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS blocks_select ON public.blocks;
CREATE POLICY blocks_select ON public.blocks
  FOR SELECT TO authenticated
  USING (blocker_id = auth.uid());

-- Гранты: у authenticated только SELECT (+ дефолтные для Supabase REFERENCES/TRIGGER);
-- у anon — ничего. Запись — исключительно через block_user/unblock_user.
REVOKE ALL ON public.blocks FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.blocks FROM authenticated;
GRANT SELECT ON public.blocks TO authenticated;
