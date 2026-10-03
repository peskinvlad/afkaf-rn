import { supabase } from './supabase';
import { LatLng } from './geo';
import { HomeZone, isInsideHomeZone } from './privacyZone';
import { createZoneDwell, distanceM, ZoneDwell, ZoneFix } from './zoneDwell';

// ── Чек-ин на собачьих площадках ────────────────────────────────────────────
// Работает только во время прогулки: WalkScreen открывает сессию на старте
// (для залогиненных), кормит её принятыми фиксами, тикает после каждой пачки
// фиксов и по таймеру, закрывает на финише / уходе с экрана.
//
// Авто-чек-ин: подтверждённо внутри зоны dog_park (радиус PARK_RADIUS_M) не
// меньше PARK_DWELL_MS → park_checkin(marker, manual=false). Снимается при
// подтверждённом выходе (гистерезис zoneDwell) → park_checkout('left'), в конце
// прогулки → 'walk_end'; через 2 ч истекает на сервере сам (expires_at).
// Ручной «Я здесь» (карточка площадки) — сразу, без выдержки, но только когда
// ты внутри зоны ЭТОЙ площадки; = согласие быть видимым по имени для всех.
//
// Не участвуют: гости (сессия не открывается), visibility='nobody' (авто не
// шлём, ручной — подсказка «включи видимость»), площадки внутри домашней зоны
// (не считаются зонами вовсе). Сервер проверяет то же самое сам (свежая
// active_walks с visibility <> 'nobody', расстояние ≤150 м), см.
// supabase/functions/park_checkin.sql.
//
// Состояние — модульный стор (subscribe/getState): карточка площадки смонтирована
// и на MapScreen, и на WalkScreen, DevPanel показывает его же.

// Радиус зоны от точки метки. Ближайшие площадки в БД — не ближе 91 м друг к
// другу, 2×40 < 91 — зоны не пересекаются. Площадки в Гуш-Дане в основном
// 20×40…50×50 м, точка из OSM — примерно центр.
export const PARK_RADIUS_M = 40;
export const PARK_DWELL_MS = 5 * 60_000;
// Dev-переключатель «Тест: порог 1 мин» (DevPanel, только DEV_USER_IDS).
export const PARK_TEST_DWELL_MS = 60_000;
// Совпадает с expires_at на сервере (now() + 2h).
export const PARK_CHECKIN_MAX_MS = 2 * 60 * 60_000;
// Неудачный авто-чек-ин (сеть, active_walks ещё не создана, PT429) повторяем
// не чаще раза в минуту, пока человек внутри.
const AUTO_RETRY_MS = 60_000;

export interface DogPark extends LatLng {
  id: string;
}

export type ParkEligibility = 'ok' | 'nobody';

export interface ParkCheckinState {
  active: boolean;             // сессия открыта (идёт прогулка, есть аккаунт)
  eligibility: ParkEligibility | null;
  testMode: boolean;
  parkId: string | null;       // площадка, в зоне которой подтверждённо находимся
  insideSince: number | null;  // начало подтверждённого нахождения в зоне
  checkedIn: boolean;          // есть открытый чек-ин на parkId
  manual: boolean;
  checkedInAt: number | null;
  lastError: string | null;    // последний отказ сервера / сети (для DevPanel)
}

const EMPTY: ParkCheckinState = {
  active: false,
  eligibility: null,
  testMode: false,
  parkId: null,
  insideSince: null,
  checkedIn: false,
  manual: false,
  checkedInAt: null,
  lastError: null,
};

let state: ParkCheckinState = EMPTY;
const listeners = new Set<() => void>();

function setState(patch: Partial<ParkCheckinState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function getParkCheckinState(): ParkCheckinState {
  return state;
}

export function subscribeParkCheckin(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

// ── Сессия прогулки ─────────────────────────────────────────────────────────

export interface ParkSessionConfig {
  parks: () => DogPark[];
  homeZone: HomeZone | null;
  eligibility: ParkEligibility;
  testMode: boolean;
}

interface Zone {
  parkId: string;
  center: LatLng;
  dwell: ZoneDwell;
  // Чек-ин на этом заходе уже истёк по 2 ч — повторно не отмечаем, пока не
  // выйдет и не зайдёт снова.
  expired: boolean;
}

interface Session {
  config: ParkSessionConfig;
  zone: Zone | null;
  inflight: boolean;
  lastAttemptAt: number;
}

let session: Session | null = null;

export function startParkCheckinSession(config: ParkSessionConfig) {
  session = { config, zone: null, inflight: false, lastAttemptAt: 0 };
  state = { ...EMPTY, active: true, eligibility: config.eligibility, testMode: config.testMode };
  listeners.forEach((l) => l());
}

// Конец прогулки / уход с экрана. Открытый чек-ин закрывается сразу, не ждём
// сервера (его фильтр по свежей active_walks всё равно уберёт нас из счётчика).
export function endParkCheckinSession(): Promise<void> {
  const wasActive = session != null;
  const wasCheckedIn = state.checkedIn;
  session = null;
  state = EMPTY;
  listeners.forEach((l) => l());
  // Возвращаем промис park_checkout, чтобы вызывающий (handleFinish /
  // handleAutoFinish) мог дождаться его ДО остановки трекинга: в фоне iOS
  // усыпляет приложение сразу после stopWalkTracking и fire-and-forget checkout
  // терялся — чек-ин висел «в парке» до expires_at (2 ч).
  if (wasActive && wasCheckedIn) return closeParkCheckin('walk_end');
  return Promise.resolve();
}

// Закрыть свой чек-ин на сервере без сессии — для путей восстановления
// (карточка забытой прогулки, автозавершение на холодном старте). Ошибки
// глушим: не закрылся — истечёт сам через 2 ч и уже не виден без active_walks.
export async function closeParkCheckin(reason: 'left' | 'walk_end'): Promise<void> {
  const { error } = await supabase.rpc('park_checkout', { p_reason: reason });
  if (error) console.warn('[parkCheckin] park_checkout failed:', error.message);
}

function nearestPark(fix: LatLng, config: ParkSessionConfig): DogPark | null {
  let best: DogPark | null = null;
  let bestD = Infinity;
  for (const p of config.parks()) {
    const d = distanceM(fix, p);
    if (d <= PARK_RADIUS_M && d < bestD) {
      // Площадка у дома выдала бы, где человек живёт, — не зона вовсе.
      if (config.homeZone && isInsideHomeZone(p.latitude, p.longitude, config.homeZone)) continue;
      best = p;
      bestD = d;
    }
  }
  return best;
}

function openZone(s: Session, park: DogPark) {
  s.zone = {
    parkId: park.id,
    center: { latitude: park.latitude, longitude: park.longitude },
    dwell: createZoneDwell({ center: park, radiusM: PARK_RADIUS_M }),
    expired: false,
  };
  s.lastAttemptAt = 0;
}

// Покинули зону (подтверждённый выход или переход на соседнюю площадку).
function leaveZone(s: Session) {
  const wasCheckedIn = state.checkedIn;
  s.zone = null;
  setState({ parkId: null, insideSince: null, checkedIn: false, manual: false, checkedInAt: null });
  if (wasCheckedIn) closeParkCheckin('left');
}

function syncZoneState(s: Session) {
  const z = s.zone;
  const inside = z != null && z.dwell.isInside();
  const parkId = inside ? z!.parkId : null;
  const insideSince = inside ? z!.dwell.insideSince() : null;
  if (parkId !== state.parkId || insideSince !== state.insideSince) {
    setState({ parkId, insideSince });
  }
}

export function feedParkFix(fix: ZoneFix) {
  const s = session;
  if (!s) return;

  if (s.zone) {
    s.zone.dwell.feed(fix);
    if (s.zone.dwell.hasExited()) leaveZone(s);
  }

  const candidate = nearestPark(fix, s.config);
  if (candidate) {
    if (!s.zone) {
      openZone(s, candidate);
      s.zone!.dwell.feed(fix);
    } else if (
      candidate.id !== s.zone.parkId &&
      distanceM(fix, s.zone.center) > PARK_RADIUS_M
    ) {
      // Уже в радиусе соседней площадки, а до старой дальше радиуса — переходим,
      // не дожидаясь подтверждённого выхода из старой.
      leaveZone(s);
      openZone(s, candidate);
      s.zone!.dwell.feed(fix);
    }
  } else if (s.zone && !s.zone.dwell.isInside() && distanceM(fix, s.zone.center) > PARK_RADIUS_M) {
    // Вход так и не подтвердился, а мы уже вне радиуса — зона-кандидат не нужна.
    s.zone = null;
  }

  syncZoneState(s);
}

// Вызывать ПОСЛЕ пачки фиксов и по таймеру (не на каждый фикс: после фона фиксы
// приходят пачкой со старыми метками времени — выход в конце пачки должен быть
// учтён раньше, чем выдержка «засчитается» по Date.now()).
export function tickParkCheckin(nowMs: number) {
  const s = session;
  const z = s?.zone;
  if (!s || !z || !z.dwell.isInside()) return;

  if (state.checkedIn) {
    if (state.checkedInAt != null && nowMs - state.checkedInAt >= PARK_CHECKIN_MAX_MS) {
      // Сервер уже считает чек-ин истёкшим. Повторно на этом заходе не отмечаем.
      z.expired = true;
      setState({ checkedIn: false, manual: false, checkedInAt: null });
    }
    return;
  }
  if (z.expired || s.config.eligibility !== 'ok') return;

  const dwellMs = s.config.testMode ? PARK_TEST_DWELL_MS : PARK_DWELL_MS;
  if (!z.dwell.dwelled(nowMs, dwellMs)) return;
  if (s.inflight || nowMs - s.lastAttemptAt < AUTO_RETRY_MS) return;

  s.lastAttemptAt = nowMs;
  requestCheckin(s, z.parkId, false);
}

export type CheckInHereResult =
  | 'ok'
  | 'nobody'          // «Кто видит меня» = никто → подсказка «включи видимость»
  | 'not_inside'      // не в зоне этой площадки (или не на прогулке)
  | 'no_active_walk'  // сервер не видит прогулку (ещё не опубликована / сеть)
  | 'error';

// Ручной «Я здесь» из карточки площадки.
export async function checkInHere(markerId: string): Promise<CheckInHereResult> {
  const s = session;
  if (!s) return 'not_inside';
  if (s.config.eligibility === 'nobody') return 'nobody';
  if (!s.zone || s.zone.parkId !== markerId || !s.zone.dwell.isInside()) return 'not_inside';
  return requestCheckin(s, markerId, true);
}

async function requestCheckin(s: Session, markerId: string, manual: boolean): Promise<CheckInHereResult> {
  s.inflight = true;
  const { data, error } = await supabase.rpc('park_checkin', { p_marker_id: markerId, p_manual: manual });
  s.inflight = false;

  if (session !== s) {
    // Прогулка закончилась, пока запрос летел: не оставлять висящий чек-ин.
    if (!error) closeParkCheckin('walk_end');
    return 'error';
  }
  if (error) {
    setState({ lastError: error.message });
    return error.message === 'no_active_walk' ? 'no_active_walk' : 'error';
  }
  if (s.zone?.parkId !== markerId) {
    // Ушли в другую зону, пока запрос летел — этот чек-ин уже не про нас.
    closeParkCheckin('left');
    return 'error';
  }
  const row = data as { manual: boolean; started_at: string } | null;
  const startedAt = row?.started_at ? Date.parse(row.started_at) : Date.now();
  setState({
    checkedIn: true,
    manual: row?.manual ?? manual,
    checkedInAt: Number.isFinite(startedAt) ? startedAt : Date.now(),
    lastError: null,
  });
  return 'ok';
}
