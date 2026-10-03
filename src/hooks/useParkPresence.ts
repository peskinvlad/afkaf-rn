import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { supabase } from '../lib/supabase';
import { getParkCheckinState, subscribeParkCheckin, ParkCheckinState } from '../lib/parkCheckin';

// «Сейчас здесь» для карточки площадки — get_park_presence (SECURITY DEFINER).
// Правила видимости и k-анонимность считает сервер (supabase/functions/
// get_park_presence.sql): named — кого можно показать по имени, anon — прочие
// (0, если их меньше двух), total = named + anon.

export interface ParkPresencePerson {
  userId: string;
  displayName: string | null;
  dogName: string | null;
  dogAvatar: string | null;
  isFriend: boolean;
  isMe: boolean;
  manual: boolean;
  since: string;
}

export interface ParkPresence {
  total: number;
  anon: number;
  named: ParkPresencePerson[];
  me: { checkedIn: boolean; manual: boolean };
}

interface RawPresence {
  total: number;
  anon: number;
  named: {
    user_id: string;
    display_name: string | null;
    dog_name: string | null;
    dog_avatar: string | null;
    is_friend: boolean;
    is_me: boolean;
    manual: boolean;
    since: string;
  }[];
  me: { checked_in: boolean; manual: boolean };
}

// 30 с — как у «гуляют рядом»; сервер режет на 20/мин.
const POLL_MS = 30_000;

// Живое состояние своей сессии чек-ина (lib/parkCheckin) для UI.
export function useParkCheckinState(): ParkCheckinState {
  return useSyncExternalStore(subscribeParkCheckin, getParkCheckinState);
}

export function useParkPresence(markerId: string | null) {
  const [presence, setPresence] = useState<ParkPresence | null>(null);
  const markerRef = useRef(markerId);
  markerRef.current = markerId;

  const load = useCallback(async () => {
    const id = markerRef.current;
    if (!id) return;
    const { data, error } = await supabase.rpc('get_park_presence', { p_marker_id: id });
    if (markerRef.current !== id) return; // карточку уже переключили
    if (error) {
      // PT429 / сеть: оставляем прошлые данные — пустой ответ читался бы как
      // «здесь никого».
      console.warn('[useParkPresence] get_park_presence failed:', error.message);
      return;
    }
    const raw = data as RawPresence | null;
    if (!raw) return;
    setPresence({
      total: raw.total ?? 0,
      anon: raw.anon ?? 0,
      named: (raw.named ?? []).map((p) => ({
        userId: p.user_id,
        displayName: p.display_name,
        dogName: p.dog_name,
        dogAvatar: p.dog_avatar,
        isFriend: p.is_friend,
        isMe: p.is_me,
        manual: p.manual,
        since: p.since,
      })),
      me: { checkedIn: !!raw.me?.checked_in, manual: !!raw.me?.manual },
    });
  }, []);

  useEffect(() => {
    setPresence(null);
    if (!markerId) return;
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [markerId, load]);

  // Свой чек-ин появился / снялся — показать сразу, не дожидаясь опроса.
  const { checkedIn, manual } = useParkCheckinState();
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    load();
  }, [checkedIn, manual, load]);

  return { presence, refresh: load };
}
