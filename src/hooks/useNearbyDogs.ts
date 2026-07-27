import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { haversine, LatLng } from '../lib/geo';
import { NearbyDog } from '../components/NearbyDogsSheet';

const RADIUS_KM = 2;
const POLL_MS = 30000;

interface WalkRow {
  user_id: string;
  lat: number;
  lng: number;
  dogs: { id: string; name: string; breed: string | null; icon: string | null } | null;
}

// Nearby dogs within RADIUS_KM, filtered client-side (row count is small).
// RLS on active_walks already restricts what comes back to: your own walk,
// 'everyone' walks, and 'friends' walks from accepted friends — so no extra
// privacy filtering is needed here, just distance.
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
      supabase.from('active_walks').select('user_id, lat, lng, dogs(id, name, breed, icon)'),
      supabase.rpc('get_hidden_walks_count', { user_lat: loc.latitude, user_lng: loc.longitude }),
    ]);

    const nearby = ((walks ?? []) as unknown as WalkRow[])
      .filter((w) => w.user_id !== myUserId)
      .filter((w) => haversine(loc, { latitude: w.lat, longitude: w.lng }) <= RADIUS_KM)
      .filter((w): w is WalkRow & { dogs: NonNullable<WalkRow['dogs']> } => w.dogs != null)
      .map((w) => ({
        id: w.dogs.id,
        name: w.dogs.name,
        breed: w.dogs.breed ?? '',
        emoji: w.dogs.icon ?? '🐕',
      }));

    setDogs(nearby);
    setHiddenCount(typeof hidden === 'number' ? hidden : 0);
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  return { dogs, hiddenCount, locationAvailable: userLocation != null, refresh: load };
}
