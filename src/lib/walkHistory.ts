import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const PENDING_KEY = 'pending_walk_history';
const RETRY_DELAY_MS = 3000;

export interface WalkPathPoint {
  lat: number;
  lng: number;
}

export interface WalkHistoryEntry {
  user_id: string;
  distance_km: number;
  duration_min: number; // kept alongside duration_s — badges read this column
  started_at: string;
  ended_at?: string | null;
  duration_s?: number | null;
  steps?: number | null;
  dog_id?: string | null;
  path?: WalkPathPoint[] | null;
  is_valid?: boolean;
}

// jsonb path stays bounded: routes longer than MAX_PATH_POINTS are thinned
// uniformly (first and last points always survive).
const MAX_PATH_POINTS = 500;

export function toWalkPath(
  route: { latitude: number; longitude: number }[],
): WalkPathPoint[] | null {
  if (route.length === 0) return null;
  if (route.length <= MAX_PATH_POINTS) {
    return route.map((p) => ({ lat: p.latitude, lng: p.longitude }));
  }
  const step = (route.length - 1) / (MAX_PATH_POINTS - 1);
  const out: WalkPathPoint[] = [];
  for (let i = 0; i < MAX_PATH_POINTS; i++) {
    const p = route[Math.round(i * step)];
    out.push({ lat: p.latitude, lng: p.longitude });
  }
  return out;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function tryInsert(entry: WalkHistoryEntry): Promise<boolean> {
  const { error } = await supabase.from('walk_history').insert(entry);
  if (error) console.warn('[walkHistory] insert failed:', error.message);
  return !error;
}

// Fail-soft save: one retry after RETRY_DELAY_MS; if that also fails, park
// the entry in AsyncStorage so flushPendingWalkHistory can deliver it on a
// later launch. Never throws, never surfaces anything to the user.
export async function saveWalkHistory(entry: WalkHistoryEntry): Promise<void> {
  if (await tryInsert(entry)) return;
  await delay(RETRY_DELAY_MS);
  if (await tryInsert(entry)) return;
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    const pending: WalkHistoryEntry[] = raw ? JSON.parse(raw) : [];
    pending.push(entry);
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  } catch (e) {
    console.warn('[walkHistory] failed to queue pending walk:', e);
  }
}

// Deliver walks parked by saveWalkHistory. The key is cleared only when every
// entry made it; entries that still fail (e.g. RLS rejects another user's
// row) stay queued for the next attempt. Never throws.
// Лучшая дистанция среди ПРОШЛЫХ засчитанных прогулок — для «личного рекорда»
// в итогах. Только чтение существующей таблицы, схема не меняется. Вызывать
// строго до вставки текущей прогулки, иначе она станет рекордом сама себе.
//
// ok:false — запрос не удался; рекорд в этом случае не заявляем: лучше не
// похвалить, чем соврать. ok:true + bestKm:null — засчитанных прогулок ещё не
// было, то есть текущая и есть первый рекорд.
export async function getPreviousBestDistanceKm(
  userId: string,
): Promise<{ ok: boolean; bestKm: number | null }> {
  const { data, error } = await supabase
    .from('walk_history')
    .select('distance_km')
    .eq('user_id', userId)
    .eq('is_valid', true)
    .order('distance_km', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn('[walkHistory] previous best fetch failed:', error.message);
    return { ok: false, bestKm: null };
  }
  return { ok: true, bestKm: data?.distance_km ?? null };
}

export async function flushPendingWalkHistory(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    if (!raw) return;
    const pending: WalkHistoryEntry[] = JSON.parse(raw);
    const failed: WalkHistoryEntry[] = [];
    for (const entry of pending) {
      if (!(await tryInsert(entry))) failed.push(entry);
    }
    if (failed.length === 0) {
      await AsyncStorage.removeItem(PENDING_KEY);
    } else if (failed.length !== pending.length) {
      await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(failed));
    }
  } catch (e) {
    console.warn('[walkHistory] flush failed:', e);
  }
}
