-- Снимок от 2026-09-14. Триггерная функция friendships_guard_update
-- (BEFORE UPDATE на public.friendships). Триггер — в supabase/triggers.sql.
-- Применяемый скрипт — docs/sql/friendships-guard.sql.
--
-- Пинит иммутабельность сторон дружбы: requester_id и addressee_id нельзя
-- изменить при UPDATE (RLS WITH CHECK видит только NEW-строку и такое выразить
-- не может). Адресат по политике friendships_update меняет только status.
CREATE OR REPLACE FUNCTION public.friendships_guard_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.requester_id IS DISTINCT FROM OLD.requester_id
     OR NEW.addressee_id IS DISTINCT FROM OLD.addressee_id THEN
    RAISE EXCEPTION 'friendships: requester_id/addressee_id are immutable'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$function$;
