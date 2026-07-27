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
  'PUT_VLAD_UUID_HERE',
];

export function isDevUser(userId: string | null | undefined): boolean {
  return userId != null && DEV_USER_IDS.includes(userId);
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
