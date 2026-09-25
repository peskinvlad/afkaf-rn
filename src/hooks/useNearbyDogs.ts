import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../lib/supabase';
import { fetchUserPreviews } from '../lib/userPreviews';
import { haversine, LatLng } from '../lib/geo';
import { NearbyDog } from '../components/NearbyDogsSheet';

const RADIUS_KM = 2;
const POLL_MS = 30000;

interface WalkRow {
  user_id: string;
  lat: number;
  lng: number;
  updated_at: string;
}

// Nearby dogs within RADIUS_KM, filtered client-side (row count is small).
// RLS on active_walks already restricts what comes back to: your own walk,
// 'everyone' walks, and 'friends' walks from accepted friends — so no extra
// privacy filtering is needed here, just distance.
//
// Names/dog come from get_user_previews (SECURITY DEFINER), because profiles
// and dogs are owner-only under RLS; a client can only read them for users it
// is already connected to or who are visibly walking nearby — which is exactly
// this set.
export function useNearbyDogs(userLocation: LatLng | null) {
  const [dogs, setDogs] = useState<NearbyDog[]>([]);
  const [hiddenCount, setHiddenCount] = useState(0);
  const locationRef = useRef(userLocation);
  locationRef.current = userLocation;

  const load = useCallback(async () => {
    const loc = locationRef.current;
    if (!loc) {
      setDogs([]);
      setHiddenCount(0);
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    const myUserId = session?.user?.id ?? null;

    // Guests have no authenticated JWT — get_hidden_walks_count is REVOKEd from
    // anon, so don't call it (or the RLS-gated active_walks read) at all.
    if (!myUserId) {
      setDogs([]);
      setHiddenCount(0);
      return;
    }

    const [{ data: walks }, { data: hidden }] = await Promise.all([
      supabase.from('active_walks').select('user_id, lat, lng, updated_at'),
      supabase.rpc('get_hidden_walks_count', { user_lat: loc.latitude, user_lng: loc.longitude }),
    ]);

    const nearby = ((walks ?? []) as WalkRow[])
      .filter((w) => w.user_id !== myUserId)
      .filter((w) => haversine(loc, { latitude: w.lat, longitude: w.lng }) <= RADIUS_KM);

    const previews = await fetchUserPreviews(nearby.map((w) => w.user_id));

    const entries: NearbyDog[] = nearby.map((w) => {
      const p = previews[w.user_id];
      return {
        userId: w.user_id,
        dogName: p?.dog_name ?? '',
        ownerName: p?.display_name ?? '',
        avatar: p?.dog_avatar ?? '🐕',
        lat: w.lat,
        lng: w.lng,
        // No updated_at (shouldn't happen — RLS already filters on it) → treat as
        // "now" so a missing timestamp never hides an otherwise-visible friend.
        updatedAt: w.updated_at ? new Date(w.updated_at).getTime() : Date.now(),
      };
    });

    setDogs(entries);
    setHiddenCount(typeof hidden === 'number' ? hidden : 0);
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    // Coming back from the background: iOS suspends the poll timer, so refetch
    // once on foreground instead of waiting out the rest of the interval.
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') load();
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [load]);

  return { dogs, hiddenCount, locationAvailable: userLocation != null, refresh: load };
}
