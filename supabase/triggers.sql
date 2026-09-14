-- Снимок пользовательских триггеров от 15.07.2026 (information_schema.triggers).
-- Системные триггеры realtime/storage не фиксируются.
-- Дубль trigger_extend_marker_expiry (INSERT OR UPDATE) снесён 15.07.2026.

DROP TRIGGER IF EXISTS trg_extend_marker_expiry ON public.marker_votes;
CREATE TRIGGER trg_extend_marker_expiry
  AFTER INSERT ON public.marker_votes
  FOR EACH ROW EXECUTE FUNCTION public.extend_marker_expiry();

DROP TRIGGER IF EXISTS trg_friendships_set_updated_at ON public.friendships;
CREATE TRIGGER trg_friendships_set_updated_at
  BEFORE UPDATE ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.friendships_set_updated_at();

-- Добавлен 2026-09-14 (docs/sql/friendships-guard.sql). Пинит иммутабельность
-- requester_id/addressee_id при UPDATE (функция — functions/friendships_guard_update.sql).
DROP TRIGGER IF EXISTS friendships_guard_update ON public.friendships;
CREATE TRIGGER friendships_guard_update
  BEFORE UPDATE ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.friendships_guard_update();

-- Добавлен 2026-09-13. Rate-limit + серверные created_at/expires_at на вставке
-- меток пользователями приложения (функция — functions/markers_guard_insert.sql).
DROP TRIGGER IF EXISTS markers_guard_insert ON public.markers;
CREATE TRIGGER markers_guard_insert
  BEFORE INSERT ON public.markers
  FOR EACH ROW EXECUTE FUNCTION public.markers_guard_insert();

-- auth.users — чужая схема, пересоздание может требовать прав supabase_admin.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- EVENT TRIGGER: страж RLS (снимок pg_event_trigger от 15.07.2026).
-- Автовключение RLS на каждой новой таблице в public — причина rowsecurity=true везде.
-- Системные event triggers Supabase (pgrst_*, issue_*) не фиксируются.
DROP EVENT TRIGGER IF EXISTS ensure_rls;
CREATE EVENT TRIGGER ensure_rls
  ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  EXECUTE FUNCTION public.rls_auto_enable();
