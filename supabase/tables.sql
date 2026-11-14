-- Снимок DDL таблиц public-схемы (источник правды).
-- Сгенерировано из ЖИВОЙ БД 2026-09-10 через Supabase MCP (read-only):
-- information_schema.columns + pg_constraint/pg_get_constraintdef. НЕ реконструкция из кода.
--
-- ПРАВИЛО: обновляется тем же коммитом после каждого ручного SQL
-- (CREATE/ALTER TABLE, колонки, defaults, constraints).
--
-- Область файла — только таблицы/колонки/constraints public-схемы. Смежные снимки:
--   RLS-политики — policies/*.sql, функции — functions/*.sql, триггеры — triggers.sql.
-- Не покрыто здесь: отдельные (не-constraint) индексы, comment'ы, grants, RLS.
-- FK на auth.users(id) — на чужую (auth) схему Supabase.
--
-- Гранты (не в области файла, но для справки): fix/security-1 2026-11-14 отозвал
-- TRUNCATE у anon/authenticated на ВСЕХ таблицах public и закрыл rpc_rate_limit
-- целиком (таблица + EXECUTE функции) у клиентских ролей. Полный скрипт —
-- migrations/2026-11-14_security_hardening.sql.

-- ============================================================
-- profiles  (id = auth.users.id)
-- ============================================================
CREATE TABLE public.profiles (
  id            uuid        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  display_name  text        NOT NULL,
  language      text        NOT NULL DEFAULT 'he'::text,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT profiles_display_name_len CHECK (display_name IS NULL OR length(display_name) <= 50)
);

-- ============================================================
-- dogs
-- ============================================================
CREATE TABLE public.dogs (
  id           uuid        NOT NULL DEFAULT gen_random_uuid(),
  owner_id     uuid        NOT NULL,
  name         text        NOT NULL,
  breed        text        NULL,
  sociability  text        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  age          text        NULL,
  weight       text        NULL,
  gender       text        NULL,
  neutered     boolean     NULL,
  icon         text        NULL,
  photo_url    text        NULL,
  owner_name   text        NULL,
  birth_date        date    NULL,                 -- дата рождения; при approx=true значащие только год+месяц (день=1)
  birth_date_approx boolean NOT NULL DEFAULT false, -- true = «примерно» (месяц+год); false = точная дата
  CONSTRAINT dogs_pkey PRIMARY KEY (id),
  CONSTRAINT dogs_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT dogs_name_len CHECK (name IS NULL OR length(name) <= 50),
  CONSTRAINT dogs_breed_len CHECK (breed IS NULL OR length(breed) <= 50),
  CONSTRAINT dogs_owner_name_len CHECK (owner_name IS NULL OR length(owner_name) <= 50),
  CONSTRAINT dogs_sociability_check CHECK (sociability = ANY (ARRAY['friendly'::text, 'neutral'::text, 'reactive'::text]))
);

-- ============================================================
-- markers
-- ============================================================
CREATE TABLE public.markers (
  id             uuid        NOT NULL DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL,
  type           text        NOT NULL,
  lat            double precision NOT NULL,
  lng            double precision NOT NULL,
  description    text        NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  expires_at     timestamptz NULL,
  confirmations  integer     NOT NULL DEFAULT 0,
  denials        integer     NOT NULL DEFAULT 0,
  CONSTRAINT markers_pkey PRIMARY KEY (id),
  CONSTRAINT markers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT markers_description_len CHECK (description IS NULL OR length(description) <= 500),
  CONSTRAINT markers_type_check CHECK (type = ANY (ARRAY['park'::text, 'water'::text, 'danger'::text, 'hazard'::text, 'aggressive_dog'::text, 'forbidden'::text, 'dog_park'::text, 'food'::text]))
);

-- ============================================================
-- marker_votes
-- ============================================================
CREATE TABLE public.marker_votes (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  marker_id   uuid        NOT NULL,
  user_id     uuid        NOT NULL,
  vote        text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marker_votes_pkey PRIMARY KEY (id),
  CONSTRAINT marker_votes_marker_id_user_id_key UNIQUE (marker_id, user_id),
  CONSTRAINT marker_votes_marker_id_fkey FOREIGN KEY (marker_id) REFERENCES public.markers(id) ON DELETE CASCADE,
  CONSTRAINT marker_votes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT marker_votes_vote_check CHECK (vote = ANY (ARRAY['still_there'::text, 'gone'::text]))
);

-- ============================================================
-- friendships
-- ============================================================
CREATE TABLE public.friendships (
  id            uuid        NOT NULL DEFAULT gen_random_uuid(),
  requester_id  uuid        NOT NULL,
  addressee_id  uuid        NOT NULL,
  status        text        NOT NULL,
  created_at    timestamptz NULL DEFAULT now(),
  updated_at    timestamptz NULL DEFAULT now(),
  CONSTRAINT friendships_pkey PRIMARY KEY (id),
  CONSTRAINT friendships_requester_id_addressee_id_key UNIQUE (requester_id, addressee_id),
  CONSTRAINT friendships_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT friendships_addressee_id_fkey FOREIGN KEY (addressee_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT friendships_status_check CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text])),
  CONSTRAINT friendships_check CHECK (requester_id <> addressee_id)
);

-- ============================================================
-- active_walks
-- ============================================================
CREATE TABLE public.active_walks (
  id           uuid        NOT NULL DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL,
  dog_id       uuid        NULL,
  lat          double precision NOT NULL,
  lng          double precision NOT NULL,
  started_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  visibility   text        NOT NULL DEFAULT 'everyone'::text,
  distance_km  double precision NOT NULL DEFAULT 0,
  CONSTRAINT active_walks_pkey PRIMARY KEY (id),
  CONSTRAINT active_walks_user_id_key UNIQUE (user_id),
  CONSTRAINT active_walks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT active_walks_dog_id_fkey FOREIGN KEY (dog_id) REFERENCES public.dogs(id) ON DELETE SET NULL,
  CONSTRAINT active_walks_visibility_check CHECK (visibility = ANY (ARRAY['everyone'::text, 'friends'::text]))
);

-- ============================================================
-- walk_history
-- ============================================================
CREATE TABLE public.walk_history (
  id            uuid        NOT NULL DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL,
  distance_km   double precision NOT NULL,
  duration_min  integer     NOT NULL,
  started_at    timestamptz NOT NULL,
  dog_id        uuid        NULL,
  ended_at      timestamptz NULL,
  duration_s    integer     NULL,
  steps         integer     NULL,
  path          jsonb       NULL,
  is_valid      boolean     NOT NULL DEFAULT true,
  CONSTRAINT walk_history_pkey PRIMARY KEY (id),
  CONSTRAINT walk_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT walk_history_dog_id_fkey FOREIGN KEY (dog_id) REFERENCES public.dogs(id) ON DELETE SET NULL
);

-- ============================================================
-- user_badges
-- ============================================================
CREATE TABLE public.user_badges (
  id         uuid        NOT NULL DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL,
  badge_id   text        NOT NULL,
  earned_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_badges_pkey PRIMARY KEY (id),
  CONSTRAINT user_badges_user_id_badge_id_key UNIQUE (user_id, badge_id),
  CONSTRAINT user_badges_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- ============================================================
-- water_sources
-- ============================================================
CREATE TABLE public.water_sources (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  osm_id      text        NULL,
  lat         double precision NULL,
  lng         double precision NULL,
  amenity     text        NULL,
  dog_bowl    boolean     NULL,
  created_at  timestamptz NULL DEFAULT now(),
  CONSTRAINT water_sources_pkey PRIMARY KEY (id)
);
-- NB: есть отдельный UNIQUE INDEX water_sources_osm_id_key (osm_id) — добавлен
-- 2026-09-15 для дедупа OSM-импорта (ON CONFLICT (osm_id)). Индексы этот файл
-- не фиксирует; источник правды — supabase/migrations/2026-09-15_dog_park_food_osm.sql.

-- ============================================================
-- waitlist
-- ============================================================
CREATE TABLE public.waitlist (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  district    text        NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT waitlist_pkey PRIMARY KEY (id)
);

-- ============================================================
-- park_checkins  (добавлена 2026-09-29, feat/park-checkin)
-- ============================================================
-- Чек-ин на собачьих площадках. Строки не удаляются (история для сводки района):
-- чек-ин закрывается через ended_at + end_reason. Писать — только через
-- SECURITY DEFINER RPC (functions/park_checkin.sql, park_checkout.sql),
-- читать чужое — только через functions/get_park_presence.sql.
CREATE TABLE public.park_checkins (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL,
  marker_id   uuid        NOT NULL,
  started_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL DEFAULT (now() + '02:00:00'::interval),
  ended_at    timestamptz NULL,
  manual      boolean     NOT NULL DEFAULT false,
  end_reason  text        NULL,
  CONSTRAINT park_checkins_pkey PRIMARY KEY (id),
  CONSTRAINT park_checkins_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT park_checkins_marker_id_fkey FOREIGN KEY (marker_id) REFERENCES public.markers(id),
  CONSTRAINT park_checkins_end_reason_check CHECK (end_reason IS NULL OR end_reason = ANY (ARRAY['left'::text, 'walk_end'::text, 'expired'::text, 'switched'::text])),
  CONSTRAINT park_checkins_ended_consistency CHECK ((ended_at IS NULL) = (end_reason IS NULL)),
  CONSTRAINT park_checkins_expires_after_start CHECK (expires_at > started_at)
);
-- NB: индексы (этот файл их обычно не фиксирует, но здесь на них держится логика):
--   UNIQUE INDEX park_checkins_one_open_per_user ON (user_id) WHERE ended_at IS NULL
--     — не больше одного открытого чек-ина на пользователя;
--   INDEX park_checkins_open_by_marker ON (marker_id) WHERE ended_at IS NULL.

-- ============================================================
-- blocks  (добавлена 2026-11-04, feat/moderation)
-- ============================================================
-- Взаимная блокировка пользователей (UGC-требование Google Play). Запись —
-- ТОЛЬКО через SECURITY DEFINER RPC block_user/unblock_user (чтобы блок атомарно
-- рвал дружбу); клиент имеет лишь SELECT своих строк (policies/blocks.sql).
-- Сокрытие в обе стороны считает public.is_blocked (functions/is_blocked.sql).
CREATE TABLE public.blocks (
  blocker_id  uuid        NOT NULL,
  blocked_id  uuid        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blocks_pkey PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT blocks_not_self CHECK (blocker_id <> blocked_id),
  CONSTRAINT blocks_blocker_id_fkey FOREIGN KEY (blocker_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT blocks_blocked_id_fkey FOREIGN KEY (blocked_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- ============================================================
-- reports  (добавлена 2026-11-04, feat/moderation)
-- ============================================================
-- Жалобы на контент/людей (UGC-требование Google Play). Клиент: INSERT от своего
-- имени + SELECT только своих (policies/reports.sql). Триаж — через Dashboard
-- (supabase/queries/open-reports.sql). target_id — markers.id или profiles.id
-- в зависимости от target_type; FK на них НЕ ставим (две разные цели в одной
-- колонке), целостность — на уровне приложения.
CREATE TABLE public.reports (
  id           uuid        NOT NULL DEFAULT gen_random_uuid(),
  reporter_id  uuid        NOT NULL,
  target_type  text        NOT NULL,
  target_id    uuid        NOT NULL,
  reason       text        NOT NULL,
  comment      text        NULL,
  status       text        NOT NULL DEFAULT 'open',
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reports_pkey PRIMARY KEY (id),
  CONSTRAINT reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT reports_target_type_check CHECK (target_type = ANY (ARRAY['marker'::text, 'user'::text])),
  CONSTRAINT reports_reason_check CHECK (reason = ANY (ARRAY['missing'::text, 'wrong_location'::text, 'wrong_type'::text, 'inappropriate'::text, 'spam'::text, 'harassment'::text, 'impersonation'::text, 'dangerous'::text, 'other'::text])),
  CONSTRAINT reports_comment_check CHECK (comment IS NULL OR length(comment) <= 1000),
  CONSTRAINT reports_status_check CHECK (status = ANY (ARRAY['open'::text, 'reviewed'::text, 'dismissed'::text]))
);
-- NB: частичный уникальный индекс (на нём держится защита от дублей):
--   UNIQUE INDEX reports_one_open_per_target ON (reporter_id, target_type, target_id)
--     WHERE status = 'open' — одна открытая жалоба на цель от юзера; повтор даёт
--     23505, клиент показывает то же «спасибо».

-- ============================================================
-- app_pings  (feat/app-ping, применено 2026-11-14)
-- Анонимный пинг открытия приложения: одна строка на устройство в день.
-- Пишет только RPC log_app_open (SECURITY DEFINER); клиент прав не имеет.
-- ============================================================
CREATE TABLE public.app_pings (
  device_id    uuid        NOT NULL,
  day          date        NOT NULL,
  platform     text        NOT NULL,
  app_version  text        NOT NULL,
  user_id      uuid        NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_pings_pkey PRIMARY KEY (device_id, day),
  CONSTRAINT app_pings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT app_pings_platform_check CHECK (platform = ANY (ARRAY['ios'::text, 'android'::text])),
  CONSTRAINT app_pings_app_version_check CHECK (char_length(app_version) >= 1 AND char_length(app_version) <= 20)
);
-- NB: отдельные индексы (вне области этого файла по правилу выше, но важны):
--   CREATE INDEX app_pings_day_idx  ON (day);
--   CREATE INDEX app_pings_user_idx ON (user_id) WHERE user_id IS NOT NULL;
--   regex-валидация app_version ^[0-9A-Za-z.-]+$ — в функции log_app_open, не в таблице.
