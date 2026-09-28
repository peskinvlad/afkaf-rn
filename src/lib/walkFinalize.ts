import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { checkAndAwardBadges } from './badges';
import { saveWalkHistory, getPreviousBestDistanceKm, WalkPathPoint } from './walkHistory';
import { HeatStatus } from './heat';
import type { AutoFinishReason } from './autoFinish';

// A walk only "counts" (walk_history + badges) past a minimum bar, so an
// accidental swipe doesn't pollute streaks/totals. Single source for every
// path that ends a walk (Finish button, recovery card).
export const MIN_VALID_DISTANCE_KM = 0.3;
export const MIN_VALID_DURATION_SEC = 300;

export function isValidWalk(distanceKm: number, durationS: number): boolean {
  return distanceKm >= MIN_VALID_DISTANCE_KM && durationS >= MIN_VALID_DURATION_SEC;
}

export interface FinalizeWalkInput {
  startedAt: string;
  // Omitted → "now", taken at the moment of the insert.
  endedAt?: string;
  durationS: number;
  distanceKm: number;
  steps: number | null;
  path: WalkPathPoint[] | null;
  // undefined → looked up (first dog of the user); null → walk without a dog.
  dogId?: string | null;
  confirmedCount: number;
  // «Личный рекорд» в итогах. Считается строго до вставки текущей прогулки.
  checkPersonalBest: boolean;
}

export interface FinalizeWalkResult {
  isValidWalk: boolean;
  newBadgeIds: string[];
  isPersonalBest: boolean;
}

// Saves a finished walk (only when it counts and there is a signed-in user),
// then awards any newly earned badges. Never throws on a failed insert —
// saveWalkHistory parks the walk for a later flush.
export async function finalizeWalk(input: FinalizeWalkInput): Promise<FinalizeWalkResult> {
  const valid = isValidWalk(input.distanceKm, input.durationS);
  const result: FinalizeWalkResult = { isValidWalk: valid, newBadgeIds: [], isPersonalBest: false };
  if (!valid) return result;

  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) return result;

  let dogId = input.dogId;
  if (dogId === undefined) {
    const { data: dog } = await supabase
      .from('dogs')
      .select('id')
      .eq('owner_id', userId)
      .limit(1)
      .maybeSingle();
    dogId = dog?.id ?? null;
  }

  if (input.checkPersonalBest) {
    // Строго до вставки текущей прогулки — иначе она побьёт сама себя.
    const prevBest = await getPreviousBestDistanceKm(userId);
    result.isPersonalBest = prevBest.ok
      ? prevBest.bestKm == null || input.distanceKm > prevBest.bestKm
      : false;
  }

  await saveWalkHistory({
    user_id: userId,
    distance_km: input.distanceKm,
    duration_min: Math.floor(input.durationS / 60),
    duration_s: input.durationS,
    started_at: input.startedAt,
    ended_at: input.endedAt ?? new Date().toISOString(),
    steps: input.steps,
    dog_id: dogId,
    path: input.path,
    is_valid: valid,
  });

  const newBadges = await checkAndAwardBadges(input.confirmedCount);
  result.newBadgeIds = newBadges.map((b) => b.id);
  return result;
}

// ── Автозавершённая прогулка: снимок до финализации ─────────────────────────
// Детектор (lib/autoFinish) может сработать в фоне. Сохранять оттуда в
// Supabase ненадёжно: после stopWalkTracking iOS за секунды усыпляет
// приложение, а продлить фон без нативного модуля нечем. Поэтому в фоне
// пишется только этот снимок — уже обрезанный по T, — а финализирует его
// WalkScreen при возврате в foreground или useApp на следующем холодном
// старте, если iOS успела выгрузить приложение.
export const AUTO_FINISHED_KEY = 'auto_finished_walk_v1';

export interface AutoFinishedWalk {
  userId: string | null; // чей снимок: чужой/гостевой на старте не сохраняем
  reason: AutoFinishReason;
  startedAt: string;
  endedAt: string; // T — момент входа в зону / начала неподвижности
  durationS: number;
  distanceKm: number;
  steps: number | null;
  path: WalkPathPoint[] | null;
  dogResolved: boolean; // false → finalizeWalk ищет собаку сам
  dogId: string | null;
  heatStatusAtFinish: HeatStatus;
}

export async function saveAutoFinished(walk: AutoFinishedWalk): Promise<void> {
  try {
    await AsyncStorage.setItem(AUTO_FINISHED_KEY, JSON.stringify(walk));
  } catch (e) {
    console.warn('[walkFinalize] failed to store auto-finished walk:', e);
  }
}

export async function loadAutoFinished(): Promise<AutoFinishedWalk | null> {
  try {
    const raw = await AsyncStorage.getItem(AUTO_FINISHED_KEY);
    return raw ? (JSON.parse(raw) as AutoFinishedWalk) : null;
  } catch (e) {
    console.warn('[walkFinalize] failed to read auto-finished walk:', e);
    return null;
  }
}

export async function clearAutoFinished(): Promise<void> {
  try {
    await AsyncStorage.removeItem(AUTO_FINISHED_KEY);
  } catch (e) {
    console.warn('[walkFinalize] failed to clear auto-finished walk:', e);
  }
}

// Один процесс — одна финализация снимка: WalkScreen (возврат в foreground) и
// useApp (холодный старт) не должны сохранить одну прогулку дважды.
let autoFinalizeInFlight = false;

// Сохраняет снимок как обычную прогулку, но без «личного рекорда»: итог
// обрезан по T, а рекорд на автозавершении — ровно та ложная похвала, от
// которой защищаемся. Бейджи — как обычно, по обрезанным данным. Ключ
// снимается после сохранения (saveWalkHistory сам паркует прогулку в очередь,
// если сеть не дала вставить). null — снимка нет или его уже финализируют.
export async function finalizeAutoFinished(
  walk: AutoFinishedWalk,
  confirmedCount: number,
): Promise<FinalizeWalkResult | null> {
  if (autoFinalizeInFlight) return null;
  autoFinalizeInFlight = true;
  try {
    const result = await finalizeWalk({
      startedAt: walk.startedAt,
      endedAt: walk.endedAt,
      durationS: walk.durationS,
      distanceKm: walk.distanceKm,
      steps: walk.steps,
      path: walk.path,
      dogId: walk.dogResolved ? walk.dogId : undefined,
      confirmedCount,
      checkPersonalBest: false,
    });
    await clearAutoFinished();
    return result;
  } finally {
    autoFinalizeInFlight = false;
  }
}
