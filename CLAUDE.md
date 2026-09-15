# afkaf-rn

- **Бета iOS-first:** фоновая геолокация на Android (foreground service,
  `ACCESS_BACKGROUND_LOCATION`) вне скоупа — не делать без отдельного решения.
- **Лейаут всегда LTR** (`lockLayoutLTR` в `src/i18n`): `forceRTL` не
  возвращать, пока экраны не прошли RTL-адаптацию (бэклог).

## Работа с БД (Supabase)

- **Снапшот схемы — каталог `supabase/`, это источник правды.** Снимки по
  категориям: RLS-политики `supabase/policies/*.sql`, функции
  `supabase/functions/*.sql`, триггеры `supabase/triggers.sql`. DDL таблиц и
  колонок пока **не снят** — единый снимок таблиц ведётся в
  `supabase/tables.sql` (сейчас заготовка/TODO, заполняется по мере правок).
  Перед задачей, читающей или пишущей в БД, — сначала свериться со снимком.
- **Чтение БД через Supabase MCP разрешено** (проверка схемы, отладка,
  сверка данных). **Любая ЗАПИСЬ в БД** (DDL, миграции, INSERT/UPDATE/DELETE
  вне приложения) — только через **ручной стоп**: выдать SQL текстом,
  дождаться ответа «выполнил», после этого обновить снапшот схемы в
  `supabase/` (нужную категорию и/или `supabase/tables.sql`) **тем же
  коммитом**.
- **`markers`: строки не удаляются, только фильтруются по `expires_at`** —
  история нужна для сводки района.
- **Типы меток (`markers_type_check`):** `park`, `water`, `danger`, `hazard`,
  `aggressive_dog`, `forbidden`, `dog_park`, `food`. Канон в клиенте —
  `src/lib/markerConfig.ts` (`MARKER_CONFIG`). Тип не в `MARKER_CONFIG` рендерится
  нейтральным серым 📍 (fallback в Map/Walk/Callout/filter), краха нет.
  - **`water`/`park`/`dog_park` — инфраструктура (кураторские).** Ставит только
    куратор через service_role / SQL (постоянные, `expires_at = NULL`, `user_id`
    куратора `e57637d6-7b83-465c-8263-6ca0fa822ab4`). Триггер
    `markers_guard_insert` блокирует их вставку обычным юзером (`auth.uid()` не
    NULL) через `RAISE EXCEPTION 'PT403'`. В селекторе клиента их нет.
  - **`food`** — будущий пользовательский тип (пост-бета), в клиенте пока не
    заведён; в триггере ограничений на него нет (общий путь: rate-limit + 24h).
  - **`water_sources`** дедуплицируется по `osm_id` (UNIQUE INDEX
    `water_sources_osm_id_key`) — импорт идёт `ON CONFLICT (osm_id) DO NOTHING`.

## Security backlog (post-beta)

Найдено аудитом перед первой TestFlight-сборкой (2026-09-13). Не блокеры
беты; разбирать после. Критичных дыр (обход auth, утечка `service_role`) нет.

- **Сессия Supabase в SecureStore (Keychain).** Сейчас токены в AsyncStorage
  (`src/lib/supabase.ts`, `storage: AsyncStorage`) — открытый текст в песочнице.
  Перейти на `expo-secure-store`; лимит Keychain ~2 КБ, JWT крупнее — нужен
  адаптер (чанкинг или AES-ключ в SecureStore + шифртекст в AsyncStorage).
- **Квантование координат для `visibility='everyone'`.** RLS `active_walks`
  (`supabase/policies/active_walks.sql`) без серверного гео-фильтра; 2 км
  режется на клиенте (`src/hooks/useNearbyDogs.ts`). Владельцы `everyone`-прогулок
  отдают точные live-координаты всем. Дефолт — `friends`, так что риск opt-in.
  Квантовать/rate-limit'ить `everyone`-ветку.
- **`marker_votes` SELECT `USING(true)`** (`supabase/policies/marker_votes.sql`)
  раскрывает `user_id` голосовавших. Сузить видимость.
- **`get_trust_status` с произвольным `p_user_id`**
  (`supabase/functions/get_trust_status.sql`, не SECURITY DEFINER) — можно
  посчитать чужой confirmed-count. Низкая чувствительность.
- **Убрать `EXPO_PUBLIC_MAPBOX_TOKEN` из `.env`** — в коде не используется
  (в бандл не инлайнится), но токен лежит в локальном `.env`.

## Cosmetic backlog (post-beta)

- **Apple logo / Legal:** увеличить зазор до чипа (8→12–16), вычесть внутренний
  отступ MapKit из `left` для совпадения краёв — post-beta.
