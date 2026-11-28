-- Applied to the live DB on 2026-11-25 (Supabase migration profiles_update_columns_lockdown).
-- Snapshot: supabase/policies/profiles.sql. No rows changed.
REVOKE UPDATE ON TABLE public.profiles FROM anon, authenticated;
GRANT UPDATE (id, display_name, language) ON TABLE public.profiles TO authenticated;
