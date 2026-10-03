// app.config.js — тонкая надстройка над статичным app.json.
//
// Перенесено точечно с ветки exp/mapbox, НО БЕЗ кода Mapbox: dev-клиент
// уведомлений едет к тестерам отдельно и не тянет нативный @rnmapbox/maps.
//
// Expo сам читает app.json и передаёт его сюда как `config`. Без переменной
// APP_VARIANT конфиг возвращается БЕЗ ИЗМЕНЕНИЙ — ровно то, что в app.json
// (проверка: `npx expo config --type public --json`).
//
// APP_VARIANT=dev — отдельное dev-приложение рядом с TestFlight-сборкой:
//   • имя «afkaf dev», bundle id (iOS) и package (Android) com.afkaf.app.dev;
//   • extra.appVariant = 'dev' — по нему JS узнаёт dev-приложение
//     (src/constants/appVariant.ts): DevPanel открывается без входа в аккаунт.
//
// scheme намеренно НЕ меняется (остаётся afkaf://): редирект входа через Google
// в Supabase разрешён только для afkaf://auth/callback.

const DEV_BUNDLE_ID = 'com.afkaf.app.dev';

module.exports = ({ config }) => {
  if (process.env.APP_VARIANT !== 'dev') return config;

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
    },
    extra: {
      ...config.extra,
      appVariant: 'dev',
    },
  };
};
