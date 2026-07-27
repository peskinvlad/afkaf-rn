-- Снимок от 15.07.2026. Триггер trg_friendships_set_updated_at (friendships, BEFORE UPDATE).
CREATE OR REPLACE FUNCTION public.friendships_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;
