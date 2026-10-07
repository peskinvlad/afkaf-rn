// app.config.js — тонкая надстройка над статичным app.json.
//
// Expo сам читает app.json и передаёт его содержимое сюда как `config`.
// Здесь делаем три вещи (по порядку, каждая независима):
//   1) подключаем config-плагин expo-notifications с кастомными звуками — ВСЕГДА;
//   2) дописываем ключ Google Maps для Android из GOOGLE_MAPS_ANDROID_API_KEY —
//      если переменная задана (иначе warn, не падаем);
//   3) при APP_VARIANT=dev — отдельное dev-приложение рядом с TestFlight/стором.
//
// Mapbox здесь НЕТ (dev-клиент уведомлений не тянет нативный @rnmapbox/maps).
// Без APP_VARIANT конфиг остаётся обычным com.afkaf.app — ровно то, что нужно
// профилю production-android (проверка: `npx expo config --type public --json`).
//
// scheme намеренно НЕ меняется (остаётся afkaf://): редирект входа через Google
// в Supabase разрешён только для afkaf://auth/callback.

const DEV_BUNDLE_ID = 'com.afkaf.app.dev';

// Кастомные звуки уведомлений. Config-плагин expo-notifications бандлит их при
// prebuild: на iOS — в бандл (ссылка по имени файла в content.sound), на Android
// — в res/raw (ссылка по имени в sound канала). Нужно для ВСЕХ вариантов.
const NOTIFICATION_SOUNDS = [
  './assets/sounds/afkaf_home.wav',
  './assets/sounds/afkaf_checkin.wav',
  './assets/sounds/afkaf_alert.wav',
  './assets/sounds/afkaf_notify.wav',
];

module.exports = ({ config }) => {
  // 1) Плагин уведомлений — всегда. icon: белый силуэт на прозрачном фоне для
  //    small-icon статус-бара Android (без него expo берёт app icon → белый
  //    квадрат); Android рисует его по альфа-маске, тон задаёт color. На iOS
  //    icon/color игнорируются (там small-icon берётся из app icon).
  let next = {
    ...config,
    plugins: [
      ...(config.plugins ?? []),
      [
        'expo-notifications',
        {
          sounds: NOTIFICATION_SOUNDS,
          icon: './assets/notification-icon.png',
          color: '#2c5f25',
        },
      ],
    ],
  };

  // 2) Ключ Google Maps для Android. react-native-maps читает его из манифеста
  //    (com.google.android.geo.API_KEY). Без ключа карта на Android не «серая»,
  //    а РОНЯЕТ приложение при создании MapView
  //    (java.lang.RuntimeException: API key not found). Ключ НЕ в git.
  const apiKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  if (apiKey) {
    next = {
      ...next,
      android: {
        ...next.android,
        config: {
          ...next.android?.config,
          googleMaps: {
            ...next.android?.config?.googleMaps,
            apiKey,
          },
        },
      },
    };
  } else {
    console.warn(
      '[app.config] GOOGLE_MAPS_ANDROID_API_KEY не задан — конфиг собран без ' +
        'ключа Google Maps. На Android карта упадёт при открытии. Задайте ' +
        'переменную в EAS (окружения development/preview/production) для рабочей карты.'
    );
  }

  // 3) dev-вариант — только по APP_VARIANT=dev (production-android его не задаёт,
  //    поэтому собирается обычный com.afkaf.app без изменений имени/пакета).
  if (process.env.APP_VARIANT !== 'dev') return next;

  return {
    ...next,
    name: 'afkaf dev',
    ios: {
      ...next.ios,
      bundleIdentifier: DEV_BUNDLE_ID,
    },
    android: {
      ...next.android,
      package: DEV_BUNDLE_ID,
    },
    extra: {
      ...next.extra,
      appVariant: 'dev',
    },
  };
};
