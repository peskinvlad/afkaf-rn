-- Снимок от 2026-11-23 (feat/app-events). Единственная точка записи в app_events.
-- SECURITY DEFINER; user_id = auth.uid() (NULL у гостя). Кривой ввод — тихий return.
-- Анти-мусор: ≤300 событий на device_id за час. Гранты: REVOKE PUBLIC, GRANT anon + authenticated.
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
