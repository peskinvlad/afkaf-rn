-- Снимок от 2026-11-14 (fix/security-1). Триггерная функция для reports.
-- BEFORE INSERT: сервер сам выставляет status='open' и created_at=now(), даже
-- если клиент прислал свои значения (их перезаписываем). Клиент через RLS и так
-- может только INSERT своей строки, но дефолты фиксируем на сервере, а не
-- полагаемся на DEFAULT столбца. Триггер — в supabase/triggers.sql.
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
