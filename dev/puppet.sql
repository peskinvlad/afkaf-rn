-- ============================================================
-- dev/puppet.sql — «кукла» для теста nearby-механик
-- НЕ выполняется приложением. Запускать вручную блоками в
-- Supabase SQL Editor (service role → RLS обходится, это ок для dev).
--
-- Схема active_walks (по supabase/archive/active_walks.sql +
-- active_walks_visibility.sql + active_walks_distance_snapshot.sql):
--   id          uuid PK default gen_random_uuid()
--   user_id     uuid NOT NULL FK auth.users(id), UNIQUE
--   dog_id      uuid NULL FK dogs(id)
--   lat, lng    double precision NOT NULL
--   started_at  timestamptz NOT NULL default now()
--   updated_at  timestamptz NOT NULL default now()  -- SELECT-политика режет строки старше 30 мин
--   visibility  text NOT NULL default 'everyone'
--               CHECK (visibility IN ('everyone','friends'))  -- ВАЖНО: 'nobody' в таблицу не пишется!
--   distance_km double precision NOT NULL default 0
-- ============================================================


-- ── Блок A: найти uuid второго аккаунта по email ─────────────────────────────
-- profiles: id (= auth.users.id), display_name — email там нет, ищем в auth.users.
SELECT u.id, u.email, p.display_name
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE u.email = 'PUPPET_EMAIL_HERE';  -- ← email второго аккаунта


-- ── Блок B: кукла «гуляет рядом» ─────────────────────────────────────────────
-- Подставь: PUPPET_UUID из блока A; :lat, :lng — координаты рядом с тобой
-- (в пределах 2 км, useNearbyDogs фильтрует по RADIUS_KM = 2).
-- dog_id берём первой собакой куклы (NULL, если собак нет — вполне валидно,
-- но NearbyDogsSheet показывает только строки с собакой: dogs != null).
-- ON CONFLICT (user_id) — та же upsert-семантика, что у клиента.
INSERT INTO public.active_walks
  (user_id, dog_id, lat, lng, distance_km, visibility, started_at, updated_at)
VALUES (
  'PUPPET_UUID',                                                   -- ← из блока A
  (SELECT id FROM public.dogs WHERE owner_id = 'PUPPET_UUID' LIMIT 1),
  32.05590,                                                        -- ← :lat
  34.77220,                                                        -- ← :lng
  0.4,
  'everyone',
  now() - interval '5 minutes',
  now()                                                            -- свежий пинг: строка видима (< 30 мин)
)
ON CONFLICT (user_id) DO UPDATE SET
  dog_id      = EXCLUDED.dog_id,
  lat         = EXCLUDED.lat,
  lng         = EXCLUDED.lng,
  distance_km = EXCLUDED.distance_km,
  visibility  = EXCLUDED.visibility,
  updated_at  = now();

-- Повторный «пинг» без пересоздания (обновить свежесть/позицию):
-- UPDATE public.active_walks
-- SET lat = 32.05590, lng = 34.77220, updated_at = now()   -- ← :lat, :lng
-- WHERE user_id = 'PUPPET_UUID';


-- ── Блок C: смена visibility куклы ───────────────────────────────────────────
-- Режимы теста:
--   'everyone' — куклу видят все (должна появиться в NearbyDogsSheet);
--   'friends'  — только accepted-друзья; без дружбы попадает в
--                get_hidden_walks_count (счётчик скрытых);
--   'nobody'   — В ТАБЛИЦУ НЕ ПИШЕТСЯ (CHECK не пропустит): приложение в этом
--                режиме просто не создаёт строку → эмулируется блоком D (delete).
UPDATE public.active_walks
SET visibility = 'everyone',   -- ← или 'friends'
    updated_at = now()
WHERE user_id = 'PUPPET_UUID';


-- ── Блок D: очистка ──────────────────────────────────────────────────────────
-- Убрать куклу с карты (она же — эмуляция режима 'nobody').
DELETE FROM public.active_walks
WHERE user_id = 'PUPPET_UUID';
