/**
 * heat-table.ts — контрольная таблица новой модели температуры асфальта.
 *
 * ЧТО ДЕЛАЕТ: прогоняет surfaceFromWeather() из src/lib/heat.ts на наборе
 * известных случаев и печатает результат рядом с ожиданием. В БД/сеть не
 * ходит — только чистая функция.
 *
 * ЗАПУСК:  node scripts/heat-table.ts     (Node ≥23 — стрип TS-типов встроен)
 *
 * Координаты везде: Бат-Ям (32.02, 34.75). Время в таблице местное израильское;
 * здесь переводим в UTC вручную (сентябрь/июнь — UTC+3, декабрь — UTC+2), чтобы
 * расчёт высоты солнца не зависел от часового пояса машины.
 */
import { surfaceFromWeather, solarSinElevation, statusFor } from '../src/lib/heat.ts';

const LAT = 32.02;
const LON = 34.75;

interface Row {
  n: number;
  ymd: [number, number, number]; // год, месяц (1–12), день
  local: string;                 // местное время (для печати)
  hourLocal: number;             // местный час
  utcOffset: number;             // сдвиг местного от UTC в этот сезон
  air: number;
  clouds: number;
  expect: string;
  showSun?: boolean;             // печатать разбор высоты солнца
}

const ROWS: Row[] = [
  { n: 1,  ymd: [2026, 9, 19],  local: '15:00', hourLocal: 15, utcOffset: 3, air: 30, clouds: 0,   expect: '≈54 (danger)', showSun: true },
  { n: 2,  ymd: [2026, 9, 19],  local: '12:00', hourLocal: 12, utcOffset: 3, air: 30, clouds: 0,   expect: '≈50 (danger)' },
  { n: 3,  ymd: [2026, 9, 19],  local: '18:00', hourLocal: 18, utcOffset: 3, air: 29, clouds: 0,   expect: '≈44 (caution)' },
  { n: 4,  ymd: [2026, 9, 19],  local: '21:00', hourLocal: 21, utcOffset: 3, air: 28, clouds: 0,   expect: '≈32 (ok)' },
  { n: 5,  ymd: [2026, 9, 19],  local: '03:00', hourLocal: 3,  utcOffset: 3, air: 25, clouds: 0,   expect: '=27 (ok)', showSun: true },
  { n: 6,  ymd: [2026, 9, 19],  local: '09:00', hourLocal: 9,  utcOffset: 3, air: 27, clouds: 0,   expect: '≈34 (ok, граница)' },
  { n: 7,  ymd: [2026, 9, 19],  local: '15:00', hourLocal: 15, utcOffset: 3, air: 30, clouds: 100, expect: '≈41 (caution)' },
  { n: 8,  ymd: [2026, 9, 19],  local: '15:00', hourLocal: 15, utcOffset: 3, air: 30, clouds: 50,  expect: '≈48 (danger)' },
  { n: 9,  ymd: [2026, 6, 21],  local: '14:00', hourLocal: 14, utcOffset: 3, air: 31, clouds: 0,   expect: '≈59 (danger)', showSun: true },
  { n: 10, ymd: [2026, 12, 21], local: '13:00', hourLocal: 13, utcOffset: 2, air: 18, clouds: 0,   expect: '≈33–36' },
];

// Момент строки в UTC-миллисекундах.
function rowMs(r: Row): number {
  const [y, m, d] = r.ymd;
  return Date.UTC(y, m - 1, d, r.hourLocal - r.utcOffset, 0, 0);
}

function elevDeg(sinElev: number): number {
  return Math.asin(Math.max(-1, Math.min(1, sinElev))) * 180 / Math.PI;
}

function pad(s: string | number, w: number): string {
  const str = String(s);
  return str + ' '.repeat(Math.max(0, w - str.length));
}

console.log(`Модель: асфальт = воздух + ночная база + солнечный_максимум × солнце × облака`);
console.log(`Координаты: ${LAT}, ${LON} (Бат-Ям)\n`);
console.log(pad('№', 3) + pad('дата', 12) + pad('t', 6) + pad('возд', 6) + pad('обл', 6) + pad('асфальт', 9) + pad('статус', 9) + 'ожидаю');
console.log('-'.repeat(78));

for (const r of ROWS) {
  const ms = rowMs(r);
  const surface = surfaceFromWeather(r.air, r.clouds, ms, LAT, LON);
  const status = statusFor(surface);
  console.log(
    pad(r.n, 3) +
    pad(`${r.ymd[0]}-${String(r.ymd[1]).padStart(2, '0')}-${String(r.ymd[2]).padStart(2, '0')}`, 12) +
    pad(r.local, 6) +
    pad(`${r.air}°`, 6) +
    pad(`${r.clouds}%`, 6) +
    pad(`${surface}°`, 9) +
    pad(status, 9) +
    r.expect,
  );
}

console.log('\nВысота солнца (градусы) — проверка астрономии:');
for (const r of ROWS) {
  if (!r.showSun) continue;
  const ms = rowMs(r);
  const at   = elevDeg(solarSinElevation(LAT, LON, new Date(ms)));
  const at1h = elevDeg(solarSinElevation(LAT, LON, new Date(ms - 60 * 60 * 1000)));
  const at3h = elevDeg(solarSinElevation(LAT, LON, new Date(ms - 3 * 60 * 60 * 1000)));
  const fmt = (x: number) => (x <= 0 ? `${x.toFixed(1)}° (ниже горизонта)` : `${x.toFixed(1)}°`);
  console.log(`  строка ${r.n} (${r.local}): сейчас ${fmt(at)} · час назад ${fmt(at1h)} · 3ч назад ${fmt(at3h)}`);
}
