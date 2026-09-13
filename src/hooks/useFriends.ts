import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { fetchUserPreviews } from '../lib/userPreviews';

const POLL_INTERVAL_MS = 30000;

export type FriendshipStatus = 'pending' | 'accepted' | 'declined';

// Relationship of the current user TO another user, as get_friendship_status /
// AddFriendSheet phrase it. Derived here from the loaded friendship rows so the
// nearby list can label a card without an extra per-user RPC.
export type FriendshipRpcStatus = 'friends' | 'pending_sent' | 'pending_received' | 'none';

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

export interface UseFriendsResult {
  friends: FriendEntry[];
  incoming: FriendEntry[];
  outgoing: FriendEntry[];
  incomingCount: number;
  // other_user_id → my relationship to them. Absent = 'none'.
  statusByUser: Record<string, FriendshipRpcStatus>;
  loading: boolean;
  refresh: () => void;
}

export function useFriends(): UseFriendsResult {
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [incoming, setIncoming] = useState<FriendEntry[]>([]);
  const [outgoing, setOutgoing] = useState<FriendEntry[]>([]);
  const [statusByUser, setStatusByUser] = useState<Record<string, FriendshipRpcStatus>>({});
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      if (mountedRef.current) {
        setFriends([]);
        setIncoming([]);
        setOutgoing([]);
        setStatusByUser({});
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

    // Names + dog come from get_user_previews (SECURITY DEFINER): profiles/dogs
    // are owner-only under RLS, so a direct client read returns null here.
    const previews = await fetchUserPreviews(otherIds);

    function toEntry(row: FriendshipRow): FriendEntry {
      const otherId = row.requester_id === userId ? row.addressee_id : row.requester_id;
      const preview = previews[otherId];
      return {
        friendship_id: row.id,
        other_user_id: otherId,
        status: row.status,
        display_name: preview?.display_name ?? null,
        // auth.users metadata isn't readable for other users from the client;
        // populate this later via an edge function if avatars are needed here.
        avatar_url: null,
        dog_name: preview?.dog_name ?? null,
        // get_user_previews doesn't return breed; the card falls back gracefully.
        dog_breed: null,
        dog_icon: preview?.dog_avatar ?? null,
      };
    }

    const nextFriends: FriendEntry[] = [];
    const nextIncoming: FriendEntry[] = [];
    const nextOutgoing: FriendEntry[] = [];
    const nextStatus: Record<string, FriendshipRpcStatus> = {};

    for (const row of friendshipRows) {
      const entry = toEntry(row);
      if (row.status === 'accepted') {
        nextFriends.push(entry);
        nextStatus[entry.other_user_id] = 'friends';
      } else if (row.status === 'pending') {
        if (row.addressee_id === userId) {
          nextIncoming.push(entry);
          nextStatus[entry.other_user_id] = 'pending_received';
        } else {
          nextOutgoing.push(entry);
          nextStatus[entry.other_user_id] = 'pending_sent';
        }
      }
    }

    if (mountedRef.current) {
      setFriends(nextFriends);
      setIncoming(nextIncoming);
      setOutgoing(nextOutgoing);
      setStatusByUser(nextStatus);
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
    statusByUser,
    loading,
    refresh: load,
  };
}
