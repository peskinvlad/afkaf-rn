/**
 * import-osm.ts — одноразовый генератор seed-SQL по инфраструктуре Гуш-Дана.
 *
 * ЧТО ДЕЛАЕТ: тянет из OpenStreetMap (Overpass API) три категории и ПИШЕТ
 * файл supabase/seed/gush-dan-osm.sql. В БД НЕ пишет — SQL применяешь ты сам.
 *
 *   amenity=drinking_water → public.water_sources  (ON CONFLICT (osm_id) DO NOTHING)
 *   leisure=park           → public.markers type='park'      (постоянные)
 *   leisure=dog_park       → public.markers type='dog_park'  (постоянные)
 *
 * BBOX Гуш-Дана (юг, запад, север, восток) — СВЕРЬ:
 *   south = 31.93   (южнее Ришон-ле-Циона)
 *   west  = 34.72   (средиземноморское побережье, западнее Бат-Яма/Тель-Авива)
 *   north = 32.20   (севернее Герцлии)
 *   east  = 34.86   (восточнее Ришона/Герцлии)
 *   Покрывает: Ришон-ле-Цион, Бат-Ям, Холон, Яффо, Тель-Авив, Герцлия.
 *
 * ПОСТОЯННЫЕ МАРКЕРЫ (park/dog_park):
 *   user_id = e57637d6-7b83-465c-8263-6ca0fa822ab4 (куратор, как у июньских),
 *   expires_at = NULL, confirmations = 0, denials = 0,
 *   description = name:he || name || NULL.
 *   Парки/собачьи парки в OSM — чаще way/relation: берём центроид (out center),
 *   osm_id пишем как "way/123" / "relation/456" (в SQL для markers osm_id нет —
 *   колонки нет; osm_id используется только для внутреннего дедупа/логов).
 *
 * ДЕДУП ПАРКОВ (у markers нет osm_id):
 *   1) против существующих постоянных маркеров того же типа (снимок ниже) — <50 м → пропуск;
 *   2) против уже принятых в этом же прогоне того же типа — <50 м → пропуск
 *      (way+relation одного парка дают близкие центроиды).
 *   В SQL markers дополнительно завёрнут в NOT EXISTS(<50 м, тот же тип) —
 *   идемпотентность при повторном запуске файла.
 *
 * ВОДА: dog_bowl = false, дедуп на стороне БД через ON CONFLICT (osm_id).
 *
 * ЗАПУСК:  node scripts/import-osm.ts     (Node ≥23 — стрип TS-типов встроен)
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

// ── Конфиг ──────────────────────────────────────────────────────────────────
const BBOX = { south: 31.93, west: 34.72, north: 32.20, east: 34.86 };
const CURATOR_ID = 'e57637d6-7b83-465c-8263-6ca0fa822ab4';
const DEDUP_METERS = 50;
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const OUT_PATH = resolve(import.meta.dirname, '../supabase/seed/gush-dan-osm.sql');

// Снимок существующих ПОСТОЯННЫХ маркеров (expires_at IS NULL) на 2026-09-15.
// Используется только для дедупа парков (dog_park в БД пока нет).
const EXISTING_MARKERS: { type: string; lat: number; lng: number }[] = [
  { type: 'park', lat: 32.0316536687808, lng: 34.7484944167695 },
  { type: 'park', lat: 32.0367722689541, lng: 34.752215271623 },
  { type: 'park', lat: 32.0379814879387, lng: 34.7600939580518 },
  { type: 'park', lat: 32.0191748047463, lng: 34.7437476167212 },
  { type: 'park', lat: 32.0047158670851, lng: 34.7337422038374 },
];

// ── Типы ────────────────────────────────────────────────────────────────────
interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}
interface WaterRow { osmId: string; lat: number; lng: number }
interface MarkerRow { osmId: string; type: 'park' | 'dog_park'; src: 'node' | 'way' | 'relation'; lat: number; lng: number; description: string | null }

// ── Утилиты ─────────────────────────────────────────────────────────────────
function haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
const round7 = (n: number): number => Math.round(n * 1e7) / 1e7;
const sqlStr = (s: string): string => `'${s.replace(/'/g, "''")}'`;
const sqlDesc = (d: string | null): string => (d === null ? 'NULL' : sqlStr(d));

function coordsOf(el: OverpassElement): { lat: number; lng: number } | null {
  if (typeof el.lat === 'number' && typeof el.lon === 'number') return { lat: el.lat, lng: el.lon };
  if (el.center) return { lat: el.center.lat, lng: el.center.lon };
  return null;
}
function nameOf(tags: Record<string, string> | undefined): string | null {
  if (!tags) return null;
  return tags['name:he'] ?? tags['name'] ?? null;
}

// ── Overpass ────────────────────────────────────────────────────────────────
function buildQuery(): string {
  const bb = `${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east}`;
  return `[out:json][timeout:180];
(
  node["amenity"="drinking_water"](${bb});
  way["amenity"="drinking_water"](${bb});
  node["leisure"="park"](${bb});
  way["leisure"="park"](${bb});
  relation["leisure"="park"](${bb});
  node["leisure"="dog_park"](${bb});
  way["leisure"="dog_park"](${bb});
  relation["leisure"="dog_park"](${bb});
);
out center tags;`;
}

async function fetchOverpass(): Promise<OverpassElement[]> {
  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'User-Agent': 'afkaf-rn/osm-import (one-off seed script; contact peskin.vlad@gmail.com)',
    },
    body: 'data=' + encodeURIComponent(buildQuery()),
  });
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { elements: OverpassElement[] };
  return json.elements ?? [];
}

// ── Классификация + дедуп ───────────────────────────────────────────────────
function classify(elements: OverpassElement[]) {
  const water: WaterRow[] = [];
  const waterSeen = new Set<string>();
  const parks: MarkerRow[] = [];
  const dogParks: MarkerRow[] = [];

  let noCoords = 0;
  let waterDupInRun = 0;

  for (const el of elements) {
    const tags = el.tags ?? {};
    const c = coordsOf(el);
    if (!c) { noCoords++; continue; }
    const osmId = `${el.type}/${el.id}`;
    const lat = round7(c.lat);
    const lng = round7(c.lng);

    if (tags.amenity === 'drinking_water') {
      if (waterSeen.has(osmId)) { waterDupInRun++; continue; }
      waterSeen.add(osmId);
      water.push({ osmId, lat, lng });
    } else if (tags.leisure === 'dog_park') {
      dogParks.push({ osmId, type: 'dog_park', src: el.type, lat, lng, description: nameOf(tags) });
    } else if (tags.leisure === 'park') {
      parks.push({ osmId, type: 'park', src: el.type, lat, lng, description: nameOf(tags) });
    }
  }
  return { water, parks, dogParks, noCoords, waterDupInRun };
}

// park: берём ТОЛЬКО полигоны (way/relation) с именем (name / name:he). Ноды не берём.
function filterParks(rows: MarkerRow[]) {
  const kept: MarkerRow[] = [];
  let droppedNodes = 0;
  let droppedUnnamed = 0;
  for (const r of rows) {
    if (r.src === 'node') { droppedNodes++; continue; }
    if (r.description === null) { droppedUnnamed++; continue; }
    kept.push(r);
  }
  return { kept, droppedNodes, droppedUnnamed };
}

// dog_park: схлопнуть node+way одного объекта — предпочесть полигон.
// node отбрасывается, если в ≤150 м есть полигон с тем же именем ИЛИ node без имени.
function collapseDogParks(rows: MarkerRow[]) {
  const polygons = rows.filter((r) => r.src === 'way' || r.src === 'relation');
  const nodes = rows.filter((r) => r.src === 'node');
  const keptNodes: MarkerRow[] = [];
  let droppedNodes = 0;
  for (const n of nodes) {
    const covered = polygons.some(
      (p) =>
        haversineMeters(p.lat, p.lng, n.lat, n.lng) <= 150 &&
        (n.description === null || n.description === p.description),
    );
    if (covered) { droppedNodes++; continue; }
    keptNodes.push(n);
  }
  return {
    kept: [...polygons, ...keptNodes],
    polygonCount: polygons.length,
    nodeKept: keptNodes.length,
    droppedNodes,
  };
}

// Дедуп маркеров: vs существующие (снимок) и vs уже принятые в прогоне.
function dedupMarkers(rows: MarkerRow[], type: string) {
  const existing = EXISTING_MARKERS.filter((m) => m.type === type);
  const accepted: MarkerRow[] = [];
  let droppedVsExisting = 0;
  let droppedInRun = 0;

  for (const r of rows) {
    const nearExisting = existing.some((m) => haversineMeters(m.lat, m.lng, r.lat, r.lng) < DEDUP_METERS);
    if (nearExisting) { droppedVsExisting++; continue; }
    const nearAccepted = accepted.some((a) => haversineMeters(a.lat, a.lng, r.lat, r.lng) < DEDUP_METERS);
    if (nearAccepted) { droppedInRun++; continue; }
    accepted.push(r);
  }
  return { accepted, droppedVsExisting, droppedInRun };
}

// ── SQL ─────────────────────────────────────────────────────────────────────
function buildSql(water: WaterRow[], parks: MarkerRow[], dogParks: MarkerRow[]): string {
  const lines: string[] = [];
  lines.push('-- gush-dan-osm.sql — СГЕНЕРИРОВАНО scripts/import-osm.ts (не редактировать вручную).');
  lines.push(`-- Источник: OpenStreetMap / Overpass API. BBOX (S,W,N,E) = ${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east}.`);
  lines.push('-- Применять в Supabase SQL Editor (роль postgres → auth.uid() IS NULL → триггер пропускает).');
  lines.push(`-- Кол-во: water_sources=${water.length} (dedup по osm_id на стороне БД), park=${parks.length}, dog_park=${dogParks.length}.`);
  lines.push('');
  lines.push('BEGIN;');
  lines.push('');

  // water_sources
  lines.push(`-- water_sources (${water.length} кандидатов; существующие 109 пропустятся по ON CONFLICT)`);
  if (water.length > 0) {
    lines.push('INSERT INTO public.water_sources (osm_id, lat, lng, amenity, dog_bowl) VALUES');
    lines.push(water.map((w) => `  (${sqlStr(w.osmId)}, ${w.lat}, ${w.lng}, 'drinking_water', false)`).join(',\n') + '');
    lines.push('ON CONFLICT (osm_id) DO NOTHING;');
  } else {
    lines.push('-- (нет новых точек воды)');
  }
  lines.push('');

  // markers: helper
  const markerBlock = (rows: MarkerRow[], type: string) => {
    lines.push(`-- markers type='${type}' (${rows.length} новых после дедупа <${DEDUP_METERS}м)`);
    if (rows.length === 0) { lines.push(`-- (нет новых ${type})`); lines.push(''); return; }
    lines.push('INSERT INTO public.markers (user_id, type, lat, lng, description, expires_at, confirmations, denials)');
    lines.push('SELECT v.user_id, v.type, v.lat, v.lng, v.description, v.expires_at, v.confirmations, v.denials');
    lines.push('FROM (VALUES');
    lines.push(
      rows
        .map(
          (r) =>
            `  -- ${r.osmId}\n  (${sqlStr(CURATOR_ID)}::uuid, ${sqlStr(type)}, ${r.lat}::double precision, ${r.lng}::double precision, ${sqlDesc(r.description)}::text, NULL::timestamptz, 0, 0)`,
        )
        .join(',\n'),
    );
    lines.push(') AS v(user_id, type, lat, lng, description, expires_at, confirmations, denials)');
    // Идемпотентность + повторный дедуп на сервере: пропустить, если рядом (<~50м) уже есть постоянный маркер того же типа.
    lines.push('WHERE NOT EXISTS (');
    lines.push('  SELECT 1 FROM public.markers m');
    lines.push('  WHERE m.type = v.type AND m.expires_at IS NULL');
    lines.push('    AND abs(m.lat - v.lat) < 0.00045 AND abs(m.lng - v.lng) < 0.00053');
    lines.push(');');
    lines.push('');
  };
  markerBlock(parks, 'park');
  markerBlock(dogParks, 'dog_park');

  lines.push('COMMIT;');
  lines.push('');
  return lines.join('\n');
}

// ── Вывод сводки ────────────────────────────────────────────────────────────
function printSample(title: string, rows: (WaterRow | MarkerRow)[]) {
  console.log(`\n── ${title}: первые 10 ──`);
  rows.slice(0, 10).forEach((r, i) => {
    const desc = 'description' in r ? ` | ${r.description ?? '(без имени)'}` : '';
    console.log(`  ${String(i + 1).padStart(2)}. ${r.osmId.padEnd(16)} ${r.lat}, ${r.lng}${desc}`);
  });
  if (rows.length === 0) console.log('  (пусто)');
}

// ── main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Запрос к Overpass API…');
  const elements = await fetchOverpass();
  console.log(`Получено элементов: ${elements.length}`);

  const { water, parks, dogParks, noCoords, waterDupInRun } = classify(elements);

  const parkFilter = filterParks(parks);
  const parkDedup = dedupMarkers(parkFilter.kept, 'park');

  const dogCollapse = collapseDogParks(dogParks);
  const dogDedup = dedupMarkers(dogCollapse.kept, 'dog_park');

  const sql = buildSql(water, parkDedup.accepted, dogDedup.accepted);
  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, sql, 'utf8');

  console.log('\n════════════════ СВОДКА ════════════════');
  console.log(`BBOX (S,W,N,E): ${BBOX.south}, ${BBOX.west}, ${BBOX.north}, ${BBOX.east}`);
  console.log(`Пропущено без координат: ${noCoords}`);
  console.log('');
  console.log(`💧 water_sources:  ${water.length} новых кандидатов` + (waterDupInRun ? ` (в прогоне дублей osm_id: ${waterDupInRun})` : ''));
  console.log('   (существующие 109 отсеются на стороне БД через ON CONFLICT (osm_id))');
  console.log(`🌳 park:      ${parkDedup.accepted.length} новых  |  OSM всего: ${parks.length}; отброшено нод: ${parkFilter.droppedNodes}, безымянных way/rel: ${parkFilter.droppedUnnamed}; дедуп vs существ.: ${parkDedup.droppedVsExisting}, vs прогона: ${parkDedup.droppedInRun}`);
  console.log(`🎾 dog_park:  ${dogDedup.accepted.length} новых  |  OSM всего: ${dogParks.length} (полигонов: ${dogCollapse.polygonCount}); нод схлопнуто в полигон: ${dogCollapse.droppedNodes}, нод оставлено: ${dogCollapse.nodeKept}; дедуп vs существ.: ${dogDedup.droppedVsExisting}, vs прогона: ${dogDedup.droppedInRun}`);
  console.log('');
  console.log(`SQL записан: ${OUT_PATH}`);

  printSample('💧 water_sources', water);
  printSample('🌳 park', parkDedup.accepted);
  printSample('🎾 dog_park', dogDedup.accepted);
}

main().catch((err) => {
  console.error('ОШИБКА:', err);
  process.exit(1);
});
