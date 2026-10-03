import { haversine, LatLng } from './geo';
import { HomeZone } from './privacyZone';

// ── Автозавершение забытой прогулки ─────────────────────────────────────────
// Чистая логика, без RN: WalkScreen кормит сюда принятые фиксы (уже прошедшие
// гейт точности и glitch-фильтр) и дёргает check() на каждом колбэке локации,
// по таймеру и при возврате в foreground.
//
// Правило «дом»: был подтверждённо СНАРУЖИ домашней зоны, потом вошёл в неё и
// не выходил homeDwellMs подряд → прогулка завершается. Время/дистанция/шаги —
// на момент ПРИБЫТИЯ (последнего движения внутри зоны: дошёл до двери и встал),
// включая путь от края зоны до двери; нет надёжного кластера → момент входа.
// Линия маршрута для сохранения/показа режется на ВХОДЕ в зону — точки внутри
// зоны живут только в памяти детектора (приватность адреса), в БД / AsyncStorage
// не уходят.
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
// Вход — два фикса «внутри» подряд; T входа = время первого из них.
export const INSIDE_CONFIRM_FIXES = 2;

// Прибытие (конец прогулки внутри зоны) = самая ранняя точка внутри, после
// которой ВСЕ следующие точки внутри остаются в радиусе ARRIVAL_RADIUS_M
// (человек дошёл и стоит). Финальный «стоячий» кластер должен содержать не
// меньше ARRIVAL_MIN_CLUSTER_FIXES точек — иначе данных мало / ещё движется и
// берём момент входа. Радиус с запасом: в помещении GPS прыгает на 20–50 м.
// Страховка от дрожания: прибытие не позже входа + ARRIVAL_MAX_AFTER_ENTRY_MS.
export const ARRIVAL_RADIUS_M = 40;
export const ARRIVAL_MIN_CLUSTER_FIXES = 2;
export const ARRIVAL_MAX_AFTER_ENTRY_MS = 10 * 60_000;

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
  endAt: number;        // T, ms epoch (дом: прибытие; still: anchor)
  mark: TrackMark;      // метрики (дистанция/шаги) на endAt
  routeCutLen: number;  // длина СОХРАНЯЕМОГО трека: дом — вход в зону; still — anchor
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
  // Точки внутри зоны после подтверждённого входа — ТОЛЬКО в памяти, для расчёта
  // прибытия. В сохраняемый трек не попадают (приватность адреса).
  let insidePoints: Stamped[] = [];

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
      if (!wasOutside) return;            // старт дома — правило неактивно
      if (candidate) {
        insidePoints.push(s);            // уже считаем — копим точки внутри для прибытия
        return;
      }
      insideRun.push(s);
      if (insideRun.length >= INSIDE_CONFIRM_FIXES) {
        candidate = insideRun[0];
        insidePoints = insideRun.slice(); // вход + подтверждающие фиксы — первые точки внутри
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
        insidePoints = [];
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

  // Прибытие: самая ранняя точка внутри зоны, после которой ВСЕ следующие точки
  // внутри в радиусе ARRIVAL_RADIUS_M (момент последнего движения — дошёл до
  // двери и стоит). Мало точек / нет надёжного кластера → момент входа.
  function homeArrival(entry: Stamped): Stamped {
    const pts = insidePoints;
    const boundary = entry.fix.timestamp + ARRIVAL_MAX_AFTER_ENTRY_MS;
    let arrival = entry;
    if (pts.length >= ARRIVAL_MIN_CLUSTER_FIXES) {
      for (let a = 0; a < pts.length; a++) {
        let clustered = true;
        for (let j = a + 1; j < pts.length; j++) {
          if (haversine(pts[a].fix, pts[j].fix) * 1000 > ARRIVAL_RADIUS_M) {
            clustered = false;
            break;
          }
        }
        if (clustered) {
          // Кластер [a..конец] короче порога → в конце ещё движение, доверять
          // нечему: берём вход.
          arrival = pts.length - a >= ARRIVAL_MIN_CLUSTER_FIXES ? pts[a] : entry;
          break;
        }
      }
    }
    // Страховка от GPS-дрожания в помещении: прибытие не позже входа + 10 мин.
    // Позже — берём последнюю точку внутри до этой границы (она же ≤ границы по
    // времени, т.е. «что раньше»); вход всегда ≤ границы, так что хотя бы он есть.
    if (arrival.fix.timestamp > boundary) {
      let capped = entry;
      for (const p of pts) {
        if (p.fix.timestamp <= boundary) capped = p;
        else break;
      }
      arrival = capped;
    }
    return arrival;
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
          const arrival = homeArrival(candidate);
          // Трек для сохранения режем на ВХОДЕ в зону (приватность адреса), а
          // время/дистанцию/шаги берём на момент прибытия (путь до двери включён).
          hit = {
            reason: 'home',
            endAt: arrival.fix.timestamp,
            mark: arrival.mark,
            routeCutLen: candidate.mark.routeLen,
          };
        }
      } else if (anchor && nowMs - anchor.fix.timestamp >= anchorThresholdMs) {
        hit = {
          reason: 'still',
          endAt: anchor.fix.timestamp,
          mark: anchor.mark,
          routeCutLen: anchor.mark.routeLen,
        };
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
