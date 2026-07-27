-- Снимок от 15.07.2026. Триггер on_auth_user_created (auth.users, AFTER INSERT).
-- left(...,50) — защита от CHECK profiles.display_name при длинном OAuth-имени.
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(
      coalesce(
        new.raw_user_meta_data->>'full_name',
        new.raw_user_meta_data->>'name',
        'User'
      ),
      50
    )
  );
  return new;
end;
$function$;
