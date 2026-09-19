# Android TODO (пост-первая-сборка)

Список отложенных задач по Android. Заведён при подготовке первой Android
development-сборки (dev client, APK) на ветке `exp/android`. Сегодня НЕ делаем —
цель первой сборки была только «собралось, установилось, запустилось, вход
через Google работает». Разбирать по мере готовности.

## Карта (Google Maps)

- **Ключ Google Maps API.** Сегодня собираем БЕЗ ключа — карта будет пустой
  (серая сетка), приложение при этом не падает. Позже завести ключ «чистым»
  вариантом:
  - Google Cloud Console → включить **Maps SDK for Android** → создать **API key**.
  - Ограничить ключ по **package** (`com.afkaf.app`) + **SHA-1** отпечатку
    keystore (SHA-1 берётся из `eas credentials` после первой сборки).
  - Ключ НЕ коммитить: завести `EXPO_PUBLIC_*` переменную в EAS (environment
    `development`) + добавить `app.config.js`, который подставит её в
    `expo.android.config.googleMaps.apiKey`. (Сейчас конфиг статичный `app.json`
    без `app.config.js`.)

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
