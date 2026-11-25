# Серверные пуши «друг вышел гулять» / «друг на площадке» — план

Дата: 25.11.2026. Продолжение раздела 2(г) из `NOTIFICATIONS-PLAN.md`. Код не написан,
в базе ничего не менялось. Ниже — решения, которые нужны от Влада, и готовый черновик.

## Что это и почему нужен сервер

Все нынешние уведомления телефон показывает себе сам. Здесь телефон друга не знает, что
ты вышел, — сказать ему может только сервер. Цепочка: твой телефон публикует прогулку →
база видит новую строку → серверная функция находит друзей → сервис пушей Expo доставляет.

## Решения, которые нужны от Влада

1. **Когда слать «вышел гулять».** Предлагаю: в момент, когда прогулка стала видимой
   (появилась строка `active_walks`), а не в момент нажатия «Начать». Иначе пуш выдаёт
   «человек сейчас дома и выходит» — ровно то, что прячет домашняя зона.
2. **Кому.** Только принятым друзьям, без блокировок в любую сторону. При видимости «Все»
   незнакомым пуш не шлём никогда.
3. **Как часто.** Не чаще одного пуша про одного друга за 3 часа (строка прогулки
   пересоздаётся при входе/выходе из домашней зоны — без лимита будет спам).
4. **По умолчанию включено или выключено** у получателя. Предлагаю включено, с выключателем
   в Настройках (он там уже нарисован: «Друг вышел на прогулку»).
5. **Тихие часы.** 23:00–07:00 по времени Израиля не шлём (приложение только в Израиле).
6. **«Друг на площадке»** — вторым шагом, после того как первый пуш проживёт неделю.
   Механика та же, событие — строка в `park_checkins`.

## Что надо сделать (по порядку, от безопасного к сложному)

| Шаг | Что | Где | Нужна сборка? |
|---|---|---|---|
| 1 | Таблица токенов + функция записи токена | Supabase (SQL, только добавление) | нет |
| 2 | Клиент: получить токен Expo после входа, записать; удалить при выходе; язык рядом с токеном | JS, по воздуху | нет* |
| 3 | Настройка «друг вышел» переезжает на сервер (колонка у токена) | SQL + JS | нет |
| 4 | Серверная функция отправки (Edge Function) | Supabase, деплой | нет |
| 5 | Срабатывание на новую прогулку (триггер + pg_net или Database Webhook) | Supabase | нет |
| 6 | Страница конфиденциальности: новые получатели (Apple, Expo) | web/ | нет |
| 7 | Ответы о приватности в App Store Connect: идентификатор устройства для пушей | Влад руками | нет |

\* Проверить на устройстве первым делом: получает ли сборка 1.0.0 токен. Право на пуши
(`aps-environment`) плагин `expo-notifications` добавляет сам, и при сборке 0.2.0 Влад
подтвердил настройку APNs в EAS — должно работать, но это не проверено.

## Черновик SQL (НЕ применён)

```sql
-- Токены устройств. Клиент напрямую не читает и не пишет — только через RPC.
CREATE TABLE public.push_tokens (
  token       text        PRIMARY KEY,           -- ExponentPushToken[...]
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform    text        NOT NULL CHECK (platform IN ('ios','android')),
  lang        text        NOT NULL DEFAULT 'he' CHECK (lang IN ('he','en','ru')),
  friend_walk boolean     NOT NULL DEFAULT true, -- выключатель «друг вышел гулять»
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;  -- политик нет = клиенту закрыто
CREATE INDEX push_tokens_user_id_idx ON public.push_tokens (user_id);

-- Запись/обновление своего токена (токен мог раньше принадлежать другому аккаунту
-- на этом же телефоне — перепривязываем).
CREATE FUNCTION public.register_push_token(p_token text, p_platform text, p_lang text, p_friend_walk boolean)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  insert into push_tokens (token, user_id, platform, lang, friend_walk)
  select p_token, auth.uid(), p_platform, p_lang, p_friend_walk
  where auth.uid() is not null and p_token ~ '^Expo(nent)?PushToken\[.+\]$'
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform,
        lang = excluded.lang, friend_walk = excluded.friend_walk, updated_at = now();
$$;

CREATE FUNCTION public.unregister_push_token(p_token text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  delete from push_tokens where token = p_token and user_id = auth.uid();
$$;
-- + REVOKE ... FROM PUBLIC, anon; GRANT EXECUTE ... TO authenticated (как у остальных RPC).

-- Журнал отправок = защита от повторов (один пуш про одного друга за 3 часа).
CREATE TABLE public.push_log (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind       text        NOT NULL,               -- 'friend_walk' | 'friend_park'
  actor_id   uuid        NOT NULL,               -- кто вышел гулять
  sent_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.push_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX push_log_actor_idx ON public.push_log (actor_id, kind, sent_at DESC);
```

Получатели одного события (это выполняет серверная функция под service_role):

```sql
select t.token, t.lang
from friendships f
join push_tokens t
  on t.user_id = case when f.requester_id = :actor then f.addressee_id else f.requester_id end
where f.status = 'accepted'
  and :actor in (f.requester_id, f.addressee_id)
  and t.friend_walk
  and not exists (select 1 from blocks b
                  where (b.blocker_id = :actor and b.blocked_id = t.user_id)
                     or (b.blocker_id = t.user_id and b.blocked_id = :actor));
```

## Серверная функция (набросок логики)

1. Вход: `{ actor_id }` от триггера на INSERT в `active_walks` (вызов защищён секретом).
2. Тихие часы по `Asia/Jerusalem` → выйти.
3. В `push_log` есть запись про этого `actor_id` за последние 3 часа → выйти.
4. Взять имя (только первое слово) и кличку первой собаки актёра.
5. Собрать получателей запросом выше, сгруппировать по языку.
6. POST на `https://exp.host/--/api/v2/push/send` пачками до 100, звук `afkaf_notify.wav`,
   текст: «🐾 {dog} вышел гулять» / «{name} сейчас на прогулке — присоединишься?».
7. Ответ `DeviceNotRegistered` → удалить токен. Записать строку в `push_log`.

В пуше **нет координат** и нет ссылки на место — только факт прогулки.

## Что меняется в приватности

- Новый вид данных: push-токен устройства (идентификатор), язык интерфейса.
- Новые получатели: Expo (сервис доставки), Apple APNs; для Android позже — Google FCM.
- `web/privacy.html` §5 и ответы App Store Connect обновить ДО включения отправки.

## Объём

Шаги 1–3 — одна сессия (после «ок» на SQL). Шаги 4–5 — одна-две сессии с проверкой на двух
телефонах (Влад + Аня). Шаг 6–7 — полчаса.
