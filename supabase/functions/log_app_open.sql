-- Снимок от 2026-11-14 (feat/app-ping). Единственная точка записи в app_pings
-- (таблица без политик и без клиентских прав). SECURITY DEFINER.
-- user_id берётся из auth.uid() на сервере (NULL у гостя) — клиент его не шлёт и
-- подменить не может. day = сегодня по Asia/Jerusalem. Повтор за день — no-op
-- (ON CONFLICT DO NOTHING). Кривой ввод (null device, чужая платформа, версия не
-- 1..20 символов или не ^[0-9A-Za-z.-]+$) — тихий return, без исключения.
-- Гранты: REVOKE PUBLIC, GRANT anon + authenticated (пинг шлют и гости).
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
