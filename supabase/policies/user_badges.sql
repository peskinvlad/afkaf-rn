-- Снимок RLS от 15.07.2026. Клиент-сайд выдача бейджей — принятый риск беты.
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_badges_select ON public.user_badges;
CREATE POLICY user_badges_select ON public.user_badges
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_badges_insert ON public.user_badges;
CREATE POLICY user_badges_insert ON public.user_badges
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
