// Определение города по координатам МЕТКИ (не GPS пользователя) — для кнопки
// «Сообщить в мэрию». Чистый TS: ray-casting + расстояние до отрезка в локальной
// эквиректангулярной проекции (метры). Никогда не бросает: любая ошибка → 'unsure'
// со всеми городами.

export type CityId =
  | 'tel_aviv_yafo'
  | 'bat_yam'
  | 'holon'
  | 'rishon_lezion'
  | 'ramat_gan'
  | 'givatayim'
  | 'bnei_brak'
  | 'ramat_hasharon'
  | 'herzliya';

// Фиксированный порядок «все города»: Бат-Ям первым (бета живёт там).
export const ALL_CITIES: CityId[] = [
  'bat_yam',
  'tel_aviv_yafo',
  'holon',
  'rishon_lezion',
  'ramat_gan',
  'givatayim',
  'bnei_brak',
  'ramat_hasharon',
  'herzliya',
];

export type MunicipalityResult =
  | { status: 'sure'; cityId: CityId }
  | { status: 'unsure'; candidates: CityId[] };

export const SURE_MIN_BOUNDARY_M = 150;
export const NEAR_BOUNDARY_M = 1000;

interface RawCity {
  id: string;
  polygons: number[][][]; // кольца [lng,lat]
}
interface RawData {
  version?: number;
  generatedAt?: string | null;
  cities?: RawCity[];
}

interface Ring {
  pts: number[][];
  minLng: number;
  maxLng: number;
  minLat: number;
  maxLat: number;
}
interface City {
  id: CityId;
  rings: Ring[];
}

const M_PER_DEG_LAT = 110540;
const M_PER_DEG_LNG_EQ = 111320;

let cache: City[] | null = null;

function isCityId(id: string): id is CityId {
  return (ALL_CITIES as string[]).includes(id);
}

function loadCities(): City[] {
  if (cache) return cache;
  const raw = require('../data/municipalities.json') as RawData;
  const out: City[] = [];
  for (const c of raw?.cities ?? []) {
    if (!c || !isCityId(c.id) || !Array.isArray(c.polygons)) continue;
    const rings: Ring[] = [];
    for (const pts of c.polygons) {
      if (!Array.isArray(pts) || pts.length < 4) continue;
      let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
      for (const p of pts) {
        if (p[0] < minLng) minLng = p[0];
        if (p[0] > maxLng) maxLng = p[0];
        if (p[1] < minLat) minLat = p[1];
        if (p[1] > maxLat) maxLat = p[1];
      }
      rings.push({ pts, minLng, maxLng, minLat, maxLat });
    }
    if (rings.length) out.push({ id: c.id, rings });
  }
  cache = out;
  return out;
}

// Сколько городов в данных (для DevPanel).
export function municipalityDataCount(): number {
  try {
    return loadCities().length;
  } catch {
    return 0;
  }
}

function pointInRing(lng: number, lat: number, pts: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0], yi = pts[i][1];
    const xj = pts[j][0], yj = pts[j][1];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// Расстояние (м) от точки до ближайшего отрезка кольца; проекция вокруг точки.
function distToRingM(lng: number, lat: number, pts: number[][]): number {
  const kx = M_PER_DEG_LNG_EQ * Math.cos((lat * Math.PI) / 180);
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const ax = (pts[i][0] - lng) * kx;
    const ay = (pts[i][1] - lat) * M_PER_DEG_LAT;
    const bx = (pts[i + 1][0] - lng) * kx;
    const by = (pts[i + 1][1] - lat) * M_PER_DEG_LAT;
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 === 0 ? 0 : (-ax * dx - ay * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const d = Math.hypot(ax + t * dx, ay + t * dy);
    if (d < best) best = d;
  }
  return best;
}

export function resolveMunicipality(lat: number, lng: number): MunicipalityResult {
  const fallback: MunicipalityResult = { status: 'unsure', candidates: [...ALL_CITIES] };
  try {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return fallback;
    const cities = loadCities();
    if (!cities.length) return fallback;

    // Запас bbox ≈ NEAR_BOUNDARY_M в градусах: дальше кольцо не может быть «рядом».
    const padLat = NEAR_BOUNDARY_M / M_PER_DEG_LAT;
    const padLng = NEAR_BOUNDARY_M / (M_PER_DEG_LNG_EQ * Math.cos((lat * Math.PI) / 180));

    const hits: { id: CityId; inside: boolean; dist: number }[] = [];
    for (const city of cities) {
      let inside = false;
      let dist = Infinity;
      for (const r of city.rings) {
        if (
          lat < r.minLat - padLat || lat > r.maxLat + padLat ||
          lng < r.minLng - padLng || lng > r.maxLng + padLng
        ) continue;
        if (pointInRing(lng, lat, r.pts)) inside = true;
        const d = distToRingM(lng, lat, r.pts);
        if (d < dist) dist = d;
      }
      if (inside || dist < NEAR_BOUNDARY_M) hits.push({ id: city.id, inside, dist });
    }

    const containing = hits.filter((h) => h.inside);
    if (containing.length === 1 && containing[0].dist >= SURE_MIN_BOUNDARY_M) {
      return { status: 'sure', cityId: containing[0].id };
    }
    if (!hits.length) return fallback;
    hits.sort((a, b) => (a.inside === b.inside ? a.dist - b.dist : a.inside ? -1 : 1));
    return { status: 'unsure', candidates: hits.map((h) => h.id) };
  } catch {
    return fallback;
  }
}
