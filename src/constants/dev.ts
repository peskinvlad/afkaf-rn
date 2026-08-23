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

// Есть ли в списке хотя бы один валидный UUID. Нужно только диагностике
// dev-входа в AboutScreen: отличает «гейт сказал нет» от «список не заполнен».
export function isDevListConfigured(): boolean {
  return DEV_USER_ID_SET.size > 0;
}

// AsyncStorage-ключи dev-оверрайдов
export const DEV_ASPHALT_OVERRIDE_KEY = 'dev_asphalt_temp_override';
export const DEV_VOTE_OWN_KEY = 'dev_vote_own_markers';

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
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export async function getDevVoteOwnMarkers(): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!isDevUser(session?.user?.id)) return false;
    return (await AsyncStorage.getItem(DEV_VOTE_OWN_KEY)) === 'true';
  } catch {
    return false;
  }
}
