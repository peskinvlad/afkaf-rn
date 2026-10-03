import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

// ── Скрытый dev-режим ────────────────────────────────────────────────────────
// Гейт dev-панели (AboutScreen: 5 тапов по строке версии → DevPanel) и всех
// dev-веток в коде. Правило: ЛЮБАЯ dev-логика обязана стоять за проверкой
// isDevUser(...) — для пользователей не из списка поведение приложения не
// меняется нигде и никак, следов в UI нет.
//
// UUID — это auth.users.id из Supabase (Dashboard → Authentication → Users).
export const DEV_USER_IDS: string[] = [
  'e57637d6-7b83-465c-8263-6ca0fa822ab4', // Vlad
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Нормализованный список. Supabase отдаёт canonical lowercase UUID, но
// значение, скопированное из дашборда, легко приезжает с хвостовым пробелом
// или в верхнем регистре — раньше такая строка молча не совпадала. Всё, что
// вообще не UUID (опечатка, незаполненный плейсхолдер), отсеивается здесь и
// не может совпасть ни с чьим id.
const DEV_USER_ID_SET = new Set(
  DEV_USER_IDS.map((id) => id.trim().toLowerCase()).filter((id) => UUID_RE.test(id)),
);

// Гейт остаётся точным allow-list по auth.users.id: совпадение — только с
// UUID, явно вписанным в DEV_USER_IDS.
export function isDevUser(userId: string | null | undefined): boolean {
  if (userId == null) return false;
  return DEV_USER_ID_SET.has(userId.trim().toLowerCase());
}

// Есть ли в списке хотя бы один валидный UUID.
export function isDevListConfigured(): boolean {
  return DEV_USER_ID_SET.size > 0;
}

// Страховка от повторения истории с незаполненным плейсхолдером: список без
// единого валидного UUID молча выключает dev-режим для всех, и снаружи это
// неотличимо от «гейт просто не пускает» — 5 тапов по версии не делают ничего,
// без ошибок. Один раз при старте говорим об этом вслух. Только в dev-сборке:
// у обычного пользователя список и должен быть пустым, если UUID не вписан.
if (__DEV__ && !isDevListConfigured()) {
  console.warn(
    '[dev] DEV_USER_IDS не содержит ни одного валидного UUID — dev-режим ' +
    'выключен для всех. Впиши auth.users.id (Supabase → Authentication → ' +
    'Users) в src/constants/dev.ts.',
  );
}

// AsyncStorage-ключи dev-оверрайдов
export const DEV_ASPHALT_OVERRIDE_KEY = 'dev_asphalt_temp_override';
export const DEV_VOTE_OWN_KEY = 'dev_vote_own_markers';
// Рантайм-переключатель диагностического оверлея карты (DevPanel). Значение
// важнее env-дефолта EXPO_PUBLIC_MAP_DEBUG; читается mapDebug при старте.
export const DEV_MAP_DEBUG_KEY = 'dev_map_debug_overlay';
// «Тест: порог 1 мин» для автозавершения прогулки (DevPanel). Читается
// WalkScreen при старте прогулки через getDevAutoFinishTest.
export const DEV_AUTO_FINISH_TEST_KEY = 'dev_auto_finish_test';
// «Тест: порог 1 мин» для авто-чек-ина на площадке (DevPanel): выдержка в зоне
// dog_park 1 мин вместо 5. Читается WalkScreen при старте прогулки.
export const DEV_PARK_CHECKIN_TEST_KEY = 'dev_park_checkin_test';
// «Тест: подсказка 30 с» для уведомления №1 «Ты на площадке?» (DevPanel): порог
// показа подсказки 30 с вместо 3 мин. Читается WalkScreen при старте прогулки.
export const DEV_PARK_PROMPT_TEST_KEY = 'dev_park_prompt_test';
// «Тест: подсказка 30 с» для уведомления №2 «Уже дома?»: порог 30 с вместо 10 мин.
export const DEV_HOME_PROMPT_TEST_KEY = 'dev_home_prompt_test';
// «Тест: 2 мин» для уведомления №4 «Ты всё ещё гуляешь?»: порог 2 мин вместо 2 ч.
export const DEV_STILL_WALKING_TEST_KEY = 'dev_still_walking_test';
// «Тест: радиус 150 м» для уведомлений №3 (опасность) и №5 (метка рядом).
export const DEV_PROXIMITY_TEST_KEY = 'dev_proximity_test';

// ── Мини-шина событий ────────────────────────────────────────────────────────
// DevPanel меняет ключи в AsyncStorage; подписчики (useAsphaltTemp) должны
// перечитать их сразу, без перезапуска приложения и без поллинга.
type Listener = () => void;
const listeners = new Set<Listener>();

export function onDevSettingsChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function emitDevSettingsChange(): void {
  listeners.forEach((l) => l());
}

// ── Геттеры (сами проверяют isDevUser — для остальных всегда «выключено») ────

export async function getDevAsphaltOverride(): Promise<number | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!isDevUser(session?.user?.id)) return null;
    const raw = await AsyncStorage.getItem(DEV_ASPHALT_OVERRIDE_KEY);
    if (raw == null) return null;
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
    // Ключ есть, но в нём не число — это поломка, а не «оверрайда нет».
    console.warn('[dev] asphalt override is not a number:', JSON.stringify(raw));
    return null;
  } catch (e) {
    // Раньше здесь был молчаливый `return null`: любой сбой getSession()
    // (протухший токен, нет сети, гонка с обновлением сессии) бесследно
    // выключал оверрайд — ровно тот симптом «не работает, ошибок нет».
    console.warn('[dev] getDevAsphaltOverride failed:', e);
    return null;
  }
}

export async function getDevVoteOwnMarkers(): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!isDevUser(session?.user?.id)) return false;
    return (await AsyncStorage.getItem(DEV_VOTE_OWN_KEY)) === 'true';
  } catch (e) {
    console.warn('[dev] getDevVoteOwnMarkers failed:', e);
    return false;
  }
}

export async function getDevAutoFinishTest(): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!isDevUser(session?.user?.id)) return false;
    return (await AsyncStorage.getItem(DEV_AUTO_FINISH_TEST_KEY)) === 'true';
  } catch (e) {
    console.warn('[dev] getDevAutoFinishTest failed:', e);
    return false;
  }
}

export async function getDevParkCheckinTest(): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!isDevUser(session?.user?.id)) return false;
    return (await AsyncStorage.getItem(DEV_PARK_CHECKIN_TEST_KEY)) === 'true';
  } catch (e) {
    console.warn('[dev] getDevParkCheckinTest failed:', e);
    return false;
  }
}

export async function getDevParkPromptTest(): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!isDevUser(session?.user?.id)) return false;
    return (await AsyncStorage.getItem(DEV_PARK_PROMPT_TEST_KEY)) === 'true';
  } catch (e) {
    console.warn('[dev] getDevParkPromptTest failed:', e);
    return false;
  }
}

export async function getDevHomePromptTest(): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!isDevUser(session?.user?.id)) return false;
    return (await AsyncStorage.getItem(DEV_HOME_PROMPT_TEST_KEY)) === 'true';
  } catch (e) {
    console.warn('[dev] getDevHomePromptTest failed:', e);
    return false;
  }
}

export async function getDevStillWalkingTest(): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!isDevUser(session?.user?.id)) return false;
    return (await AsyncStorage.getItem(DEV_STILL_WALKING_TEST_KEY)) === 'true';
  } catch (e) {
    console.warn('[dev] getDevStillWalkingTest failed:', e);
    return false;
  }
}

export async function getDevProximityTest(): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!isDevUser(session?.user?.id)) return false;
    return (await AsyncStorage.getItem(DEV_PROXIMITY_TEST_KEY)) === 'true';
  } catch (e) {
    console.warn('[dev] getDevProximityTest failed:', e);
    return false;
  }
}
