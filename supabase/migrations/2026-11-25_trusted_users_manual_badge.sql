-- Applied to the live DB on 2026-11-25 (Supabase migration trusted_users_manual_badge).
-- Manual "trusted" badge. A separate table (not a profiles column) because
-- profiles rows are owner-updatable: a column there could be self-set by any user.
-- No client access: RLS on, no policies, no grants; read only via get_trust_status.
-- Granting the badge = INSERT a row here by the curator (SQL editor / service_role).
CREATE TABLE public.trusted_users (
  user_id    uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  granted_at timestamptz NOT NULL DEFAULT now(),
  note       text
);
ALTER TABLE public.trusted_users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.trusted_users FROM PUBLIC, anon, authenticated;
-- get_trust_status body: see supabase/functions/get_trust_status.sql
