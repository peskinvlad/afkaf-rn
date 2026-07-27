-- Снимок RLS от 15.07.2026. Анонимный INSERT — by design (запись в ожидание).
-- Принятый варнинг Advisor №1.
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert waitlist" ON public.waitlist;
CREATE POLICY "Anyone can insert waitlist" ON public.waitlist
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);
