import { supabase } from './supabase';

// Страница друга: имя + все его собаки. Данные отдаёт SECURITY DEFINER RPC
// get_friend_profile — только принятому другу и только без блокировки (иначе
// NULL). profiles/dogs под RLS owner-only, напрямую клиент их не прочитает.
// См. supabase/migrations/2026-11-25_get_friend_profile.sql.
export interface FriendDog {
  id: string;
  name: string | null;
  breed: string | null;
  icon: string | null;
  photo_url: string | null;
  gender: string | null;
  neutered: boolean | null;
  sociability: string | null;
  birth_date: string | null; // обрезана сервером до первого числа месяца
  birth_date_approx: boolean | null;
  age: string | null;
  // Черты характера (dogs.traits). undefined — сервер ещё старой версии и поле
  // не отдаёт; показывать нечего.
  traits?: string[] | null;
}

export interface FriendProfile {
  id: string;
  display_name: string | null;
  dogs: FriendDog[];
}

// null — друг недоступен (не друг / блок / функция ещё не применена / сеть).
// Вызывающий показывает то, что уже знает из списка друзей.
export async function fetchFriendProfile(userId: string): Promise<FriendProfile | null> {
  try {
    const { data, error } = await supabase.rpc('get_friend_profile', { p_user_id: userId });
    if (error) {
      console.warn('[friendProfile] get_friend_profile error:', error.message);
      return null;
    }
    if (!data || typeof data !== 'object') return null;
    const raw = data as Partial<FriendProfile>;
    return {
      id: String(raw.id ?? userId),
      display_name: raw.display_name ?? null,
      dogs: Array.isArray(raw.dogs) ? (raw.dogs as FriendDog[]) : [],
    };
  } catch (e) {
    console.warn('[friendProfile] fetch failed:', e instanceof Error ? e.message : String(e));
    return null;
  }
}
