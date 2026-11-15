-- 2026-11-04  feat/moderation (заход Б): сузить active_walks_select — убрать прямой
-- доступ не-друзей к сырым координатам 'everyone'-прогулок. Применять ПОСЛЕ
-- 2026-11-04_moderation.sql. Применено на живой БД 2026-11-04 через Supabase MCP.
-- Снапшот обновлён тем же коммитом → supabase/policies/active_walks.sql.
--
-- Было (после moderation-миграции): чужую строку видел любой при visibility='everyone'
-- → прямой select в обход округления get_nearby_walks выдавал точные lat/lng.
-- Стало: чужая строка видна ТОЛЬКО принятым друзьям (им точные координаты и так
-- положены). 'everyone'-незнакомцам точные координаты отдаёт лишь get_nearby_walks
-- (round ~111 м). Закрывает security backlog «Квантование координат для everyone».
--
-- Безопасно: все читатели active_walks в БД — SECURITY DEFINER (get_nearby_walks/
-- get_user_previews/get_park_presence/get_hidden_walks_count/park_checkin), RLS
-- обходят; realtime-подписок/вью/триггеров на active_walks нет; клиент (iOS и
-- exp/android) читает чужое только через get_nearby_walks, свою строку — по
-- user_id=self. visibility IN ('friends','everyone') оставлено явным на случай
-- будущего 'nobody' (сейчас CHECK допускает только эти два значения).
BEGIN;

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

COMMIT;
