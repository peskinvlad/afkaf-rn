# Android TODO (пост-первая-сборка)

Список отложенных задач по Android. Заведён при подготовке первой Android
development-сборки (dev client, APK) на ветке `exp/android`. Сегодня НЕ делаем —
цель первой сборки была только «собралось, установилось, запустилось, вход
через Google работает». Разбирать по мере готовности.

## Карта (Google Maps)

- **Ключ Google Maps API.** ВАЖНО: без ключа на Android приложение **падает**
  при создании карты (`java.lang.RuntimeException: API key not found`,
  `com.rnmaps.maps.MapView.<init>`) — это НЕ «серая карта», а краш. Первая
  dev-сборка это подтвердила.
  - **Механизм подключения уже готов** (сделано): `app.config.js` дописывает
    `expo.android.config.googleMaps.apiKey` из переменной окружения
    `GOOGLE_MAPS_ANDROID_API_KEY`. Ключ в git не попадает. Осталось только
    завести саму переменную в EAS и получить ключ в Google Cloud.
  - Google Cloud Console → включить **Maps SDK for Android** → создать **API key**.
  - Ограничить ключ по **package** (`com.afkaf.app`) + **SHA-1** отпечатку
    keystore (SHA-1 берётся из `eas credentials` после первой сборки).
  - Завести `GOOGLE_MAPS_ANDROID_API_KEY` в EAS для окружений **development** и
    **preview** (значение — ключ из Google Cloud).

- **Поведение меток и зума на Google Maps.** На Android действует Google Maps,
  не Apple Maps, поэтому:
  - `cameraZoomRange` (`src/lib/mapConfig.ts`) — это проп MapKit, на Google Maps
    он игнорируется → ограничение зума не применяется. Проверить, нужен ли
    Android-эквивалент (`minZoomLevel`/`maxZoomLevel` или camera bounds).
  - Патч `patches/react-native-maps+1.20.1.patch` правит только iOS-файл
    (`AIRMapMarker.m`) — на Android не действует. Проверить анимацию/позицию
    меток (`MarkerAnimated`) на реальном устройстве, нет ли «прыжков».
  - `mapPadding` — кросс-платформенный, работает; проверить визуально.

## Геолокация / фон

- **Foreground service для непрерывного трека прогулки.** Сейчас трек пишется
  только пока приложение открыто на экране. При сворачивании на Android трек
  оборвётся. Для непрерывности нужен foreground service +
  `ACCESS_BACKGROUND_LOCATION`. По CLAUDE.md фоновая геолокация на Android —
  вне скоупа, требует отдельного решения.

- **Плагин `expo-location` под Android.** Сейчас настроен только под iOS
  (`isIosBackgroundLocationEnabled`). Android-аналог
  (`isAndroidForegroundServiceEnabled`) не выставлен — связано с задачей выше.

## Вход (Auth)

- **Кнопка Apple на Android.** В `src/screens/AuthScreen.tsx` кнопка Apple
  рендерится без проверки `Platform.OS`. На Android библиотека возвращает `null`
  (краха нет, кнопка просто не видна). Косметика: спрятать явно через
  `Platform.OS === 'ios'`, чтобы не полагаться на поведение библиотеки.

## Второй проход по Android (после preview-прогона на Samsung)

Заведено после прогона preview-сборки на старом Samsung. Часть пунктов —
блокеры, часть — косметика/перф. Порядок: сверху вниз по важности.

### БЛОКЕР №1 — старт прогулки роняет приложение — ✅ ИСПРАВЛЕНО (нужна новая сборка)

- **Симптом (был):** тап «начать прогулку» на Android крашил приложение / давал
  Alert «Не удалось включить геолокацию».
- **Причина:** `startLocationUpdatesAsync` без `foregroundService` стартовал как
  фоновый сервис → требовал `ACCESS_BACKGROUND_LOCATION` (у нас нет), а на
  Android 14+ ещё и `FOREGROUND_SERVICE_LOCATION` — их не было в манифесте.
- **Сделано (коммиты `feat(android): enable location foreground service…` +
  `feat(android): FGS notification…`):**
  - `expo-location` в `app.json`: `isAndroidForegroundServiceEnabled: true` →
    плагин добавляет `FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_LOCATION`;
  - `android.permissions += POST_NOTIFICATIONS`;
  - `walkTracking.startWalkTracking(fgs)` передаёт `foregroundService`
    (title/body/color `#2c5f25`, `killServiceOnDestroy`) — под `Platform.OS==='android'`,
    iOS-ветка без изменений;
  - `ACCESS_BACKGROUND_LOCATION` НЕ добавляли (старт из foreground);
  - POST_NOTIFICATIONS запрашивается перед стартом (Android 13+, non-blocking);
  - Alert геолокации разбит на короткий title + message.
- **Требует новой нативной сборки** (OTA не доставит новые разрешения/FGS).
  Ручной прогон старт-финиш прогулки на Samsung после сборки обязателен.

### БЛОКЕР №2 — Android runtimeVersion до раздачи тестерам

- **Контекст:** `version` НАМЕРЕННО оставлен `0.1.0` (общий для iOS и Android;
  подъём после мержа в `main` сменил бы `runtimeVersion` по policy `appVersion`
  и отрезал бы текущий iOS build 3 от OTA). На канале preview одно устройство —
  старую сборку просто заменяем новой.
- **Что сделать до раздачи Android тестерам:** завести **отдельный
  `android.runtimeVersion`** (через `app.config.js`), не меняя `version` и iOS
  runtime, чтобы Android-обновления по воздуху были изолированы от iOS. **Решить
  схему версионирования ДО первого мержа `exp/android` в `main`** — иначе общий
  `appVersion`-runtime свяжет платформы и OTA пойдёт крест-накрест.

### БЛОКЕР-соседи и баги UI

- **WalkScreen: инфра-пины не скрываются на общем плане страны.**
  Гейт `infraHidden` в WalkScreen **есть** (`src/screens/WalkScreen.tsx:197`,
  `waterToRender`/`markersToRender`), логика та же, что в MapScreen
  (`nextInfraHidden`, порог `INFRA_HIDE_ABOVE_DELTA = 0.10`).
  **Дырка:** `infraHidden` стартует `false` и пересчитывается ТОЛЬКО в
  `onRegionChangeComplete` (`:644`). На стартовый/начальный регион пересчёта нет
  (`INITIAL_REGION` = `START_DELTA 0.018`, городской зум → показываем). Если карта
  оказывается на широком плане БЕЗ завершённого жеста (нет фикса, программный
  регион), инфра остаётся видимой и даёт лаг. Кандидат: считать `infraHidden` из
  известного региона на маунте и/или в `onRegionChange` (не только Complete).

- **Alert «Не удалось включить геолокацию…» — текст в `title` обрезается на
  Android.** Длинную строку перенести из `title` в `message` (в `Alert.alert`
  на Android title однострочный). Найти вызовы `Alert.alert` с длинным первым
  аргументом на пути геолокации.

- **DogProfile: чип «Дружелюбный» не влезает** — перенос по буквам. Дать чипу
  `flexShrink`/`minWidth: 0` или уменьшить паддинги/шрифт; проверить длинные
  значения черт на Android.

- **ProfileScreen: контент под системной панелью навигации (edge-to-edge).**
  ScrollView уже добавляет `paddingBottom: insets.bottom + 24`
  (`src/screens/ProfileScreen.tsx:326`), так что перекрывает, скорее всего,
  **не-скролл элемент** (закреплённый низ/кнопка) или случай, когда `insets.bottom`
  = 0 на этом устройстве. Проверить конкретный оверлап на Samsung, добавить
  нижний inset нужному элементу.

- **Nunito не применяется на Android — выглядит как системный Roboto.**
  Шрифты грузятся (`App.tsx`, `useFonts`), но **глобального дефолта для `Text`
  нет** (нет `Text.defaultProps.style` / обёртки). Многие стили задают только
  `fontWeight` без `fontFamily` → на Android это Roboto соответствующего веса
  (на iOS `fontWeight` даёт San Francisco, потому и «не замечали»). Стили,
  использующие `...typography.*`, шрифт получают (там `fontFamily` есть), но их
  меньшинство относительно «сырых» `fontWeight`.
  Кандидаты: (1) выставить дефолтный `fontFamily` для всех `Text` глобально;
  (2) заменить сырые `fontWeight` на пресеты `typography.*`. Правка кросс-
  платформенная (JS-only, доставляется OTA) — но проверить, что iOS-вид не
  меняется.

### Перф карты — лаги от ~1600 маркеров

- **~1600 `MapMarkerIcon` на городском зуме** (≈825 markers + 835 water). На
  Android каждый кастомный `<Marker>`-children растеризуется в bitmap; массовый
  маунт + баг New Arch (см. ниже) дают сильные лаги при панорамировании/зуме.
- **Кандидаты на решение:**
  1. **Рендерить только пины в видимой области + запас** (bbox из региона,
     Android-гейт), вместе с зум-гейтом инфры. JS-only, доставляется OTA.
  2. **Вариант (г) из разбора обрезки маркеров:** на Android отдавать статичным
     пинам готовые PNG через проп `image` вместо children-View. Снимает и
     обрезку, и растеризацию (нет снапшота вью) — Google Maps эффективно рисует
     статичные image-маркеры. PNG-ассеты + JS → **доставляется через EAS Update
     без новой сборки.** Свой маркер с вращением — отдельно (см. ниже).

### Обрезка кастомных маркеров на Android (root cause — для контекста)

- **Причина найдена в нативном коде** `node_modules/react-native-maps` (1.20.1):
  размер bitmap маркера берётся из `MapMarker.width/height`, которые
  выставляет только `SizeReportingShadowNode` (Paper `LayoutShadowNode`,
  механизм старой архитектуры). На **New Architecture (Fabric)** этот путь не
  вызывается → размер остаётся 0 → `createDrawable()` рисует в недоразмерный
  bitmap (fallback/усечённый) → пин обрезан справа/снизу. `collapsable={false}`
  и запас размера в JS **не помогают** (размер снимка задаётся нативно).
- **Апстрим-фикс:** PR #5913 (`expandSnapshotSizeFromSubtree` в
  `createDrawable`), релиз **v1.29.5** (19.09.2026) — правит размер bitmap по
  фактическому поддереву. **Нативное изменение** (patch-package или апгрейд) →
  новая сборка. Подробные варианты и риски — в отчёте по Задаче 2 (обрезка).
