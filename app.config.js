// app.config.js — тонкая надстройка над статичным app.json (ветка exp/mapbox).
//
// Expo сам читает app.json и передаёт его содержимое сюда как `config`.
//
// Без переменной APP_VARIANT конфиг возвращается БЕЗ ИЗМЕНЕНИЙ — ровно то, что
// в app.json (проверка: `npx expo config --type public --json`).
//
// APP_VARIANT=dev — отдельное dev-приложение, которое ставится на телефон рядом
// с TestFlight-сборкой:
//   • имя «afkaf dev», bundle id (iOS) и package (Android) com.afkaf.app.dev;
//   • плагин @rnmapbox/maps (нативная часть Mapbox) — только здесь, чтобы
//     обычный конфиг оставался прежним;
//   • extra.appVariant = 'dev' — по нему JS узнаёт dev-приложение
//     (src/constants/appVariant.ts): DevPanel открывается без входа в аккаунт;
//   • Android: ключ Google Maps из переменной GOOGLE_MAPS_ANDROID_API_KEY
//     (заведена в EAS, окружение development) — тот же приём, что в
//     app.config.js на ветке exp/android. Ключ НЕ хранится в git. Главная карта
//     пока на react-native-maps, а он на Android без ключа не «серый», а РОНЯЕТ
//     приложение при создании MapView (java.lang.RuntimeException: API key not
//     found) — до DevPanel и тестового экрана Mapbox было бы не дойти.
//
// scheme намеренно НЕ меняется (остаётся afkaf://): редирект входа через Google
// в Supabase разрешён только для afkaf://auth/callback. См. CLAUDE.md,
// раздел «Ветка exp/mapbox».

const DEV_BUNDLE_ID = 'com.afkaf.app.dev';

module.exports = ({ config }) => {
  if (process.env.APP_VARIANT !== 'dev') return config;

  const googleMapsApiKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;

  // Локальный запуск без переменной (например `expo start` без EAS-окружения):
  // не падаем на чтении конфига, просто не добавляем ключ. Предупреждаем явно,
  // потому что Android-сборка без ключа для главной карты непригодна (см. выше).
  if (!googleMapsApiKey) {
    console.warn(
      '[app.config] GOOGLE_MAPS_ANDROID_API_KEY не задан — dev-конфиг собран без ' +
        'ключа Google Maps. Android-сборка с таким конфигом упадёт на главной ' +
        'карте. Для iOS и для `expo start` это не важно.'
    );
  }

  return {
    ...config,
    name: 'afkaf dev',
    ios: {
      ...config.ios,
      bundleIdentifier: DEV_BUNDLE_ID,
    },
    android: {
      ...config.android,
      package: DEV_BUNDLE_ID,
      ...(googleMapsApiKey && {
        config: {
          ...config.android?.config,
          googleMaps: {
            ...config.android?.config?.googleMaps,
            apiKey: googleMapsApiKey,
          },
        },
      }),
    },
    plugins: [...(config.plugins ?? []), '@rnmapbox/maps'],
    extra: {
      ...config.extra,
      appVariant: 'dev',
    },
  };
};
