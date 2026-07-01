import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

const POLL_INTERVAL_MS = 30000;

export type FriendshipStatus = 'pending' | 'accepted' | 'declined';

export interface FriendEntry {
  friendship_id: string;
  other_user_id: string;
  status: FriendshipStatus;
  display_name: string | null;
  avatar_url: string | null;
  dog_name: string | null;
  dog_breed: string | null;
  dog_icon: string | null;
}

interface FriendshipRow {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
}

interface ProfileRow {
  id: string;
  display_name: string | null;
}

interface DogRow {
  owner_id: string;
  name: string | null;
  breed: string | null;
  icon: string | null;
}

export interface UseFriendsResult {
  friends: FriendEntry[];
  incoming: FriendEntry[];
  outgoing: FriendEntry[];
  incomingCount: number;
  loading: boolean;
  refresh: () => void;
}

export function useFriends(): UseFriendsResult {
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [incoming, setIncoming] = useState<FriendEntry[]>([]);
  const [outgoing, setOutgoing] = useState<FriendEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      if (mountedRef.current) {
        setFriends([]);
        setIncoming([]);
        setOutgoing([]);
        setLoading(false);
      }
      return;
    }
    const userId = user.id;

    const { data: rows, error } = await supabase
      .from('friendships')
      .select('id, requester_id, addressee_id, status')
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

    if (error) {
      console.warn('[useFriends] friendships fetch error:', error.message);
      if (mountedRef.current) setLoading(false);
      return;
    }

    const friendshipRows = (rows ?? []) as FriendshipRow[];
    const otherIds = Array.from(
      new Set(friendshipRows.map((r) => (r.requester_id === userId ? r.addressee_id : r.requester_id)))
    );

    const profilesById: Record<string, ProfileRow> = {};
    const dogsById: Record<string, DogRow> = {};

    if (otherIds.length > 0) {
      const [{ data: profiles, error: profilesError }, { data: dogs, error: dogsError }] = await Promise.all([
        supabase.from('profiles').select('id, display_name').in('id', otherIds),
        supabase.from('dogs').select('owner_id, name, breed, icon').in('owner_id', otherIds),
      ]);

      if (profilesError) console.warn('[useFriends] profiles fetch error:', profilesError.message);
      if (dogsError) console.warn('[useFriends] dogs fetch error:', dogsError.message);

      for (const p of (profiles ?? []) as ProfileRow[]) profilesById[p.id] = p;
      for (const d of (dogs ?? []) as DogRow[]) {
        if (!dogsById[d.owner_id]) dogsById[d.owner_id] = d;
      }
    }

    function toEntry(row: FriendshipRow): FriendEntry {
      const otherId = row.requester_id === userId ? row.addressee_id : row.requester_id;
      const dog = dogsById[otherId];
      return {
        friendship_id: row.id,
        other_user_id: otherId,
        status: row.status,
        display_name: profilesById[otherId]?.display_name ?? null,
        // auth.users metadata isn't readable for other users from the client;
        // populate this later via an edge function if avatars are needed here.
        avatar_url: null,
        dog_name: dog?.name ?? null,
        dog_breed: dog?.breed ?? null,
        dog_icon: dog?.icon ?? null,
      };
    }

    const nextFriends: FriendEntry[] = [];
    const nextIncoming: FriendEntry[] = [];
    const nextOutgoing: FriendEntry[] = [];

    for (const row of friendshipRows) {
      const entry = toEntry(row);
      if (row.status === 'accepted') {
        nextFriends.push(entry);
      } else if (row.status === 'pending') {
        if (row.addressee_id === userId) nextIncoming.push(entry);
        else nextOutgoing.push(entry);
      }
    }

    if (mountedRef.current) {
      setFriends(nextFriends);
      setIncoming(nextIncoming);
      setOutgoing(nextOutgoing);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [load]);

  return {
    friends,
    incoming,
    outgoing,
    incomingCount: incoming.length,
    loading,
    refresh: load,
  };
}
