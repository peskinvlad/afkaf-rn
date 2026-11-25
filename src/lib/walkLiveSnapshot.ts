import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WalkPathPoint } from './walkHistory';

// «Живой снимок» идущей прогулки — на самом телефоне, пока прогулка идёт.
//
// Зачем. Восстановление незавершённой прогулки раньше опиралось только на строку
// active_walks на сервере. А её нет ровно тогда, когда прогулку чаще всего и
// бросают: строка снимается при входе в домашнюю зону (приватность), не создаётся
// при видимости «никто» и у гостя. Пришёл домой, не нажал «Завершить», смахнул
// приложение — прогулка пропадала целиком и молча.
//
// Теперь WalkScreen раз в SAVE_EVERY_MS кладёт сюда текущее состояние (время
// начала, расстояние, шаги, маршрут). Обычное завершение и автозавершение ключ
// снимают. Остался ключ на холодном старте — значит, прогулку оборвали; useApp
// показывает ту же карточку «Незавершённая прогулка», но уже с маршрутом и шагами.
//
// Приватность: снимок лежит только на устройстве и никуда не отправляется, пока
// хозяин сам не нажмёт «Завершить и сохранить».
export const LIVE_WALK_KEY = 'live_walk_v1';
export const LIVE_WALK_SAVE_EVERY_MS = 30_000;

export interface LiveWalkSnapshot {
  // Чей снимок: чужой (сменили аккаунт) или гостевой на старте не показываем.
  userId: string | null;
  startedAt: string;
  // Когда снимок записан — для восстановленной прогулки это её конец.
  updatedAt: string;
  distanceKm: number;
  steps: number | null;
  path: WalkPathPoint[] | null;
  // false → собаку найдёт finalizeWalk (как у автозавершения).
  dogResolved: boolean;
  dogId: string | null;
}

export async function saveLiveWalk(snapshot: LiveWalkSnapshot): Promise<void> {
  try {
    await AsyncStorage.setItem(LIVE_WALK_KEY, JSON.stringify(snapshot));
  } catch (e) {
    console.warn('[walkLiveSnapshot] save failed:', e);
  }
}

export async function loadLiveWalk(): Promise<LiveWalkSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(LIVE_WALK_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<LiveWalkSnapshot> | null;
    // Битый или старого формата снимок — как будто его нет.
    if (
      !s ||
      typeof s.startedAt !== 'string' ||
      typeof s.updatedAt !== 'string' ||
      typeof s.distanceKm !== 'number' ||
      !Number.isFinite(s.distanceKm)
    ) {
      return null;
    }
    return {
      userId: typeof s.userId === 'string' ? s.userId : null,
      startedAt: s.startedAt,
      updatedAt: s.updatedAt,
      distanceKm: s.distanceKm,
      steps: typeof s.steps === 'number' ? s.steps : null,
      path: Array.isArray(s.path) ? s.path : null,
      dogResolved: s.dogResolved === true,
      dogId: typeof s.dogId === 'string' ? s.dogId : null,
    };
  } catch (e) {
    console.warn('[walkLiveSnapshot] load failed:', e);
    return null;
  }
}

export async function clearLiveWalk(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LIVE_WALK_KEY);
  } catch (e) {
    console.warn('[walkLiveSnapshot] clear failed:', e);
  }
}

// Длительность восстановленной прогулки, секунды (не отрицательная).
export function liveWalkDurationS(s: Pick<LiveWalkSnapshot, 'startedAt' | 'updatedAt'>): number {
  const ms = new Date(s.updatedAt).getTime() - new Date(s.startedAt).getTime();
  return Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 1000)) : 0;
}
