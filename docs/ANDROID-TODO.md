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
- **Подтверждено на устройстве (Samsung S9, Android 10, preview из e6d8c5f):**
  foreground service стартует — иконка FGS-уведомления в статус-баре видна,
  краха на старте прогулки больше нет. Всплыл следующий блокер (ANR, ниже).

### БЛОКЕР №1.5 — ANR на WalkScreen сразу после старта — ✅ ИСПРАВЛЕНО (OTA-JS)

- **Симптом (Samsung S9, Android 10):** после старта прогулки WalkScreen
  открывается, FGS-иконка есть, но карта стоит на масштабе «полстраны» (видны
  Нетания/Хадера вместо улицы в Бат-Яме), таймер 00:00, через несколько секунд
  ANR «Приложение не отвечает». Оверлей: `markers=826 water=835`.
- **Причина №1 — зум «полстраны».** WalkScreen двигает камеру только
  `animateCamera({ center })` без поля `zoom`. На Android (`MapView.java:911`
  `animateToCamera`) зум применяется ТОЛЬКО при `camera.hasKey("zoom")`, иначе
  берётся текущий зум камеры. А стартовая камера на Android сидит на фолбэке
  «карта ещё не разложена» — `newLatLngZoom(center, 10)` (`MapView.java:588`),
  зум 10 = полстраны. `cameraZoomRange` — проп MapKit, в Android-нативе его нет
  (grep пусто) → на Google Maps игнорируется и зум не задаёт. Итог: карта
  навсегда на зуме 10. (MapScreen этим не болеет — он центрируется через
  `animateToRegion` с явными дельтами 0.005, а не `animateCamera`.)
- **Причина №2 — ANR.** `infraHidden` стартует `false`, вьюпорт-фильтра пинов
  не было → на первом рендере монтировались ВСЕ пины: `filteredMarkers` (радиус
  по умолчанию `all` → все 826) + все 835 `water` = ~1660 кастомных
  `<Marker>`-children. Каждый растеризуется в bitmap на главном потоке
  (`tracksViewChanges` 500 мс) → массовый маунт вешает UI-поток → ANR.
  `infraHidden` пересчитывается только в `onRegionChangeComplete`, то есть уже
  ПОСЛЕ этого маунта — не спасает. Зум 10 усугублял: в кадре весь Гуш-Дан.
- **Фикс (JS-only, под `Platform.OS==='android'`, OTA; iOS-дерево байт в байт):**
  - **Камера:** `zoom: 17` (уровень улицы, ≈ дельта 0.005 у MapScreen) задаётся
    только при первом позиционировании после старта, по кнопке «центр на мне» и
    по тапу на карточку друга. Регулярные follow-обновления по GPS — только
    `center` (не сбрасываем ручной масштаб, как на iOS). Страховка: если при
    follow текущий зум камеры < 13 («полстраны») — один раз подтянуть до 17.
    iOS `zoom` не читает (использует altitude), ветка follow там прежняя.
  - **Маркеры:** `src/lib/mapViewport.ts` (`selectVisiblePins`) — на Android
    рендерятся только пины в видимом регионе +30%; регион из
    `onRegionChangeComplete`; до первого известного региона инфраструктура
    (water/park/dog_park/water_sources) не монтируется вовсе; потолок 150 пинов
    в области → инфраструктуру скрываем, опасные пользовательские метки — всегда.
    Пересчёт через `useMemo` от региона и данных. Применено на WalkScreen и
    MapScreen. Куллинг НЕ трогает пины друзей (`FriendWalkerMarker`) и свой
    маркер позиции — они рендерятся всегда; метка с открытым callout
    принудительно остаётся в списке, пока callout открыт.
- **Проверить на Samsung после апдейта:** старт прогулки открывает карту на
  уровне улицы (виден Бат-Ям, не Нетания), таймер идёт, ANR нет; при отдалении
  инфраструктура пропадает, при приближении возвращается; «центр на мне»
  возвращает на уличный зум; на MapScreen метки/вода появляются в видимой
  области при пане.

### БЛОКЕР №2 — Android runtimeVersion до раздачи тестерам — ✅ СДЕЛАНО

- **Контекст:** `version` НАМЕРЕННО оставлен `0.1.0` (общий для iOS и Android;
  подъём после мержа в `main` сменил бы `runtimeVersion` по policy `appVersion`
  и отрезал бы текущий iOS build 3 от OTA). На канале preview одно устройство —
  старую сборку просто заменяем новой.
- **Сделано (для первого .aab в Play internal testing):**
  - **`app.json` → `expo.android.runtimeVersion = "android-1"`** (фикс-строка).
    Top-level `expo.runtimeVersion = { policy: appVersion }` и `expo.version =
    0.1.0` НЕ тронуты. Платформенный runtime перекрывает top-level только для
    Android (SDK 54: *«platform specific one takes precedence»*); iOS резолвится
    из policy → `0.1.0` как прежде. Проверено: `expo config --type introspect`
    diff — меняются ТОЛЬКО две строки Android (`android.runtimeVersion` +
    `strings.xml/expo_runtime_version`), iOS Info.plist (`EXUpdatesRuntimeVersion`
    = `0.1.0`) байт в байт. `app.config.js` не трогали — спред `...config.android`
    сохраняет `runtimeVersion`.
  - **Каналы: отдельный `production-android`.** `eas.json` → новый профиль
    `production-android` (`extends: production`, `channel: production-android`,
    `.aab` наследуется от store-distribution). Причина: `eas update` публикует
    сразу под обе платформы, каждую со своим резолвом runtime; на ОБЩЕМ канале
    `production` публикация с android-ветки посчитала бы iOS-runtime = `0.1.0` и
    долетела бы до iOS build 3 непроверенным JS. Отдельный канал рвёт связь в
    обе стороны без дисциплины `--platform`. iOS остаётся на `production`.
- **Схема версионирования (зафиксирована ДО мержа `exp/android` в `main`):**
  - iOS: runtime `0.1.0` (policy appVersion), канал `production`. OTA с `main`
    долетают до iOS build 3 как раньше.
  - Android: runtime `android-1` (фикс), канал `production-android`. При будущем
    нативном изменении Android — бампать `android-1 → android-2` (руками, это НЕ
    `version`), новая сборка. JS-only OTA — тем же runtime.
- **⚠️ ДО сборки .aab (вне кода, делает владелец):**
  - Завести **`GOOGLE_MAPS_ANDROID_API_KEY` в EAS-окружении `production`** —
    сейчас её там НЕТ (есть только в `development`/`preview`). Без неё
    `app.config.js` не допишет ключ → прод-.aab крашится на открытии карты.
    Значение — тот же ключ, вставить копированием (сверить символ в символ).
  - Ограничение ключа Google Maps: добавить **SHA-1 сертификата Play App
    Signing** (Play Console → Test and release → Setup → App signing → SHA-1
    сертификата *App signing key*) в ограничения ключа (package `com.afkaf.app`
    + этот SHA-1). Play подписывает своим сертификатом, отличным от EAS
    upload-key, — иначе карта в проде будет пустой/битой.
- **Команда сборки (.aab, запускает владелец):**
  `cd "/Users/vladpeskin/afkaf mvp/afkaf-rn-android" && eas build --profile production-android --platform android`

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
  1. **✅ СДЕЛАНО (OTA-JS):** рендерим только пины в видимой области +30%
     (`src/lib/mapViewport.ts`, `selectVisiblePins`, Android-гейт), регион из
     `onRegionChangeComplete`, потолок 150 пинов. Сняло ANR на старте
     WalkScreen (см. БЛОКЕР №1.5). Пины всё ещё children-View — вариант (г) ниже
     добьёт растеризацию.
  2. **✅ СДЕЛАНО (OTA-JS) — вариант (г):** на Android пины рисуются готовыми PNG
     через проп `<Marker image>` без children-View. Снимает и обрезку, и
     растеризацию (нет снапшота вью). PNG-ассеты сгенерированы
     `scripts/gen-marker-pngs.ts` (коммит `2e43d57`), лежат в `assets/markers/`,
     доставляются через EAS Update без новой сборки. Реализация — три коммита:
     - **метки/инфраструктура** (`MapMarkerIcon`, проп `type` → `ANDROID_MARKER_IMAGES`);
     - **пины друзей** (`FriendWalkerMarker` по аватару, выцветание через `opacity`);
     - **свой маркер** (`UserLocationMarkerAndroid`: стрелка с нативным `rotation` +
       статичная лапа + круг точности через `<Circle>`).
     iOS-дерево во всех трёх — байт в байт (ветки `Platform.OS === 'android'`).
  - **Проверить на Samsung после апдейта:** пины не обрезаны (правый/нижний край
    диска цел); мяч на `dog_park` — теннисный, не корт; тап по метке открывает
    кастомный callout, по воде — нативный; пин друга выцветает через ~5 мин и
    исчезает через ~10; свой маркер — стрелка крутится по направлению движения,
    лапа сверху, круг точности виден; всё это без лагов при пане/зуме.

### Обрезка кастомных маркеров на Android — ✅ обойдено PNG-маркерами (вариант г)

- **Статус:** на Android пины больше не рисуются children-View, а отдаются
  готовыми PNG через `image` (см. «Перф карты» выше) — обрезка не воспроизводится
  без новой сборки. Ниже — исходный root cause для контекста; апстрим-фикс
  (нативный) можно подобрать при следующем апгрейде `react-native-maps`.

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
