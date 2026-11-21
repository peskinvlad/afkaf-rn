/**
 * Скачивает границы 9 муниципалитетов Гуш-Дана из OpenStreetMap (Overpass API)
 * и пишет упрощённый файл src/data/municipalities.json для кнопки
 * «Сообщить в мэрию» (src/lib/municipality.ts).
 *
 * ЗАПУСК (на Mac владельца, нужен интернет и Node 18+):
 *
 *   cd "/Users/vladpeskin/afkaf mvp/afkaf-rn" && npx tsx scripts/fetch-municipalities.ts
 *
 * (Альтернатива без tsx: Node 22.6+ —
 *   node --experimental-strip-types scripts/fetch-municipalities.ts)
 *
 * Только встроенные модули Node (global fetch, fs, path) — зависимостей нет.
 * Что делает: Overpass → boundary=administrative, admin_level=8, по ивритскому
 * name → сборка внешних контуров (outer) из ways в замкнутые кольца →
 * Дуглас–Пекер ~30 м → округление до 5 знаков → JSON. Внутренние дыры (inner)
 * игнорируются: анклав чужого города даст «пересечение» → пользователь выберет
 * город вручную. Если какого-то города не нашли — печатает ошибку и выходит с
 * кодом 1, файл при этом НЕ перезаписывается.
 */
import { writeFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

type Pt = [number, number]; // [lng, lat]

const CITIES: { id: string; he: string; wikidata?: string }[] = [
  { id: 'tel_aviv_yafo', he: 'תל אביב-יפו', wikidata: 'Q33935' },
  { id: 'bat_yam', he: 'בת ים' },
  { id: 'holon', he: 'חולון' },
  { id: 'rishon_lezion', he: 'ראשון לציון' },
  { id: 'ramat_gan', he: 'רמת גן' },
  { id: 'givatayim', he: 'גבעתיים' },
  { id: 'bnei_brak', he: 'בני ברק' },
  { id: 'ramat_hasharon', he: 'רמת השרון' },
  { id: 'herzliya', he: 'הרצליה' },
];

const TOLERANCE_M = 30;
const ENDPOINTS = [
  ...(process.env.OVERPASS_URL ? [process.env.OVERPASS_URL] : []),
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

// Дефисы в OSM бывают разные (-, ‐, –, ־) — приводим к одному виду.
// Сравниваем без пробелов и любых дефисов: «תל־אביב–יפו» == «תל אביב-יפו».
const norm = (s: string) => s.replace(/[\s\-‐-―־]/g, '');

interface OverpassMember {
  type: string;
  role: string;
  geometry?: { lat: number; lon: number }[];
}
interface OverpassRelation {
  id: number;
  tags?: Record<string, string>;
  members?: OverpassMember[];
}

async function queryOverpass(): Promise<OverpassRelation[]> {
  // Дефис/макаф/тире в именах могут быть разными — в регулярке любой символ (.).
  // Пробел/дефис/макаф между словами — 1–3 любых символа.
  const names = CITIES.map((c) => c.he.replace(/[ -]+/g, '.{1,3}')).join('|');
  const wd = CITIES.filter((c) => c.wikidata).map((c) => c.wikidata).join('|');
  const bbox = '(31.88,34.68,32.22,34.92)';
  const ql = `[out:json][timeout:90];
(
  relation["boundary"="administrative"]["admin_level"="8"]["name"~"^(${names})$"]${bbox};
  relation["boundary"="administrative"]["wikidata"~"^(${wd})$"]${bbox};
);
out geom;`;
  let lastErr: unknown = null;
  for (const url of ENDPOINTS) {
    try {
      console.log(`Overpass: ${url}`);
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'afkaf-municipality-fetch/1.0',
        },
        body: 'data=' + encodeURIComponent(ql),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { elements?: OverpassRelation[] };
      return json.elements ?? [];
    } catch (e) {
      lastErr = e;
      console.warn(`  не вышло: ${(e as Error).message}`);
    }
  }
  throw new Error(`Overpass недоступен: ${(lastErr as Error)?.message}`);
}

const key = (p: Pt) => `${p[0].toFixed(7)},${p[1].toFixed(7)}`;

// Склеивает ways (массивы точек) в замкнутые кольца по совпадающим концам.
function assembleRings(ways: Pt[][]): Pt[][] {
  const pool = ways.filter((w) => w.length >= 2).map((w) => w.slice());
  const rings: Pt[][] = [];
  while (pool.length) {
    let ring = pool.pop() as Pt[];
    let progressed = true;
    while (key(ring[0]) !== key(ring[ring.length - 1]) && progressed) {
      progressed = false;
      const head = key(ring[0]);
      const tail = key(ring[ring.length - 1]);
      for (let i = 0; i < pool.length; i++) {
        const w = pool[i];
        const wHead = key(w[0]);
        const wTail = key(w[w.length - 1]);
        if (wHead === tail) ring = ring.concat(w.slice(1));
        else if (wTail === tail) ring = ring.concat(w.slice(0, -1).reverse());
        else if (wTail === head) ring = w.concat(ring.slice(1));
        else if (wHead === head) ring = w.slice(1).reverse().concat(ring);
        else continue;
        pool.splice(i, 1);
        progressed = true;
        break;
      }
    }
    if (key(ring[0]) === key(ring[ring.length - 1]) && ring.length >= 4) rings.push(ring);
    else console.warn(`  незамкнутое кольцо из ${ring.length} точек — пропущено`);
  }
  return rings;
}

// Локальная проекция в метры (достаточно для упрощения на масштабе города).
function toXY(p: Pt, lat0: number): [number, number] {
  return [p[0] * 111320 * Math.cos((lat0 * Math.PI) / 180), p[1] * 110540];
}

function perpDist(p: [number, number], a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

// Дуглас–Пекер, итеративный (без рекурсии — кольца бывают в тысячи точек).
function simplify(points: Pt[], tolM: number): Pt[] {
  if (points.length <= 4) return points;
  const lat0 = points[0][1];
  const xy = points.map((p) => toXY(p, lat0));
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop() as [number, number];
    let maxD = 0;
    let idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = perpDist(xy[i], xy[s], xy[e]);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (idx !== -1 && maxD > tolM) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

const round5 = (n: number) => Math.round(n * 1e5) / 1e5;

async function main() {
  const rels = await queryOverpass();
  console.log(`Получено relations: ${rels.length}`);

  const cities: { id: string; polygons: Pt[][] }[] = [];
  const missing: string[] = [];

  for (const city of CITIES) {
    const candidates = rels.filter(
      (r) =>
        norm(r.tags?.name ?? '') === norm(city.he) ||
        (!!city.wikidata && r.tags?.wikidata === city.wikidata),
    );
    if (!candidates.length) {
      missing.push(`${city.id} (${city.he})`);
      continue;
    }
    // Если relations несколько (дубли) — берём с наибольшим числом точек.
    let best: Pt[][] = [];
    let bestCount = -1;
    for (const rel of candidates) {
      const outerWays: Pt[][] = (rel.members ?? [])
        .filter((m) => m.type === 'way' && m.role === 'outer' && m.geometry?.length)
        .map((m) => (m.geometry as { lat: number; lon: number }[]).map((g) => [g.lon, g.lat] as Pt));
      const rings = assembleRings(outerWays);
      const count = rings.reduce((s, r) => s + r.length, 0);
      if (count > bestCount) {
        best = rings;
        bestCount = count;
      }
    }
    if (!best.length) {
      missing.push(`${city.id} (${city.he}) — нет замкнутых контуров`);
      continue;
    }
    const polygons = best
      .map((r) => simplify(r, TOLERANCE_M).map((p): Pt => [round5(p[0]), round5(p[1])]))
      .filter((r) => r.length >= 4);
    const before = best.reduce((s, r) => s + r.length, 0);
    const after = polygons.reduce((s, r) => s + r.length, 0);
    console.log(`  ${city.id}: колец ${polygons.length}, точек ${before} → ${after}`);
    cities.push({ id: city.id, polygons });
  }

  if (missing.length) {
    console.error('\nОШИБКА: не найдены / не собраны города:');
    for (const m of missing) console.error(`  - ${m}`);
    console.error('Файл НЕ перезаписан.');
    process.exit(1);
  }

  const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'municipalities.json');
  const data = { version: 1, generatedAt: new Date().toISOString(), cities };
  writeFileSync(out, JSON.stringify(data));
  console.log(`\nГотово: ${out}`);
  console.log(`Размер: ${(statSync(out).size / 1024).toFixed(1)} КБ`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
