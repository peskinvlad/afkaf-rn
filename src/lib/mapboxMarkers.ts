import { ANDROID_MARKER_IMAGES } from './markerImages';
import type { MapMarker, WaterSource } from './markerConfig';
import { isValidCoord } from './geo';

// Слой инфраструктуры (площадки, парки, вода) для карт на Mapbox: общий для
// главной карты и тестового экрана. Решение 25.11.2026 (docs/MAPBOX-MIGRATION.md):
// кластеров нет, при отдалении значки «сжимаются» в цветные точки, а издалека
// типы появляются по очереди. Опасные пользовательские метки сюда НЕ входят —
// они рисуются отдельно, всегда значком и поверх.

export const INFRA_GREEN = '#2c5f25';
export const INFRA_BLUE = '#3b82f6';

// Картинки значков — те же PNG, что рисует Android-ветка (assets/markers).
// Слой Mapbox эмодзи текстом не рисует — только картинками.
export const INFRA_ICON_PREFIX = 'marker-';
export const INFRA_IMAGES: Record<string, number> = Object.fromEntries(
  Object.entries(ANDROID_MARKER_IMAGES).map(([type, source]) => [INFRA_ICON_PREFIX + type, source]),
);

// ── Пороги по зуму (одобрены на телефоне 25.11.2026 как есть) ────────────────
// Точка → значок: перекрёстное затухание между SHRINK_FADE_FROM и SHRINK_FADE_TO;
// значок дорастает до полного размера к SHRINK_FULL_ZOOM.
export const SHRINK_FADE_FROM = 13;
export const SHRINK_FADE_TO = 13.8;
export const SHRINK_FULL_ZOOM = 16.5;
// Прореживание издалека по смыслу, не случайно: собачьи площадки видны всегда
// (главные точки назначения), парки — с DOTS_PARKS_FROM, вода — с DOTS_WATER_FROM.
export const DOTS_PARKS_FROM = 11;
export const DOTS_WATER_FROM = 12;
const DOT_FADE = 0.3; // за сколько единиц зума новая группа точек проявляется

// ['zoom'] в Mapbox можно ставить только входом верхнего interpolate/step, поэтому
// «появление по типу» и «угасание в значок» собраны в ОДНУ шкалу, а различие по
// типу — в значениях её ступеней.
const ONLY_DOG_PARKS = ['match', ['get', 'type'], 'dog_park', 1, 0];
const PARKS_TOO = ['match', ['get', 'type'], 'water', 0, 1];
const DOT_OPACITY = [
  'interpolate', ['linear'], ['zoom'],
  DOTS_PARKS_FROM, ONLY_DOG_PARKS,
  DOTS_PARKS_FROM + DOT_FADE, PARKS_TOO,
  DOTS_WATER_FROM, PARKS_TOO,
  DOTS_WATER_FROM + DOT_FADE, 1,
  SHRINK_FADE_FROM, 1,
  SHRINK_FADE_TO, 0,
];

// Тот же порядок появления — фильтром слоя, чтобы ещё невидимая точка не ловила тап.
export const INFRA_DOT_FILTER = [
  'step', ['zoom'],
  ['==', ['get', 'type'], 'dog_park'],
  DOTS_PARKS_FROM, ['!=', ['get', 'type'], 'water'],
  DOTS_WATER_FROM, true,
] as never;

// Стили слоёв — константы модуля: стабильные ссылки, перерисовка экрана ничего
// не шлёт в натив. `visibility` тестовый экран добавляет сам (у него есть режим
// сравнения с кластерами); главная карта использует как есть.
export const INFRA_DOT_STYLE = {
  circleColor: ['match', ['get', 'type'], 'water', INFRA_BLUE, INFRA_GREEN],
  circleRadius: ['interpolate', ['linear'], ['zoom'], 9, 1.5, 12, 3, SHRINK_FADE_FROM, 5],
  circleStrokeColor: '#ffffff',
  circleStrokeWidth: ['interpolate', ['linear'], ['zoom'], 9, 0, 12, 1, SHRINK_FADE_FROM, 1.5],
  circleOpacity: DOT_OPACITY,
  circleStrokeOpacity: DOT_OPACITY,
} as never;

export const INFRA_ICON_STYLE = {
  iconImage: ['get', 'icon'],
  iconSize: ['interpolate', ['linear'], ['zoom'], SHRINK_FADE_FROM, 0.45, 15, 0.75, SHRINK_FULL_ZOOM, 1],
  iconOpacity: ['interpolate', ['linear'], ['zoom'], SHRINK_FADE_FROM, 0, SHRINK_FADE_TO, 1],
  iconAllowOverlap: true,
  iconIgnorePlacement: true,
} as never;

// ── Данные слоя ──────────────────────────────────────────────────────────────
export type InfraPointProps = {
  // 'marker' — строка таблицы markers (есть карточка метки); 'water' — точка
  // воды из OSM (water_sources), карточки нет.
  kind: 'marker' | 'water';
  // id строки в своей таблице (для 'marker' — markers.id).
  rowId: string;
  type: string;
  title: string;
  icon: string;
};

export function infraFeatureCollection(
  infraMarkers: MapMarker[],
  waterSources: WaterSource[],
): GeoJSON.FeatureCollection<GeoJSON.Point, InfraPointProps> {
  const features: GeoJSON.Feature<GeoJSON.Point, InfraPointProps>[] = [];
  for (const m of infraMarkers) {
    if (!isValidCoord({ latitude: m.lat, longitude: m.lng })) continue;
    features.push({
      type: 'Feature',
      id: `m-${m.id}`,
      geometry: { type: 'Point', coordinates: [m.lng, m.lat] },
      properties: {
        kind: 'marker',
        rowId: String(m.id),
        type: m.type,
        title: m.description?.trim() || m.type,
        // Неизвестный тип без своей картинки рисуем как парк, а не пустотой.
        icon: INFRA_ICON_PREFIX + (INFRA_IMAGES[INFRA_ICON_PREFIX + m.type] ? m.type : 'park'),
      },
    });
  }
  for (const w of waterSources) {
    if (!isValidCoord({ latitude: w.lat, longitude: w.lng })) continue;
    features.push({
      type: 'Feature',
      id: `w-${w.id}`,
      geometry: { type: 'Point', coordinates: [w.lng, w.lat] },
      properties: {
        kind: 'water',
        rowId: String(w.id),
        type: 'water',
        title: w.amenity ?? 'water',
        icon: INFRA_ICON_PREFIX + 'water',
      },
    });
  }
  return { type: 'FeatureCollection', features };
}
