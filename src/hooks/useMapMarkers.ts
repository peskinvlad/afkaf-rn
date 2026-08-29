import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../lib/supabase';
import { MapMarker, WaterSource } from '../lib/markerConfig';

// A marker added mid-walk used to stay invisible until the walk ended: the
// layer was fetched once per screen mount and never again, and starting a walk
// pushes WalkScreen on top of a MapScreen that stays mounted — so each screen
// also held its own copy, and the map underneath could not learn about a
// marker the walk had just added either.
//
// Hence one module-level store rather than per-hook state. Both screens read
// the same markers, one poll refreshes them for however many screens are
// mounted, and an optimistic insert lands in both at once.

// Slow on purpose. A marker someone else drops is worth seeing during a walk,
// but it is not a live-collaboration feature — a minute of latency costs the
// user nothing, and the author of a marker does not wait for this at all
// (addLocalMarker below puts their own marker on the map immediately).
const REFRESH_MS = 60_000;

const MARKER_COLUMNS = 'id, type, lat, lng, description, user_id, created_at';

let markerCache: MapMarker[] = [];
let waterCache: WaterSource[] = [];
let waterLoaded = false;

const markerSubs = new Set<(m: MapMarker[]) => void>();
const waterSubs = new Set<(w: WaterSource[]) => void>();

let refreshTimer: ReturnType<typeof setInterval> | null = null;
let mountedScreens = 0;

// Markers this device has just written, still waiting to show up in a poll.
// A poll that was already in flight when the insert committed comes back
// without the new marker, and without this it would take the marker straight
// back off the map the author had just watched appear.
const pendingLocal = new Map<string, { marker: MapMarker; addedAt: number }>();
// Long enough to cover a poll that overlapped the insert, short enough that a
// marker deleted server-side does not linger. After this the server's answer
// is the only one that counts.
const PENDING_GRACE_MS = 120_000;

export interface PendingMarker {
  marker: MapMarker;
  addedAt: number;
}

// Server answer + whatever this device wrote that the answer has not caught up
// with yet. Prunes `pending` as it goes: an entry the server now reports, or
// one past the grace period, has nothing left to contribute.
export function reconcilePending(
  serverRows: MapMarker[],
  pending: Map<string, PendingMarker>,
  now: number
): MapMarker[] {
  const merged = [...serverRows];
  pending.forEach(({ marker, addedAt }, id) => {
    if (serverRows.some((m) => m.id === id)) {
      pending.delete(id); // the server is reporting it now
    } else if (now - addedAt > PENDING_GRACE_MS) {
      pending.delete(id); // gone for real, or it never landed
    } else {
      merged.push(marker);
    }
  });
  return merged;
}

function publishMarkers(next: MapMarker[]) {
  markerCache = reconcilePending(next, pendingLocal, Date.now());
  markerSubs.forEach((fn) => fn(markerCache));
}

// A full refetch rather than "everything created since last time": markers
// carry a 24h TTL, so the list shrinks as well as grows, and only the whole
// answer reflects that. It is also immune to the clock skew an incremental
// query would inherit — created_at is stamped by the inserting device, not by
// the server.
async function refreshMarkers() {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('markers')
    .select(MARKER_COLUMNS)
    .or(`expires_at.is.null,expires_at.gt."${now}"`);
  if (error) {
    // Keep whatever is on the map. A failed poll on a patchy connection must
    // not blank the layer mid-walk.
    console.warn('[useMapMarkers] markers fetch error:', error.message, error.code);
    return;
  }
  if (data) publishMarkers(data as MapMarker[]);
}

// Static OSM seed data with no TTL — fetched once for the life of the process,
// not per screen mount.
async function loadWaterSources() {
  if (waterLoaded) return;
  const { data, error } = await supabase
    .from('water_sources')
    .select('id, lat, lng, amenity, dog_bowl');
  if (error) {
    console.warn('[useMapMarkers] water_sources fetch error:', error.message, error.code);
    return;
  }
  if (data) {
    waterLoaded = true;
    waterCache = data as WaterSource[];
    waterSubs.forEach((fn) => fn(waterCache));
  }
}

// Show a marker the moment its insert comes back, without waiting for the next
// poll. Called with the row the database returned, so the coordinate on the
// map is the one that was stored — never the raw fix the screen started from.
export function addLocalMarker(marker: MapMarker) {
  if (markerCache.some((m) => m.id === marker.id)) return; // a poll got there first
  pendingLocal.set(marker.id, { marker, addedAt: Date.now() });
  publishMarkers(markerCache);
}

// The poll is only worth running while a map is on screen and the app is in
// the foreground. A walk spends much of its hour with the phone pocketed;
// polling through that would spend battery on a layer nobody is looking at.
function syncTimer() {
  const shouldRun = mountedScreens > 0 && AppState.currentState === 'active';
  if (shouldRun && !refreshTimer) {
    refreshTimer = setInterval(refreshMarkers, REFRESH_MS);
  } else if (!shouldRun && refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

AppState.addEventListener('change', (state) => {
  syncTimer();
  // Coming back to a map that has been asleep: catch up now rather than at the
  // end of the next interval.
  if (state === 'active' && mountedScreens > 0) refreshMarkers();
});

export function useMapMarkers() {
  const [markers, setMarkers] = useState<MapMarker[]>(markerCache);
  const [waterSources, setWaterSources] = useState<WaterSource[]>(waterCache);

  useEffect(() => {
    markerSubs.add(setMarkers);
    waterSubs.add(setWaterSources);
    // Whatever the store already holds, immediately — a screen opening on top
    // of another does not start from an empty map.
    setMarkers(markerCache);
    setWaterSources(waterCache);

    mountedScreens += 1;
    syncTimer();
    refreshMarkers();
    loadWaterSources();

    return () => {
      markerSubs.delete(setMarkers);
      waterSubs.delete(setWaterSources);
      mountedScreens -= 1;
      syncTimer();
    };
  }, []);

  return { markers, waterSources };
}
