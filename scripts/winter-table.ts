/**
 * winter-table.ts — контрольная таблица pickDryWindow() (зимний «Лучшее время»).
 * ЗАПУСК:  TZ=Asia/Jerusalem npx tsx scripts/winter-table.ts
 * Время слотов — местное (TZ важен: окно 05:30–23:00 считается по местным часам).
 */
import { pickDryWindow } from '../src/lib/winterWalk';

// Местное время (Asia/Jerusalem, зимой UTC+2) → epoch-секунды. 2026-12-10.
const slot = (hh: number, pop: number, icon = '04d', day = 10) =>
  ({ timeEpoch: Date.UTC(2026, 11, day, hh - 2, 0, 0) / 1000, pop, icon });
const NOW = (hh: number, mm = 0) => Date.UTC(2026, 11, 10, hh - 2, mm, 0);
const slots = (...a: ReturnType<typeof slot>[]) => a;

const CASES = [
  { n: 1, name: 'сухо в ближайшие сутки', now: NOW(9), nowRaining: false, f: slots(slot(12, 0), slot(15, 0.1), slot(18, 0.2), slot(21, 0)), expect: 'dryAll' },
  { n: 2, name: 'дождь позже (pop 0.6 в 18)', now: NOW(9), nowRaining: false, f: slots(slot(12, 0), slot(15, 0.1), slot(18, 0.6), slot(21, 0.7)), expect: 'dryUntil 18:00' },
  { n: 3, name: 'дождь по иконке 10d при pop 0', now: NOW(9), nowRaining: false, f: slots(slot(12, 0), slot(15, 0, '10d'), slot(18, 0)), expect: 'dryUntil 15:00' },
  { n: 4, name: 'дождь сейчас, суше с 15', now: NOW(10), nowRaining: true, f: slots(slot(12, 0.8, '10d'), slot(15, 0.2), slot(18, 0.1)), expect: 'rainUntil 15:00' },
  { n: 5, name: 'сухо сейчас, ближайший слот дождливый', now: NOW(10), nowRaining: false, f: slots(slot(12, 0.5), slot(15, 0.3), slot(18, 0)), expect: 'dryUntil 12:00' },
  { n: 6, name: 'pop ровно 0.4 — граница', now: NOW(9), nowRaining: false, f: slots(slot(12, 0.39), slot(15, 0.4)), expect: 'dryUntil 15:00' },
  { n: 7, name: 'дождь весь период', now: NOW(10), nowRaining: true, f: slots(slot(12, 0.9, '11d'), slot(15, 0.7), slot(18, 0.5)), expect: 'rainAll' },
  { n: 8, name: 'ночь: ночные слоты не в окне, утро завтра сухо', now: NOW(22, 30), nowRaining: false, f: slots(slot(1, 0.9, '10n', 11), slot(4, 0.9, '10n', 11), slot(7, 0.1, '01d', 11), slot(10, 0, '01d', 11)), expect: 'dryAllTomorrow' },
  { n: 9, name: 'вечер, дождь завтра утром', now: NOW(20), nowRaining: false, f: slots(slot(21, 0), slot(0, 0, '04n', 11), slot(6, 0.7, '10d', 11), slot(9, 0.2, '04d', 11)), expect: 'dryUntilTomorrow 06:00' },
  { n: 10, name: 'нет слотов в окне', now: NOW(23, 30), nowRaining: false, f: slots(slot(2, 0.9, '10n', 11), slot(4, 0.9, '10n', 11)), expect: 'none' },
] as const;

const pad = (s: string | number, w: number) => String(s) + ' '.repeat(Math.max(0, w - String(s).length));
const hhmm = (e: number) => { const d = new Date(e * 1000); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

console.log(pad('№', 3) + pad('кейс', 52) + pad('результат', 26) + 'ожидаю');
console.log('-'.repeat(104));
let bad = 0;
for (const c of CASES) {
  const r = pickDryWindow(c.f as any, c.now, c.nowRaining);
  const got = 'timeEpoch' in r ? `${r.kind} ${hhmm(r.timeEpoch)}` : r.kind;
  const ok = got === c.expect;
  if (!ok) bad++;
  console.log(pad(c.n, 3) + pad(c.name, 52) + pad(got, 26) + c.expect + (ok ? '' : '   <-- MISMATCH'));
}
console.log(bad ? `\n${bad} расхождений` : '\nВсе кейсы совпали');
