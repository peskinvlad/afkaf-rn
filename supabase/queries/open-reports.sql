-- Открытые жалобы для ручного триажа (feat/moderation, 2026-11-04).
-- Запускать в Supabase Dashboard → SQL Editor (роль service_role — RLS не мешает).
-- target_id для 'marker' → markers.id (description + координаты метки),
-- для 'user' → profiles.id (имя пользователя, на которого жалуются).
SELECT
  r.created_at,
  r.target_type,
  r.reason,
  r.comment,
  rep.display_name                                              AS reporter_name,
  CASE WHEN r.target_type = 'user'   THEN tu.display_name END   AS reported_user_name,
  CASE WHEN r.target_type = 'marker' THEN m.type        END     AS marker_type,
  CASE WHEN r.target_type = 'marker' THEN m.description END     AS marker_description,
  CASE WHEN r.target_type = 'marker' THEN m.lat         END     AS marker_lat,
  CASE WHEN r.target_type = 'marker' THEN m.lng         END     AS marker_lng,
  r.id,
  r.target_id
FROM public.reports r
LEFT JOIN public.profiles rep ON rep.id = r.reporter_id
LEFT JOIN public.profiles tu  ON tu.id = r.target_id AND r.target_type = 'user'
LEFT JOIN public.markers  m   ON m.id  = r.target_id AND r.target_type = 'marker'
WHERE r.status = 'open'
ORDER BY r.created_at DESC;
