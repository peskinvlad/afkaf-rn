-- ============================================================
-- friendships-guard.sql  (run once in Supabase SQL Editor)
--
-- Ужесточение RLS на public.friendships по внешнему аудиту.
--   INSERT: только заявка от себя (requester_id = auth.uid()) и только в
--           статусе 'pending'; сохраняем анти-дубль обратной пары.
--   UPDATE: только адресат (addressee_id = auth.uid()); менять можно лишь
--           status — requester_id/addressee_id неизменны. Иммутабельность
--           колонок нельзя выразить в WITH CHECK (видит только NEW-строку),
--           поэтому — BEFORE UPDATE триггер, сравнивающий OLD и NEW.
-- SELECT / DELETE политики не трогаем.
-- ============================================================

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- INSERT — своя заявка, только 'pending', без обратного дубля
DROP POLICY IF EXISTS friendships_insert ON public.friendships;
CREATE POLICY friendships_insert ON public.friendships
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = requester_id
    AND status = 'pending'
    AND NOT EXISTS (
      SELECT 1 FROM friendships f
      WHERE f.requester_id = friendships.addressee_id
        AND f.addressee_id = friendships.requester_id
    )
  );

-- UPDATE — только адресат (иммутабельность сторон пинит триггер ниже)
DROP POLICY IF EXISTS friendships_update ON public.friendships;
CREATE POLICY friendships_update ON public.friendships
  FOR UPDATE TO authenticated
  USING (auth.uid() = addressee_id)
  WITH CHECK (auth.uid() = addressee_id);

-- requester_id / addressee_id неизменны при любом UPDATE
CREATE OR REPLACE FUNCTION public.friendships_guard_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.requester_id IS DISTINCT FROM OLD.requester_id
     OR NEW.addressee_id IS DISTINCT FROM OLD.addressee_id THEN
    RAISE EXCEPTION 'friendships: requester_id/addressee_id are immutable'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS friendships_guard_update ON public.friendships;
CREATE TRIGGER friendships_guard_update
  BEFORE UPDATE ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.friendships_guard_update();
