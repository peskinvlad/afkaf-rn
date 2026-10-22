-- Проверка 2026-10-22_first_name_strangers.sql. Только чтение: ничего не пишет.
-- Каждый запрос запускать ОТДЕЛЬНО (SQL Editor показывает результат последнего).

-- (0) ДО миграции и после: какие функции/вьюхи в живой БД вообще трогают
--     display_name. Ожидаемо: get_user_previews, get_park_presence,
--     handle_new_user (последняя только пишет имя при регистрации — не отдаёт).
SELECT 'function' AS kind, p.proname AS name, p.prosecdef AS security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prosrc ILIKE '%display_name%'
UNION ALL
SELECT 'view', c.relname, NULL
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('v', 'm')
  AND pg_get_viewdef(c.oid) ILIKE '%display_name%';

-- (1) После миграции: тело обновлено, SECURITY DEFINER и search_path на месте,
--     гранты как раньше. Ожидаемо в обеих строках: has_first_name_cut = true,
--     security_definer = true, config = {search_path=public},
--     anon_can = false, authenticated_can = true.
SELECT
  p.proname,
  strpos(p.prosrc, 'display_name FROM ''\S+''') > 0 AS has_first_name_cut,
  p.prosecdef AS security_definer,
  p.proconfig AS config,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN ('get_user_previews', 'get_park_presence');

-- (2) После миграции: get_user_previews глазами КАЖДОЙ стороны каждой дружбы.
--     «Смотрящий» подставляется в auth.uid() через request.jwt.claims (только на
--     время запроса; set_config и вызов — в одном подзапросе, чтобы планировщик
--     не переиспользовал чужого «смотрящего»). Ожидаемо: accepted → shown =
--     полное имя; pending → только первое слово. Колонка ok = true во ВСЕХ
--     строках; строка без ответа функции (shown пусто, ok = false) — тоже ошибка.
SELECT
  f.status,
  prof.display_name AS full_name,
  v.display_name    AS shown,
  v.id IS NOT NULL AND v.display_name IS NOT DISTINCT FROM (
    CASE WHEN f.status = 'accepted' THEN prof.display_name
         ELSE COALESCE(substring(prof.display_name FROM '\S+'), prof.display_name)
    END
  ) AS ok
FROM friendships f
CROSS JOIN LATERAL (VALUES (f.requester_id, f.addressee_id),
                           (f.addressee_id, f.requester_id)) AS d(viewer, other)
JOIN profiles prof ON prof.id = d.other
LEFT JOIN LATERAL (
  SELECT v.*
  FROM (SELECT set_config('request.jwt.claims',
                          json_build_object('sub', d.viewer, 'role', 'authenticated')::text,
                          true) AS c) s
  CROSS JOIN LATERAL public.get_user_previews(
    CASE WHEN s.c IS NOT NULL THEN ARRAY[d.other] END
  ) v
) v ON true
ORDER BY ok, f.status;

-- (3) Короткая сводка того же: сколько строк проверено и сколько неверных.
--     Ожидаемо: wrong = 0.
SELECT
  count(*) AS checked,
  count(*) FILTER (WHERE NOT ok) AS wrong,
  count(*) FILTER (WHERE status = 'accepted') AS friend_rows,
  count(*) FILTER (WHERE status <> 'accepted') AS non_friend_rows
FROM (
  SELECT
    f.status,
    v.id IS NOT NULL AND v.display_name IS NOT DISTINCT FROM (
      CASE WHEN f.status = 'accepted' THEN prof.display_name
           ELSE COALESCE(substring(prof.display_name FROM '\S+'), prof.display_name)
      END
    ) AS ok
  FROM friendships f
  CROSS JOIN LATERAL (VALUES (f.requester_id, f.addressee_id),
                             (f.addressee_id, f.requester_id)) AS d(viewer, other)
  JOIN profiles prof ON prof.id = d.other
  LEFT JOIN LATERAL (
    SELECT v.*
    FROM (SELECT set_config('request.jwt.claims',
                            json_build_object('sub', d.viewer, 'role', 'authenticated')::text,
                            true) AS c) s
    CROSS JOIN LATERAL public.get_user_previews(
      CASE WHEN s.c IS NOT NULL THEN ARRAY[d.other] END
    ) v
  ) v ON true
) t;
