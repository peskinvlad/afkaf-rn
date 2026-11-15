-- 2026-11-14  fix/security-1: догоняющее укрепление доступа перед релизом 1.0.
-- applied 2026-11-14 (через Supabase MCP). Файл приведён к состоянию живой БД
-- (сверено pg_get_functiondef / pg_get_triggerdef / information_schema /
-- storage.buckets). Снапшоты обновлены тем же коммитом:
--   functions/log_app_open.sql, functions/rpc_rate_limit.sql,
--   functions/reports_force_defaults.sql, triggers.sql, policies/reports.sql,
--   tables.sql (заметка о REVOKE TRUNCATE). Бакет dog-photos — см. п.5 ниже
--   (отдельного снимка storage в supabase/ нет).
BEGIN;

-- 1. Отзыв TRUNCATE у клиентских ролей на ВСЕХ таблицах public. TRUNCATE не-
--    владельцу и так недоступен по умолчанию — это belt-and-suspenders против
--    унаследованных грантов. Идемпотентно.
DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT format('%I.%I', schemaname, tablename) AS rel
    FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('REVOKE TRUNCATE ON %s FROM anon, authenticated', t.rel);
  END LOOP;
END $$;

-- 2. rpc_rate_limit — строго внутренняя (вызывается только из других SECURITY
--    DEFINER функций). Закрываем и таблицу, и прямой EXECUTE функции клиенту.
REVOKE ALL ON public.rpc_rate_limit FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.rpc_rate_limit(text, integer, interval)
  FROM anon, authenticated, public;

-- 3. reports: серверные дефолты status/created_at на вставке. Даже если клиент
--    пришлёт свои значения — перезапишем (status всегда 'open', created_at=now()).
CREATE OR REPLACE FUNCTION public.reports_force_defaults()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.status := 'open';
  new.created_at := now();
  return new;
end;
$function$;

DROP TRIGGER IF EXISTS reports_force_defaults ON public.reports;
CREATE TRIGGER reports_force_defaults
  BEFORE INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.reports_force_defaults();

-- 4. log_app_open: защита от NULL p_platform. Без coalesce `null not in (...)`
--    даёт NULL (не true) → ранний return мог не сработать, и в INSERT уходил бы
--    NULL platform (нарушение NOT NULL/CHECK). Остальное тело без изменений.
CREATE OR REPLACE FUNCTION public.log_app_open(p_device_id uuid, p_platform text, p_app_version text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if p_device_id is null
     or coalesce(p_platform, '') not in ('ios','android')
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

COMMIT;

-- 5. Storage-бакет dog-photos (настроено через Storage API, не SQL — фиксируем
--    здесь, отдельного supabase/storage.sql нет):
--      public             = true
--      file_size_limit    = 5242880   -- 5 МБ
--      allowed_mime_types = {image/jpeg, image/jpg, image/png, image/webp, image/heic, image/heif}
--    Клиент (DogProfileScreen) теперь шлёт contentType по реальному типу файла.
--    'image/jpg' добавлен 2026-11-14 как совместимость для СТАРЫХ сборок, которые
--    для .jpg всё ещё слали несуществующий MIME image/jpg (новые шлют image/jpeg).
