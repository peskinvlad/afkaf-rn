import { LatLng, isValidCoord } from './geo';

// Чистая геометрия для экранов на Mapbox (без импорта библиотеки — годится и в
// сборке без нативной части). Тест: scripts/test-mapbox-geo.ts.
//
// Mapbox считает координаты как [долгота, широта] — обратно нашему LatLng.
export type LngLat = [number, number];

export const toLngLat = (p: LatLng): LngLat => [p.longitude, p.latitude];
export const fromLngLat = (p: ArrayLike<number>): LatLng => ({ latitude: p[1], longitude: p[0] });

const EARTH_CIRCUMFERENCE_M = 40_075_016.686;
const M_PER_DEG_LAT = 111_320;

// Метров в одной точке экрана на зуме Mapbox. Плитка Mapbox GL — 512 pt, поэтому
// его зум на 1 меньше «привычного» (Google/Apple, плитка 256): зум 14 у Mapbox ≈
// «зум 15» из старого кода. Формула web-mercator, зависит от широты.
export function metersPerPoint(latitudeDeg: number, zoom: number): number {
  return (
    (EARTH_CIRCUMFERENCE_M * Math.cos((latitudeDeg * Math.PI) / 180)) / (512 * Math.pow(2, zoom))
  );
}

// Радиус в метрах → радиус в точках экрана при текущей камере.
export function metersToPoints(meters: number, latitudeDeg: number, zoom: number): number {
  return meters / metersPerPoint(latitudeDeg, zoom);
}

// Круг радиусом radiusM вокруг центра — замкнутый многоугольник для FillLayer /
// LineLayer. На масштабах в сотни метров плоское приближение точнее пикселя.
export function circlePolygon(
  center: LatLng,
  radiusM: number,
  steps = 64,
): GeoJSON.Feature<GeoJSON.Polygon> {
  const dLat = radiusM / M_PER_DEG_LAT;
  const dLng = radiusM / (M_PER_DEG_LAT * Math.cos((center.latitude * Math.PI) / 180));
  const ring: LngLat[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = (2 * Math.PI * i) / steps;
    ring.push([center.longitude + dLng * Math.cos(a), center.latitude + dLat * Math.sin(a)]);
  }
  ring[steps] = ring[0]; // замкнуть ровно той же точкой
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } };
}

// Трек → LineString (битые точки выброшены). null, если рисовать нечего.
export function trackLine(points: LatLng[]): GeoJSON.Feature<GeoJSON.LineString> | null {
  const coords = points.filter((p) => isValidCoord(p)).map(toLngLat);
  if (coords.length < 2) return null;
  return { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } };
}

export type TrackBounds = { ne: LngLat; sw: LngLat };

// Минимальный размах рамки: трек «потоптался у подъезда» не должен давать
// максимальный зум в стену дома. ~120 м по каждой оси.
const MIN_SPAN_M = 120;

// Рамка вокруг трека для Camera.bounds. Вырожденный трек (все точки рядом)
// расширяется до MIN_SPAN_M. null — валидных точек нет.
export function trackBounds(points: LatLng[]): TrackBounds | null {
  const valid = points.filter((p) => isValidCoord(p));
  if (valid.length === 0) return null;
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const p of valid) {
    if (p.latitude < minLat) minLat = p.latitude;
    if (p.latitude > maxLat) maxLat = p.latitude;
    if (p.longitude < minLng) minLng = p.longitude;
    if (p.longitude > maxLng) maxLng = p.longitude;
  }
  const midLat = (minLat + maxLat) / 2;
  const minDLat = MIN_SPAN_M / M_PER_DEG_LAT;
  const minDLng = MIN_SPAN_M / (M_PER_DEG_LAT * Math.cos((midLat * Math.PI) / 180));
  if (maxLat - minLat < minDLat) {
    minLat = midLat - minDLat / 2;
    maxLat = midLat + minDLat / 2;
  }
  if (maxLng - minLng < minDLng) {
    const midLng = (minLng + maxLng) / 2;
    minLng = midLng - minDLng / 2;
    maxLng = midLng + minDLng / 2;
  }
  return { ne: [maxLng, maxLat], sw: [minLng, minLat] };
}

// Точка на отрезке anchor→point на расстоянии не дальше maxM от anchor: если
// point внутри круга — она сама, иначе — проекция на край (линейная интерполяция,
// на 150 м точна с запасом). distM — уже посчитанное расстояние anchor→point.
export function clampToRadius(anchor: LatLng, point: LatLng, distM: number, maxM: number): LatLng {
  if (distM <= maxM || distM === 0) return point;
  const ratio = maxM / distM;
  return {
    latitude: anchor.latitude + (point.latitude - anchor.latitude) * ratio,
    longitude: anchor.longitude + (point.longitude - anchor.longitude) * ratio,
  };
}
