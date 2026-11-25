-- 2026-11-23  feat/app-events: продуктовые события для воронки.
-- applied 2026-11-23 (через Supabase MCP, после «ок» Влада). Файл = живая БД.
--
-- Тот же образец, что app_pings: анонимный device_id, user_id из auth.uid()
-- (NULL у гостя), клиент таблицу не читает и не пишет напрямую — только через
-- SECURITY DEFINER RPC log_event. Никаких координат и личных данных в props
-- (проверяет клиент, lib/analytics.ts; сервер режет размер ≤1 КБ).
-- Снапшоты: supabase/tables.sql, supabase/policies/app_events.sql,
-- supabase/functions/log_event.sql. Отчёт: supabase/queries/funnel.sql.
CREATE TABLE public.app_events (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  device_id   uuid        NOT NULL,
  user_id     uuid        NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  name        text        NOT NULL,
  props       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  platform    text        NOT NULL,
  app_version text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_events_name_check CHECK (name ~ '^[a-z][a-z0-9_]{1,39}$'),
  CONSTRAINT app_events_platform_check CHECK (platform IN ('ios','android')),
  CONSTRAINT app_events_app_version_check CHECK (char_length(app_version) BETWEEN 1 AND 20),
  CONSTRAINT app_events_props_check CHECK (jsonb_typeof(props) = 'object' AND pg_column_size(props) <= 1024)
);
ALTER TABLE public.app_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX app_events_device_time_idx ON public.app_events (device_id, created_at);
CREATE INDEX app_events_name_time_idx   ON public.app_events (name, created_at);
CREATE INDEX app_events_user_idx        ON public.app_events (user_id) WHERE user_id IS NOT NULL;
REVOKE ALL ON public.app_events FROM anon, authenticated, public;

CREATE OR REPLACE FUNCTION public.log_event(p_device_id uuid, p_name text, p_props jsonb, p_platform text, p_app_version text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_props jsonb := coalesce(p_props, '{}'::jsonb);
begin
  if p_device_id is null
     or p_name is null or p_name !~ '^[a-z][a-z0-9_]{1,39}$'
     or p_platform not in ('ios','android')
     or p_app_version is null
     or char_length(p_app_version) not between 1 and 20
     or p_app_version !~ '^[0-9A-Za-z.\-]+$'
     or jsonb_typeof(v_props) <> 'object'
     or pg_column_size(v_props) > 1024 then
    return;
  end if;
  -- защита от мусора: не больше 300 событий на устройство за час
  if (select count(*) from public.app_events
      where device_id = p_device_id and created_at > now() - interval '1 hour') >= 300 then
    return;
  end if;
  insert into public.app_events (device_id, user_id, name, props, platform, app_version)
  values (p_device_id, auth.uid(), p_name, v_props, p_platform, p_app_version);
end;
$function$;

REVOKE ALL ON FUNCTION public.log_event(uuid, text, jsonb, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_event(uuid, text, jsonb, text, text) TO anon, authenticated;
