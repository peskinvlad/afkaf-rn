-- 2026-11-14  feat/app-ping: анонимный пинг открытия приложения для метрик.
-- applied 2026-11-14 (через Supabase MCP). Этот файл приведён 1:1 к живой БД
-- (сверено pg_get_functiondef / information_schema / pg_constraint / pg_indexes).
--
-- Никакой сторонней аналитики, никаких координат и прочих личных данных —
-- только: анонимный device_id (случайный UUID с устройства), дата открытия
-- (по Asia/Jerusalem), платформа, версия приложения и (если вошёл) user_id.
--
-- Клиент НЕ имеет прав на таблицу (RLS включён, политик нет, REVOKE ALL). Запись —
-- только через SECURITY DEFINER RPC log_app_open, по одной строке на устройство в
-- день (ON CONFLICT DO NOTHING). user_id берётся из auth.uid() на сервере; у гостя
-- NULL. Функция молча выходит (return) на кривом вводе — битый пинг не падает.
--
-- Снапшоты этого изменения: supabase/tables.sql (DDL), supabase/policies/app_pings.sql
-- (RLS), supabase/functions/log_app_open.sql.
BEGIN;

-- ---------- app_pings (клиент: НИКАКИХ прав; пишет только RPC) ----------
CREATE TABLE public.app_pings (
  device_id   uuid        NOT NULL,
  day         date        NOT NULL,
  platform    text        NOT NULL,
  app_version text        NOT NULL,
  user_id     uuid        NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_pings_pkey PRIMARY KEY (device_id, day),
  CONSTRAINT app_pings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT app_pings_platform_check CHECK (platform = ANY (ARRAY['ios'::text, 'android'::text])),
  CONSTRAINT app_pings_app_version_check CHECK (char_length(app_version) >= 1 AND char_length(app_version) <= 20)
);
ALTER TABLE public.app_pings ENABLE ROW LEVEL SECURITY;

-- Отдельные (не-constraint) индексы под отчёты retention.sql.
CREATE INDEX app_pings_day_idx  ON public.app_pings (day);
CREATE INDEX app_pings_user_idx ON public.app_pings (user_id) WHERE user_id IS NOT NULL;

-- RLS включён, но НИ ОДНОЙ политики не создаём: при включённом RLS и отсутствии
-- политик обычные роли не читают и не пишут. Плюс явный REVOKE прав на таблицу.
REVOKE ALL ON public.app_pings FROM anon;
REVOKE ALL ON public.app_pings FROM authenticated;
REVOKE ALL ON public.app_pings FROM public;

-- ---------- log_app_open (единственная точка записи; SECURITY DEFINER) ----------
-- user_id = auth.uid() (NULL у гостя). day = сегодня по Asia/Jerusalem. Повторный
-- вызов за тот же день для того же устройства — no-op. Кривой ввод (null device,
-- чужая платформа, версия не 1..20 символов или не ^[0-9A-Za-z.-]+$) — тихий return.
CREATE OR REPLACE FUNCTION public.log_app_open(p_device_id uuid, p_platform text, p_app_version text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if p_device_id is null
     or p_platform not in ('ios','android')
     or p_app_version is null
     or char_length(p_app_version) not between 1 and 20
     or p_app_version !~ '^[0-9A-Za-z.\-]+$' then
    return;
  end if;
  insert into public.app_pings (device_id, day, platform, app_version, user_id)
  values (p_device_id, (now() at time zone 'Asia/Jerusalem')::date, p_platform, p_app_version, auth.uid())
  on conflict (device_id, day) do nothing;
end;
$function$;

REVOKE ALL ON FUNCTION public.log_app_open(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_app_open(uuid, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.log_app_open(uuid, text, text) TO authenticated;

COMMIT;


-- ============================================================================
-- ПРОВЕРОЧНЫЕ ЗАПРОСЫ (read-only, кроме смоук-теста). Запускать по одному.
-- ============================================================================

-- 1. Колонки/типы (ждём: app_version NOT NULL, user_id nullable).
-- select column_name, data_type, is_nullable
-- from information_schema.columns
-- where table_schema='public' and table_name='app_pings' order by ordinal_position;

-- 2. Constraints (ждём: pkey, fkey ON DELETE SET NULL, platform check, app_version len 1..20).
-- select conname, pg_get_constraintdef(oid)
-- from pg_constraint where conrelid='public.app_pings'::regclass order by conname;

-- 3. Индексы (ждём: pkey + app_pings_day_idx + app_pings_user_idx WHERE user_id IS NOT NULL).
-- select indexname, indexdef from pg_indexes
-- where schemaname='public' and tablename='app_pings' order by indexname;

-- 4. RLS включён, политик нет (ждём: relrowsecurity=true, 0 policies).
-- select relrowsecurity from pg_class where oid='public.app_pings'::regclass;
-- select policyname from pg_policies where schemaname='public' and tablename='app_pings';

-- 5. Табличных прав у клиентских ролей нет (ждём: 0 строк).
-- select grantee, privilege_type from information_schema.role_table_grants
-- where table_schema='public' and table_name='app_pings' and grantee in ('anon','authenticated');

-- 6. Функция: SECURITY DEFINER + search_path, EXECUTE у anon/authenticated.
-- select proname, prosecdef, proconfig from pg_proc where proname='log_app_open';
-- select r.rolname, has_function_privilege(r.rolname,'public.log_app_open(uuid,text,text)','EXECUTE')
-- from pg_roles r where r.rolname in ('anon','authenticated');

-- 7. Смоук-тест (ПИШЕТ строку и удаляет). Второй вызов — no-op, count=1.
-- select public.log_app_open('00000000-0000-0000-0000-000000000001'::uuid, 'ios', '0.2.0');
-- select public.log_app_open('00000000-0000-0000-0000-000000000001'::uuid, 'ios', '0.2.0');
-- select count(*) as should_be_1, max(user_id) as should_be_null
-- from app_pings where device_id='00000000-0000-0000-0000-000000000001';
-- delete from app_pings where device_id='00000000-0000-0000-0000-000000000001';
