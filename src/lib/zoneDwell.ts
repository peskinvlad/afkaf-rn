import { haversine, LatLng } from './geo';

// ── Нахождение в круглой зоне (вход / выдержка / выход) ─────────────────────
// Чистая логика, без RN. Кормится принятыми фиксами (уже прошедшими гейт
// точности и glitch-фильтр). Гистерезис — та же схема, что у правила «дом» в
// autoFinish:
//   • «внутри» — центр фикса в радиусе; вход подтверждается INSIDE_CONFIRM_FIXES
//     фиксами подряд, insideSince = время первого из них;
//   • «уверенно снаружи» — даже с поправкой на заявленную точность фикс дальше
//     радиуса ещё на OUTSIDE_MARGIN_M; выход подтверждается OUTSIDE_CONFIRM_FIXES
//     такими фиксами подряд, растянутыми минимум на OUTSIDE_CONFIRM_MS;
//   • всё между — нейтральная полоса: ничего не меняет (дрожание GPS у границы
//     не сбрасывает выдержку).
// Одна зона = одна жизнь: после подтверждённого выхода детектор «выгорает»
// (exited), следующий вход — новый детектор.

export const INSIDE_CONFIRM_FIXES = 2;
export const OUTSIDE_MARGIN_M = 20;
export const OUTSIDE_CONFIRM_FIXES = 2;
export const OUTSIDE_CONFIRM_MS = 20_000;

// Точность, если платформа её не прислала (редко) — умеренная, не нулевая.
const DEFAULT_ACCURACY_M = 15;

export interface ZoneFix extends LatLng {
  accuracy: number | null | undefined;
  timestamp: number;
}

export interface ZoneDwellConfig {
  center: LatLng;
  radiusM: number;
}

export interface ZoneDwell {
  feed: (fix: ZoneFix) => void;
  // Подтверждённо внутри и ещё не вышел.
  isInside: () => boolean;
  // Время первого фикса подтверждённого входа (null — вход не подтверждён).
  insideSince: () => number | null;
  // Подтверждённо вышел (после входа или так и не войдя) — детектор отработал.
  hasExited: () => boolean;
  // Внутри не меньше dwellMs к моменту nowMs.
  dwelled: (nowMs: number, dwellMs: number) => boolean;
}

export function distanceM(a: LatLng, b: LatLng): number {
  return haversine(a, b) * 1000;
}

export function createZoneDwell({ center, radiusM }: ZoneDwellConfig): ZoneDwell {
  let insideRun: ZoneFix[] = [];
  let outsideRun: ZoneFix[] = [];
  let since: number | null = null;
  let exited = false;

  return {
    feed(fix) {
      if (exited) return;
      const d = distanceM(fix, center);
      const acc = fix.accuracy ?? DEFAULT_ACCURACY_M;

      if (d <= radiusM) {
        outsideRun = [];
        if (since != null) return;
        insideRun.push(fix);
        if (insideRun.length >= INSIDE_CONFIRM_FIXES) {
          since = insideRun[0].timestamp;
          insideRun = [];
        }
        return;
      }

      insideRun = [];
      if (d - acc > radiusM + OUTSIDE_MARGIN_M) {
        outsideRun.push(fix);
        const first = outsideRun[0];
        if (
          outsideRun.length >= OUTSIDE_CONFIRM_FIXES &&
          fix.timestamp - first.timestamp >= OUTSIDE_CONFIRM_MS
        ) {
          exited = true;
        }
        return;
      }
      // Нейтральная полоса: серия «снаружи» прервалась, вход (если был) живёт.
      outsideRun = [];
    },

    isInside: () => since != null && !exited,
    insideSince: () => since,
    hasExited: () => exited,
    dwelled: (nowMs, dwellMs) => since != null && !exited && nowMs - since >= dwellMs,
  };
}
