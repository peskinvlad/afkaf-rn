export interface LatLng {
  latitude: number;
  longitude: number;
}

// Стартовый регион карты до первого GPS-фикса — Бат-Ям (бета живёт здесь).
// Общий для MapScreen и WalkScreen, чтобы не держать две разные точки старта.
export const START_COORD: LatLng = { latitude: 32.0174, longitude: 34.7455 };
export const START_DELTA = 0.018;

// Валидная гео-точка: оба поля — конечные числа в допустимых диапазонах.
// Страховка перед animateToRegion / animateCamera: NaN/undefined в координате
// увозит камеру MapKit в 0,0 — «сплошная вода без берегов и без логотипа».
export function isValidCoord(
  pt: { latitude?: number | null; longitude?: number | null } | null | undefined,
): pt is LatLng {
  return (
    !!pt &&
    Number.isFinite(pt.latitude) &&
    Number.isFinite(pt.longitude) &&
    Math.abs(pt.latitude as number) <= 90 &&
    Math.abs(pt.longitude as number) <= 180
  );
}

// Haversine distance in km between two GPS points
export function haversine(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const sin2 =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.latitude * Math.PI) / 180) *
    Math.cos((b.latitude * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(sin2));
}
