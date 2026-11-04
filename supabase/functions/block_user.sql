-- Снимок от 2026-11-04 (feat/moderation). Единственный путь записи в blocks
-- (таблица без INSERT-политики). SECURITY DEFINER: пишет blocks и удаляет дружбу
-- под правами владельца. Блок атомарно рвёт дружбу/заявки в ОБЕ стороны — поэтому
-- прямой клиентский INSERT в blocks закрыт (иначе дружба осталась бы висеть).
-- PT401 — не авторизован, PT400 — попытка заблокировать себя.
-- Гранты: REVOKE PUBLIC/anon, GRANT authenticated.
CREATE OR REPLACE FUNCTION public.block_user(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'PT401', MESSAGE = 'not_authenticated';
  END IF;
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION USING ERRCODE = 'PT400', MESSAGE = 'cannot_block_self';
  END IF;

  INSERT INTO blocks (blocker_id, blocked_id)
  VALUES (auth.uid(), p_user_id)
  ON CONFLICT DO NOTHING;

  -- блок рвёт дружбу в обе стороны (и удаляет любые заявки между нами)
  DELETE FROM friendships
  WHERE (requester_id = auth.uid() AND addressee_id = p_user_id)
     OR (requester_id = p_user_id  AND addressee_id = auth.uid());
END;
$function$;

REVOKE ALL ON FUNCTION public.block_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.block_user(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.block_user(uuid) TO authenticated;
