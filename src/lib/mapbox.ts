import { NativeModules } from 'react-native';

// Единственная точка входа в @rnmapbox/maps (ветка exp/mapbox, фаза 1).
//
// Библиотека бросает исключение прямо при импорте, если в сборке нет её
// нативной части (RNMBXModule) — а такая сборка возможна: TestFlight 0.1.0 и
// старый dev-клиент собраны без Mapbox и грузят этот же JS. Поэтому статического
// `import '@rnmapbox/maps'` в проекте быть НЕ должно: сначала проверка модуля,
// потом require — тот же приём, что requireOptionalNativeModule в walkTracking.ts
// (он сам не годится: Mapbox — не Expo-модуль).
export const isMapboxAvailable: boolean = NativeModules.RNMBXModule != null;

export type MapboxModule = typeof import('@rnmapbox/maps');

let cached: MapboxModule | null = null;

// null — в этой сборке Mapbox нет; вызывающий показывает заглушку.
export function getMapbox(): MapboxModule | null {
  if (!isMapboxAvailable) return null;
  if (!cached) cached = require('@rnmapbox/maps') as MapboxModule;
  return cached;
}

// Публичный pk-токен. Секретный sk (download token) библиотеке больше не нужен.
export const MAPBOX_TOKEN: string = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '';

// Вызывается один раз при старте (index.ts). Без нативного модуля или без
// токена — тихий no-op, остальное приложение не затронуто.
export function initMapbox(): void {
  const Mapbox = getMapbox();
  if (!Mapbox) return;
  try {
    // Телеметрия Mapbox выключена по умолчанию (см. docs/MAPBOX-RECON.md, п. 6).
    Mapbox.setTelemetryEnabled(false);
    if (!MAPBOX_TOKEN) {
      console.warn('[mapbox] EXPO_PUBLIC_MAPBOX_TOKEN не задан — карта Mapbox не загрузится.');
      return;
    }
    Mapbox.setAccessToken(MAPBOX_TOKEN).catch((e: unknown) => {
      console.warn('[mapbox] setAccessToken failed:', e);
    });
  } catch (e) {
    console.warn('[mapbox] init failed:', e);
  }
}
