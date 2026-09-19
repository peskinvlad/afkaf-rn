// app.config.js — тонкая надстройка над статичным app.json.
//
// Expo сам читает app.json и передаёт его содержимое сюда как `config`.
// Единственное, что мы здесь делаем — дописываем ключ Google Maps для Android
// из переменной окружения GOOGLE_MAPS_ANDROID_API_KEY (заведена в EAS для
// окружений development и preview). Ключ НЕ хранится в git и НЕ попадает в
// app.json. iOS-часть конфига не трогаем — она остаётся ровно как в app.json.
//
// react-native-maps на Android читает этот ключ из манифеста
// (com.google.android.geo.API_KEY). Без ключа карта на Android не «серая», а
// РОНЯЕТ приложение при создании MapView
// (java.lang.RuntimeException: API key not found).

module.exports = ({ config }) => {
  const apiKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;

  // Локальный запуск без переменной (например `expo start` без EAS-окружения):
  // не падаем на чтении конфига, просто не добавляем ключ. Предупреждаем явно,
  // потому что Android-сборка без ключа для карты непригодна (см. выше).
  if (!apiKey) {
    console.warn(
      '[app.config] GOOGLE_MAPS_ANDROID_API_KEY не задан — конфиг собран без ' +
        'ключа Google Maps. На Android карта упадёт при открытии. Задайте ' +
        'переменную в EAS (окружения development/preview) для рабочей карты.'
    );
    return config;
  }

  return {
    ...config,
    android: {
      ...config.android,
      config: {
        ...config.android?.config,
        googleMaps: {
          ...config.android?.config?.googleMaps,
          apiKey,
        },
      },
    },
  };
};
