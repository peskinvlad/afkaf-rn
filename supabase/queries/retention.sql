-- Отчёт об удержании пользователей afkaf. ТОЛЬКО SELECT — ничего не пишет.
-- Запускать в Supabase SQL Editor (нужен доступ к auth.users) по одному
-- запросу за раз. Каждый запрос самодостаточен: в начале одинаковый блок
-- WITH (параметры, исключения, события) — при правке менять во всех.
--
-- Что считается «действием» (любая строка с user_id и временем):
--   walk_history.started_at            — прогулка (история)
--   active_walks.started_at/updated_at — идущая прямо сейчас прогулка
--   markers.created_at                 — поставил метку
--   marker_votes.created_at            — проголосовал за метку
--   park_checkins.started_at           — отметился в парке
--   friendships.created_at             — отправил заявку в друзья (requester)
--   friendships.updated_at             — ответил на заявку (addressee, статус не pending)
-- НЕ считается: auth.users.last_sign_in_at (это вход по логину, а не открытие
-- приложения — сессия живёт месяцами), dogs.created_at (анкета при регистрации),
-- user_badges (производные от прогулок), rpc_rate_limit (служебная).
--
-- Регистрация = auth.users.created_at. Время — по Asia/Jerusalem.
-- Неделя N после регистрации = дни [7N, 7N+7) от момента регистрации
-- (неделя 0 = первые 7 дней). Неделя засчитывается в знаменатель, только
-- если она уже целиком прошла.
-- Недели беты = 7-дневные блоки от 22.09.2026 (вторник): неделя 1 = 22–28.09 и т.д.
--
-- Исключения (обновлять руками):
--   e57637d6 — Влад, DEV_USER_IDS (src/constants/dev.ts), он же куратор меток
--   4c7b35ff — второй тестовый аккаунт Влада (Google, 20–23.09)
--   06678cc8 — проверка входа Apple 20.09 (создан за 30 с до входа Влада, без действий)
-- Тестер (в отчёте, но с пометкой): 8fd47c32 — Аня.


-- ============================================================
-- 1. Регистрации: всего и по неделям (неделя с понедельника)
-- ============================================================
with
params as (select date '2026-09-22' as beta_start, 'Asia/Jerusalem'::text as tz),
excluded(id) as (values
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid),
  ('4c7b35ff-0f49-49af-b0f2-99418bcc2b68'::uuid),
  ('06678cc8-796f-4bf2-be8d-70f9371b50be'::uuid)),
testers(id) as (values ('8fd47c32-bf36-4558-acb5-0aad9afe4036'::uuid)),
users as (
  select u.id, u.created_at as registered_at, u.id in (select id from testers) as is_tester
  from auth.users u
  where u.id not in (select id from excluded)
    and u.deleted_at is null and not coalesce(u.is_anonymous, false))
select
  coalesce(to_char(date_trunc('week', registered_at at time zone p.tz), 'YYYY-MM-DD'), 'ВСЕГО') as week_from_monday,
  count(*)                                   as registered,
  count(*) filter (where is_tester)          as of_them_testers,
  count(*) filter (where (registered_at at time zone p.tz)::date >= p.beta_start) as since_beta
from users, params p
group by grouping sets ((date_trunc('week', registered_at at time zone p.tz)), ())
order by week_from_monday;


-- ============================================================
-- 2. Когорты по неделе регистрации: доля активных на 1-й, 2-й, 4-й неделе
-- ============================================================
with
params as (select date '2026-09-22' as beta_start, 'Asia/Jerusalem'::text as tz),
excluded(id) as (values
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid),
  ('4c7b35ff-0f49-49af-b0f2-99418bcc2b68'::uuid),
  ('06678cc8-796f-4bf2-be8d-70f9371b50be'::uuid)),
testers(id) as (values ('8fd47c32-bf36-4558-acb5-0aad9afe4036'::uuid)),
users as (
  select u.id, u.created_at as registered_at, u.id in (select id from testers) as is_tester
  from auth.users u
  where u.id not in (select id from excluded)
    and u.deleted_at is null and not coalesce(u.is_anonymous, false)),
events as (
            select user_id, started_at as at from walk_history
  union all select user_id, started_at from active_walks
  union all select user_id, updated_at from active_walks
  union all select user_id, created_at from markers
  union all select user_id, created_at from marker_votes
  union all select user_id, started_at from park_checkins
  union all select requester_id, created_at from friendships
  union all select addressee_id, updated_at from friendships where status <> 'pending'),
per_user as (
  select u.id, u.is_tester,
    date_trunc('week', u.registered_at at time zone p.tz)::date as cohort,
    k.n,
    u.registered_at + make_interval(days => 7 * (k.n + 1)) <= now() as window_passed,
    exists (select 1 from events e where e.user_id = u.id
            and e.at >= u.registered_at + make_interval(days => 7 * k.n)
            and e.at <  u.registered_at + make_interval(days => 7 * (k.n + 1))) as active
  from users u, params p, (values (1), (2), (4)) k(n))
select cohort,
  count(distinct id)                                                        as cohort_size,
  count(*) filter (where n = 1 and window_passed)                           as w1_eligible,
  count(*) filter (where n = 1 and window_passed and active)                as w1_active,
  count(*) filter (where n = 2 and window_passed)                           as w2_eligible,
  count(*) filter (where n = 2 and window_passed and active)                as w2_active,
  count(*) filter (where n = 4 and window_passed)                           as w4_eligible,
  count(*) filter (where n = 4 and window_passed and active)                as w4_active
from per_user
group by cohort
order by cohort;


-- ============================================================
-- 3. Активные по неделям беты + прогулок на активного
-- ============================================================
with
params as (select date '2026-09-22' as beta_start, 'Asia/Jerusalem'::text as tz),
excluded(id) as (values
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid),
  ('4c7b35ff-0f49-49af-b0f2-99418bcc2b68'::uuid),
  ('06678cc8-796f-4bf2-be8d-70f9371b50be'::uuid)),
testers(id) as (values ('8fd47c32-bf36-4558-acb5-0aad9afe4036'::uuid)),
users as (
  select u.id, u.created_at as registered_at, u.id in (select id from testers) as is_tester
  from auth.users u
  where u.id not in (select id from excluded)
    and u.deleted_at is null and not coalesce(u.is_anonymous, false)),
events as (
            select user_id, started_at as at, 'walk' as kind from walk_history
  union all select user_id, started_at, 'live' from active_walks
  union all select user_id, updated_at, 'live' from active_walks
  union all select user_id, created_at, 'marker' from markers
  union all select user_id, created_at, 'vote' from marker_votes
  union all select user_id, started_at, 'checkin' from park_checkins
  union all select requester_id, created_at, 'friend' from friendships
  union all select addressee_id, updated_at, 'friend' from friendships where status <> 'pending'),
ev as (
  select e.*, u.is_tester,
    ((e.at at time zone p.tz)::date - p.beta_start) / 7 + 1 as beta_week
  from events e join users u on u.id = e.user_id, params p
  where (e.at at time zone p.tz)::date >= p.beta_start)
select beta_week,
  to_char(p.beta_start + 7 * (beta_week - 1), 'DD.MM') || '–' ||
  to_char(least(p.beta_start + 7 * beta_week - 1, (now() at time zone p.tz)::date), 'DD.MM') as days,
  count(distinct user_id)                                         as active_users,
  count(distinct user_id) filter (where is_tester)                as of_them_testers,
  count(*) filter (where kind = 'walk')                           as walks,
  round(count(*) filter (where kind = 'walk')::numeric
        / nullif(count(distinct user_id), 0), 1)                  as walks_per_active,
  count(distinct user_id) filter (where kind = 'walk')            as users_who_walked
from ev, params p
group by beta_week, p.beta_start, p.tz
order by beta_week;


-- ============================================================
-- 4. Доли: вклад (метка / голос / парк) и хотя бы один принятый друг
-- ============================================================
with
excluded(id) as (values
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid),
  ('4c7b35ff-0f49-49af-b0f2-99418bcc2b68'::uuid),
  ('06678cc8-796f-4bf2-be8d-70f9371b50be'::uuid)),
testers(id) as (values ('8fd47c32-bf36-4558-acb5-0aad9afe4036'::uuid)),
users as (
  select u.id, u.id in (select id from testers) as is_tester
  from auth.users u
  where u.id not in (select id from excluded)
    and u.deleted_at is null and not coalesce(u.is_anonymous, false)),
flags as (
  select u.id, u.is_tester,
    exists (select 1 from markers m where m.user_id = u.id)        as has_marker,
    exists (select 1 from marker_votes v where v.user_id = u.id)   as has_vote,
    exists (select 1 from park_checkins c where c.user_id = u.id)  as has_checkin,
    exists (select 1 from friendships f where f.status = 'accepted'
            and u.id in (f.requester_id, f.addressee_id))          as has_friend
  from users u)
select
  count(*)                                                                    as users,
  count(*) filter (where has_marker)                                          as put_marker,
  count(*) filter (where has_vote)                                            as voted,
  count(*) filter (where has_checkin)                                         as checked_in,
  count(*) filter (where has_marker or has_vote or has_checkin)               as any_contribution,
  round(100.0 * count(*) filter (where has_marker or has_vote or has_checkin) / count(*)) as any_contribution_pct,
  count(*) filter (where has_friend)                                          as with_friend,
  round(100.0 * count(*) filter (where has_friend) / count(*))                as with_friend_pct,
  -- то же без тестера
  count(*) filter (where not is_tester)                                       as users_no_tester,
  count(*) filter (where not is_tester and (has_marker or has_vote or has_checkin)) as contribution_no_tester,
  count(*) filter (where not is_tester and has_friend)                        as with_friend_no_tester
from flags;


-- ============================================================
-- 5. Список пользователей (только короткий id), по последнему действию
-- ============================================================
with
params as (select 'Asia/Jerusalem'::text as tz),
excluded(id) as (values
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid),
  ('4c7b35ff-0f49-49af-b0f2-99418bcc2b68'::uuid),
  ('06678cc8-796f-4bf2-be8d-70f9371b50be'::uuid)),
testers(id) as (values ('8fd47c32-bf36-4558-acb5-0aad9afe4036'::uuid)),
users as (
  select u.id, u.created_at as registered_at, u.id in (select id from testers) as is_tester
  from auth.users u
  where u.id not in (select id from excluded)
    and u.deleted_at is null and not coalesce(u.is_anonymous, false)),
events as (
            select user_id, started_at as at from walk_history
  union all select user_id, started_at from active_walks
  union all select user_id, updated_at from active_walks
  union all select user_id, created_at from markers
  union all select user_id, created_at from marker_votes
  union all select user_id, started_at from park_checkins
  union all select requester_id, created_at from friendships
  union all select addressee_id, updated_at from friendships where status <> 'pending')
select
  left(u.id::text, 8)                                                   as short_id,
  case when u.is_tester then 'тестер' else '' end                       as note,
  to_char(u.registered_at at time zone p.tz, 'DD.MM.YYYY')              as registered,
  to_char(max(e.at) at time zone p.tz, 'DD.MM.YYYY HH24:MI')           as last_action,
  (select count(*) from walk_history w where w.user_id = u.id)          as walks,
  (select count(*) from markers m where m.user_id = u.id)               as markers,
  (select count(*) from marker_votes v where v.user_id = u.id)          as votes,
  (select count(*) from park_checkins c where c.user_id = u.id)         as checkins,
  (select count(*) from friendships f where f.status = 'accepted'
     and u.id in (f.requester_id, f.addressee_id))                      as friends
from users u
left join events e on e.user_id = u.id
cross join params p
group by u.id, u.is_tester, u.registered_at, p.tz
order by max(e.at) desc nulls last;


-- ############################################################
-- ОТКРЫТИЯ ПРИЛОЖЕНИЯ (app_pings, feat/app-ping)
-- ############################################################
-- Пинг = одно открытие приложения на устройство в день (анонимный device_id,
-- без координат; см. supabase/migrations/2026-11-14_app_ping.sql). dev-устройство
-- не пингуется (гейт в клиенте), поэтому отдельных исключений по user_id тут нет.
-- day уже хранится по Asia/Jerusalem. Все запросы ниже — ТОЛЬКО SELECT.


-- ============================================================
-- 6. Активные устройства по дням (DAU) + разбивка платформ и гость/вошёл
-- ============================================================
select
  day,
  count(*)                                             as devices,
  count(*) filter (where platform = 'ios')             as ios,
  count(*) filter (where platform = 'android')         as android,
  count(*) filter (where user_id is null)              as guests,
  count(*) filter (where user_id is not null)          as signed_in
from app_pings
group by day
order by day desc;


-- ============================================================
-- 7. Активные устройства по неделям (WAU, неделя с понедельника по Иерусалиму)
-- ============================================================
with pings as (
  select device_id, user_id, platform,
    date_trunc('week', day::timestamp)::date as week_from_monday
  from app_pings)
select
  coalesce(to_char(week_from_monday, 'YYYY-MM-DD'), 'ВСЕГО')   as week_from_monday,
  count(distinct device_id)                                    as devices,
  count(distinct device_id) filter (where platform = 'ios')    as ios,
  count(distinct device_id) filter (where platform = 'android') as android
from pings
group by grouping sets ((week_from_monday), ())
order by week_from_monday;


-- ============================================================
-- 8. iOS vs Android — всего уникальных устройств за всё время
-- ============================================================
select
  platform,
  count(distinct device_id)                                 as devices,
  min(day)                                                  as first_seen,
  max(day)                                                  as last_seen
from app_pings
group by platform
order by devices desc;


-- ============================================================
-- 9. Гости vs вошедшие — уникальные устройства за всё время
--    (устройство считаем «вошедшим», если хоть раз пинговало с user_id)
-- ============================================================
with per_device as (
  select device_id,
    bool_or(user_id is not null) as ever_signed_in
  from app_pings
  group by device_id)
select
  count(*)                                     as devices_total,
  count(*) filter (where ever_signed_in)       as ever_signed_in,
  count(*) filter (where not ever_signed_in)   as guests_only,
  round(100.0 * count(*) filter (where ever_signed_in) / nullif(count(*), 0)) as signed_in_pct
from per_device;


-- ============================================================
-- 10. Доля устройств, открывших приложение, но БЕЗ прогулки за неделю
--     Прогулка = walk_history.started_at ИЛИ active_walks (по пользователю).
--     Учитываем только вошедшие устройства (у гостя нет user_id → прогулку к
--     устройству не привязать); считаем за последние 7 дней (Иерусалим).
-- ============================================================
with
params as (select 'Asia/Jerusalem'::text as tz),
window_pings as (
  select distinct device_id, user_id
  from app_pings, params p
  where user_id is not null
    and day >= (now() at time zone p.tz)::date - 6),
walk_users as (
            select user_id, started_at as at from walk_history
  union all select user_id, started_at from active_walks),
flagged as (
  select wp.device_id, wp.user_id,
    exists (
      select 1 from walk_users w, params p
      where w.user_id = wp.user_id
        and (w.at at time zone p.tz)::date >= (now() at time zone p.tz)::date - 6
    ) as walked
  from window_pings wp)
select
  count(*)                                    as opened_signed_in_devices,
  count(*) filter (where not walked)          as opened_without_walk,
  round(100.0 * count(*) filter (where not walked) / nullif(count(*), 0)) as opened_without_walk_pct
from flagged;


-- ============================================================
-- 11. Возвращаемость устройств по неделе ПЕРВОГО пинга (device retention)
--     Неделя 0 = неделя первого открытия; W1/W2/W3 — открывал ли снова.
--     Неделя засчитывается в знаменатель, только если уже целиком прошла.
-- ============================================================
with
params as (select 'Asia/Jerusalem'::text as tz),
first_seen as (
  select device_id, min(day) as d0
  from app_pings
  group by device_id),
cohort as (
  select device_id,
    date_trunc('week', d0::timestamp)::date as cohort_week,
    d0
  from first_seen),
grid as (
  select c.device_id, c.cohort_week, c.d0, k.n
  from cohort c, (values (1), (2), (3)) k(n)),
ret as (
  select g.cohort_week, g.n,
    (g.d0 + (7 * (g.n + 1)) <= (now() at time zone p.tz)::date) as window_passed,
    exists (
      select 1 from app_pings a
      where a.device_id = g.device_id
        and a.day >= g.d0 + 7 * g.n
        and a.day <  g.d0 + 7 * (g.n + 1)
    ) as returned
  from grid g, params p)
select cohort_week,
  (select count(distinct device_id) from cohort c where c.cohort_week = r.cohort_week) as cohort_size,
  count(*) filter (where n = 1 and window_passed)                as w1_eligible,
  count(*) filter (where n = 1 and window_passed and returned)   as w1_returned,
  count(*) filter (where n = 2 and window_passed)                as w2_eligible,
  count(*) filter (where n = 2 and window_passed and returned)   as w2_returned,
  count(*) filter (where n = 3 and window_passed)                as w3_eligible,
  count(*) filter (where n = 3 and window_passed and returned)   as w3_returned
from ret r
group by cohort_week
order by cohort_week;
