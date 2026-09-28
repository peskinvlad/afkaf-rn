import { haversine, LatLng } from './geo';
import { HomeZone } from './privacyZone';

// ── Автозавершение забытой прогулки ─────────────────────────────────────────
// Чистая логика, без RN: WalkScreen кормит сюда принятые фиксы (уже прошедшие
// гейт точности и glitch-фильтр) и дёргает check() на каждом колбэке локации,
// по таймеру и при возврате в foreground.
//
// Правило «дом»: был подтверждённо СНАРУЖИ домашней зоны, потом вошёл в неё и
// не выходил homeDwellMs подряд → прогулка заканчивается в момент входа (T), а
// не в T + 20 мин. Всё, что записано после входа, в итог не идёт.
//
// Запасное правило «неподвижность» (только когда дом не задан): stillMs почти
// без движения (в пределах STILL_RADIUS_M от точки отсчёта) → конец в момент
// точки отсчёта. У собачьих площадок и парков люди подолгу стоят, пока пёс
// бегает, — там порог длиннее (stillNearParkMs).

export const HOME_DWELL_MS = 20 * 60_000;
export const STILL_MS = 30 * 60_000;
export const STILL_NEAR_PARK_MS = 60 * 60_000;
export const PARK_NEAR_M = 100;
// Dev-переключатель «Тест: порог 1 мин» (DevPanel, только DEV_USER_IDS).
export const TEST_THRESHOLD_MS = 60_000;

// Гистерезис на границе зоны. «Внутри» — центр фикса в радиусе. «Уверенно
// снаружи» — даже с поправкой на заявленную точность фикс дальше радиуса ещё
// на OUTSIDE_MARGIN_M. Всё между — нейтральная полоса: ничего не меняет.
export const OUTSIDE_MARGIN_M = 20;
// Выход подтверждается не одиночным фиксом: нужно OUTSIDE_CONFIRM_FIXES
// «уверенно снаружи» подряд, растянутых минимум на OUTSIDE_CONFIRM_MS. Один
// выброс GPS у дома 20-минутный таймер не сбрасывает.
export const OUTSIDE_CONFIRM_FIXES = 2;
export const OUTSIDE_CONFIRM_MS = 20_000;
// Вход — два фикса «внутри» подряд; T = время первого из них.
export const INSIDE_CONFIRM_FIXES = 2;

// Неподвижность: точка отсчёта переезжает, только когда подряд
// STILL_MOVE_CONFIRM_FIXES фиксов ушли дальше STILL_RADIUS_M (+ точность).
export const STILL_RADIUS_M = 50;
export const STILL_MOVE_CONFIRM_FIXES = 2;

// Точность, если платформа её не прислала (редко) — умеренная, не нулевая.
const DEFAULT_ACCURACY_M = 15;

export type AutoFinishReason = 'home' | 'still';

// Состояние трека в момент фикса — чтобы обрезать итог ровно по T.
export interface TrackMark {
  routeLen: number;   // сколько точек маршрута включительно с этим фиксом
  distanceKm: number; // дистанция включительно с этим фиксом
  steps: number;      // шаги по живому счётчику на этот момент
}

export interface DetectorFix extends LatLng {
  accuracy: number | null | undefined;
  timestamp: number;
}

export interface AutoFinishHit {
  reason: AutoFinishReason;
  endAt: number; // T, ms epoch
  mark: TrackMark;
}

export interface AutoFinishConfig {
  home: HomeZone | null;
  // true → все пороги = TEST_THRESHOLD_MS (dev-тест).
  testMode: boolean;
  isNearPark: (pt: LatLng) => boolean;
}

export interface AutoFinishDiagnostics {
  active: boolean;             // детектор создан (идёт прогулка)
  mode: 'home' | 'still' | null;
  testMode: boolean;
  wasOutside: boolean;
  insideSince: number | null;  // кандидат на T по правилу «дом»
  stillSince: number | null;   // точка отсчёта неподвижности
  stillThresholdMs: number | null;
  firedAt: number | null;      // T сработавшего правила
  reason: AutoFinishReason | null;
}

const diag: AutoFinishDiagnostics = {
  active: false,
  mode: null,
  testMode: false,
  wasOutside: false,
  insideSince: null,
  stillSince: null,
  stillThresholdMs: null,
  firedAt: null,
  reason: null,
};

// Для DevPanel: снимок состояния детектора текущей (или последней) прогулки.
export function getAutoFinishDiagnostics(): AutoFinishDiagnostics {
  return { ...diag };
}

export interface AutoFinishDetector {
  feed: (fix: DetectorFix, mark: TrackMark) => void;
  check: (nowMs: number) => AutoFinishHit | null;
  // Шаговый датчик опроверг неподвижность — начать отсчёт заново с nowMs.
  rejectStill: (nowMs: number) => void;
  dispose: () => void;
}

type Stamped = { fix: DetectorFix; mark: TrackMark };

export function createAutoFinishDetector(config: AutoFinishConfig): AutoFinishDetector {
  const { home, testMode, isNearPark } = config;
  const homeDwellMs = testMode ? TEST_THRESHOLD_MS : HOME_DWELL_MS;

  // Правило «дом»
  let wasOutside = false;
  let outsideRun: DetectorFix[] = [];
  let insideRun: Stamped[] = [];
  let candidate: Stamped | null = null;

  // Правило «неподвижность»
  let anchor: Stamped | null = null;
  let anchorThresholdMs = 0;
  let moveRun: Stamped[] = [];

  let fired: AutoFinishHit | null = null;
  let last: Stamped | null = null;

  Object.assign(diag, {
    active: true,
    mode: home ? 'home' : 'still',
    testMode,
    wasOutside: false,
    insideSince: null,
    stillSince: null,
    stillThresholdMs: null,
    firedAt: null,
    reason: null,
  });

  function stillThreshold(pt: LatLng): number {
    if (testMode) return TEST_THRESHOLD_MS;
    return isNearPark(pt) ? STILL_NEAR_PARK_MS : STILL_MS;
  }

  function setAnchor(s: Stamped) {
    anchor = s;
    anchorThresholdMs = stillThreshold(s.fix);
    moveRun = [];
    diag.stillSince = s.fix.timestamp;
    diag.stillThresholdMs = anchorThresholdMs;
  }

  function feedHome(zone: HomeZone, s: Stamped) {
    const { fix } = s;
    const d = haversine(fix, zone) * 1000;
    const acc = fix.accuracy ?? DEFAULT_ACCURACY_M;

    if (d <= zone.radiusM) {
      outsideRun = [];
      if (!wasOutside || candidate) return; // старт дома / уже считаем
      insideRun.push(s);
      if (insideRun.length >= INSIDE_CONFIRM_FIXES) {
        candidate = insideRun[0];
        insideRun = [];
        diag.insideSince = candidate.fix.timestamp;
      }
      return;
    }

    insideRun = [];
    if (d - acc > zone.radiusM + OUTSIDE_MARGIN_M) {
      outsideRun.push(fix);
      const first = outsideRun[0];
      if (
        outsideRun.length >= OUTSIDE_CONFIRM_FIXES &&
        fix.timestamp - first.timestamp >= OUTSIDE_CONFIRM_MS
      ) {
        // Подтверждённо снаружи: взводим правило и сбрасываем таймер входа.
        wasOutside = true;
        candidate = null;
        diag.wasOutside = true;
        diag.insideSince = null;
      }
      return;
    }
    // Нейтральная полоса: серия «снаружи» прервалась, кандидат живёт дальше.
    outsideRun = [];
  }

  function feedStill(s: Stamped) {
    if (!anchor) {
      setAnchor(s);
      return;
    }
    const d = haversine(anchor.fix, s.fix) * 1000;
    const acc = s.fix.accuracy ?? DEFAULT_ACCURACY_M;
    if (d > STILL_RADIUS_M + acc) {
      moveRun.push(s);
      if (moveRun.length >= STILL_MOVE_CONFIRM_FIXES) setAnchor(moveRun[0]);
    } else {
      moveRun = [];
    }
  }

  return {
    feed(fix, mark) {
      if (fired) return;
      const s = { fix, mark };
      last = s;
      if (home) feedHome(home, s);
      else feedStill(s);
    },

    check(nowMs) {
      if (fired) return null;
      let hit: AutoFinishHit | null = null;
      if (home) {
        if (candidate && nowMs - candidate.fix.timestamp >= homeDwellMs) {
          hit = { reason: 'home', endAt: candidate.fix.timestamp, mark: candidate.mark };
        }
      } else if (anchor && nowMs - anchor.fix.timestamp >= anchorThresholdMs) {
        hit = { reason: 'still', endAt: anchor.fix.timestamp, mark: anchor.mark };
      }
      if (hit) {
        fired = hit;
        diag.firedAt = hit.endAt;
        diag.reason = hit.reason;
      }
      return hit;
    },

    rejectStill(nowMs) {
      if (!fired || fired.reason !== 'still' || !last) return;
      fired = null;
      diag.firedAt = null;
      diag.reason = null;
      // Отсчёт — с текущего момента, от последней известной позиции.
      setAnchor({ fix: { ...last.fix, timestamp: nowMs }, mark: last.mark });
    },

    dispose() {
      diag.active = false;
    },
  };
}

// HH:MM local time for T in user-facing text (summary, recovery card).
export function formatClock(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
