-- Воронка новых устройств за последние 7 дней (read-only). Устройство = device_id
-- из app_events/app_pings; шаг засчитан, если событие было хоть раз.
with new_dev as (
  select device_id from app_pings
  group by device_id
  having min(day) > (now() at time zone 'Asia/Jerusalem')::date - 7  -- 7 календарных дней включая сегодня
),
ev as (
  select e.device_id, e.name from app_events e join new_dev using (device_id)
  -- «прогулка завершена» = только засчитанная (≥300 м и ≥5 мин)
  where not (e.name = 'walk_finished' and coalesce(e.props->>'valid','') <> 'true')
)
select step, count(distinct device_id) as devices
from (values
  (1,'lang_chosen'),(2,'onboarding_done'),(3,'walk_started'),(4,'walk_finished'),
  (5,'auth_shown'),(6,'signed_in'),(7,'dog_added'),(8,'marker_created')
) s(ord, step)
left join ev on ev.name = s.step
group by ord, step order by ord;
