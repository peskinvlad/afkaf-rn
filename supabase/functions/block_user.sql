-- Снимок от 2026-11-04 (feat/moderation); обновлён 2026-11-14 (markers_privacy_step1).
-- Единственный путь записи в blocks (таблица без INSERT-политики). SECURITY DEFINER:
-- пишет blocks и удаляет дружбу под правами владельца. Блок атомарно рвёт дружбу/
-- заявки в ОБЕ стороны — поэтому прямой клиентский INSERT в blocks закрыт.
-- 2026-11-14 (№2): перед вставкой снимаем имя/иконку в blocked_name/blocked_avatar
--   ТОЛЬКО если человек СЕЙЧАС виден мне через get_user_previews (после вставки он
--   уже скрыт). Не виден → NULL → get_my_blocks/клиент покажут «Пользователь».
-- PT401 — не авторизован, PT400 — попытка заблокировать себя.
-- Гранты: REVOKE PUBLIC/anon, GRANT authenticated.
CREATE OR REPLACE FUNCTION public.block_user(p_user_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v_name text; v_avatar text;
begin
  if auth.uid() is null then
    raise exception using errcode = 'PT401', message = 'not_authenticated';
  end if;
  if p_user_id = auth.uid() then
    raise exception using errcode = 'PT400', message = 'cannot_block_self';
  end if;
  select up.display_name, up.dog_avatar into v_name, v_avatar
  from public.get_user_previews(array[p_user_id]) up limit 1;
  insert into blocks (blocker_id, blocked_id, blocked_name, blocked_avatar)
  values (auth.uid(), p_user_id, v_name, v_avatar)
  on conflict do nothing;
  delete from friendships
  where (requester_id = auth.uid() and addressee_id = p_user_id)
     or (requester_id = p_user_id and addressee_id = auth.uid());
end;
$function$;

REVOKE ALL ON FUNCTION public.block_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.block_user(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.block_user(uuid) TO authenticated;
