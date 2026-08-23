import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import MapView, { PROVIDER_DEFAULT, Polyline, MarkerAnimated } from 'react-native-maps';
import * as Location from 'expo-location';
import { Pedometer } from 'expo-sensors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, SlidersHorizontal } from 'lucide-react-native';
import { useApp } from '../hooks/useApp';
import { colors, radii, shadows, heatVis } from '../theme/tokens';
import { haversine, LatLng } from '../lib/geo';
import { loadHomeZone, isInsideHomeZone, HomeZone } from '../lib/privacyZone';
import { useMapMarkers } from '../hooks/useMapMarkers';
import { useNearbyDogs } from '../hooks/useNearbyDogs';
import { useHeading } from '../hooks/useHeading';
import { useSmoothedPosition } from '../hooks/useSmoothedPosition';
import { isAccurateFix } from '../lib/gpsQuality';
import { filterMarkersAndWater } from '../lib/markerFilter';
import { MARKER_CONFIG } from '../lib/markerConfig';
import { MarkerFilterSheet, RadiusFilter } from '../components/MarkerFilterSheet';
import { MarkerDetailSheet } from '../components/MarkerDetailSheet';
import { UserLocationMarker } from '../components/UserLocationMarker';
import { MapMarkerIcon } from '../components/MapMarkerIcon';
import { FirstWalkTipCard } from '../components/FirstWalkTipCard';
import { supabase } from '../lib/supabase';
import { Visibility } from './SettingsScreen';
import { checkAndAwardBadges } from '../lib/badges';
import { saveWalkHistory, toWalkPath } from '../lib/walkHistory';

const FLORENTIN_COORD = { latitude: 32.0559, longitude: 34.7722 };
const ACTIVE_WALK_PING_MS = 60000;
const MIN_VALID_DISTANCE_KM = 0.3;
const MIN_VALID_DURATION_SEC = 300;

interface Props {
  navigation: any;
}

export function WalkScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const {
    t, heatData, isHeatLoading, isGuest, confirmedCount,
    radius, setRadius, activeCategories, toggleCategory, userLocation, setUserLocation,
  } = useApp();
  const heatVis_ = heatVis[heatData.status];

  // ── Markers + water sources (same shared data as MapScreen) ────────────
  const { markers, waterSources } = useMapMarkers();
  const { dogs: nearbyDogs, hiddenCount: nearbyHiddenCount } = useNearbyDogs(userLocation);
  const nearbyTotal = nearbyDogs.length + nearbyHiddenCount;
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [detailMarker, setDetailMarker] = useState<import('../lib/markerConfig').MapMarker | null>(null);
  const hiddenCount = Object.values(activeCategories).filter((v) => !v).length;
  const { filteredMarkers, filteredWaterSources } = filterMarkersAndWater(
    markers, waterSources, radius, activeCategories, userLocation,
  );

  // Radius change — no extra location request here: the GPS watcher below
  // (already running for route tracking) keeps userLocation fresh in context.
  function handleRadiusChange(next: RadiusFilter) {
    setRadius(next);
  }

  // ── Timer ──────────────────────────────────────────────────────────────
  const [seconds, setSeconds] = useState(0);
  const walkStartedAt = useRef(new Date().toISOString()).current;
  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const timeStr = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

  // ── Steps — Pedometer (real, 0 if unavailable) ─────────────────────────
  const [steps, setSteps] = useState(0);
  useEffect(() => {
    let sub: { remove: () => void } | null = null;
    Pedometer.isAvailableAsync().then((available) => {
      if (!available) return;
      sub = Pedometer.watchStepCount((result) => setSteps(result.steps));
    });
    return () => { sub?.remove(); };
  }, []);

  // ── GPS route + Haversine distance ────────────────────────────────────
  const [route, setRoute] = useState<{ latitude: number; longitude: number }[]>([]);
  const [distanceKm, setDistanceKm] = useState(0);
  const [region, setRegion] = useState({
    ...FLORENTIN_COORD,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });
  // The marker slides to each new fix instead of teleporting there.
  const { coord: userCoord, hasFix: hasUserFix, moveTo: moveUserMarker } = useSmoothedPosition();
  const [accuracy, setAccuracy] = useState<number | undefined>(undefined);
  // Heading drives the marker via Animated.Value — no per-tick re-renders.
  // Enabled once the GPS effect below confirms permission; that same effect
  // feeds it every accepted fix so it can switch to GPS course while moving.
  const [locationGranted, setLocationGranted] = useState(false);
  const { headingAnim, reportGpsFix } = useHeading(locationGranted);

  // ── active_walks presence row ───────────────────────────────────────────
  // Created on the first GPS fix of this screen (i.e. right as the walk
  // starts), pinged every 60s while walking, deleted on finish/unmount.
  // Skipped entirely for guests and for visibility='nobody'.
  const activeWalkUserId = useRef<string | null>(null);
  const activeWalkRowExists = useRef(false);
  const activeWalkStartAttempted = useRef(false);
  const latestPos = useRef<LatLng | null>(null);
  const distanceKmRef = useRef(0);
  // Publish context resolved once on the first fix, reused by every publish
  // decision after (no re-hitting auth/dogs/AsyncStorage per ping).
  const activeWalkVisibility = useRef<Visibility | null>(null);
  const activeWalkDogId = useRef<string | null>(null);
  const activeWalkStartedAt = useRef<string>('');
  const activeWalkContextReady = useRef(false);
  const homeZone = useRef<HomeZone | null>(null);

  // Resolve who we are, chosen visibility, our dog, and the home privacy zone.
  // Returns false when this walk must never publish (guest or 'nobody').
  // Home zone is read here — once at start, not per ping.
  async function resolveActiveWalkContext(): Promise<boolean> {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) return false; // guest — no active_walks row

    const stored = await AsyncStorage.getItem('privacy_visibility');
    const visibility: Visibility = (stored as Visibility) || 'friends';
    if (visibility === 'nobody') return false;

    const { data: dog } = await supabase
      .from('dogs')
      .select('id')
      .eq('owner_id', userId)
      .limit(1)
      .maybeSingle();

    activeWalkUserId.current = userId;
    activeWalkVisibility.current = visibility;
    activeWalkDogId.current = dog?.id ?? null;
    activeWalkStartedAt.current = new Date().toISOString();
    homeZone.current = await loadHomeZone();
    activeWalkContextReady.current = true;
    return true;
  }

  // Create the presence row (first publish). Upsert so it also recovers a row
  // a previous session may have left behind for this user.
  async function createActiveWalkRow(pt: LatLng) {
    const { error } = await supabase.from('active_walks').upsert(
      {
        user_id: activeWalkUserId.current,
        dog_id: activeWalkDogId.current,
        lat: pt.latitude,
        lng: pt.longitude,
        distance_km: distanceKmRef.current,
        visibility: activeWalkVisibility.current,
        started_at: activeWalkStartedAt.current,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );
    if (!error) activeWalkRowExists.current = true;
  }

  async function pingActiveWalkRow(pt: LatLng) {
    if (!activeWalkRowExists.current || !activeWalkUserId.current) return;
    await supabase
      .from('active_walks')
      .update({
        lat: pt.latitude,
        lng: pt.longitude,
        distance_km: distanceKmRef.current,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', activeWalkUserId.current);
  }

  async function stopActiveWalkRow() {
    if (!activeWalkRowExists.current || !activeWalkUserId.current) return;
    activeWalkRowExists.current = false;
    await supabase.from('active_walks').delete().eq('user_id', activeWalkUserId.current);
  }

  // Single publish gate used by both the first fix and every 60s ping.
  // Order: guest/nobody (context) first, then the home-zone check.
  //   inside home zone → never publish; take an existing row down
  //   outside the zone → create the row (first time) or ping it
  // No home zone configured → homeZone is null → always "outside" → old behaviour.
  async function syncActiveWalkRow(pt: LatLng) {
    if (!activeWalkContextReady.current) return;
    const zone = homeZone.current;
    const inside = zone != null && isInsideHomeZone(pt.latitude, pt.longitude, zone);
    if (inside) {
      // Entered zone → remove the row, don't leave a stale edge point up for 30 min
      await stopActiveWalkRow();
      return;
    }
    if (activeWalkRowExists.current) {
      await pingActiveWalkRow(pt);
    } else {
      await createActiveWalkRow(pt);
    }
  }

  // First GPS fix: resolve context once, then run the publish gate.
  async function startActiveWalkRow(pt: LatLng) {
    const ok = await resolveActiveWalkContext();
    if (!ok) return;
    await syncActiveWalkRow(pt);
  }

  // A walk only "counts" (walk_history + badges) past a minimum bar, so an
  // accidental swipe doesn't pollute streaks/totals.
  async function handleFinish() {
    stopActiveWalkRow();

    const isValidWalk = distanceKm >= MIN_VALID_DISTANCE_KM && seconds >= MIN_VALID_DURATION_SEC;
    let newBadgeIds: string[] = [];

    if (isValidWalk) {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (userId) {
        // Dog already resolved on the first GPS fix unless publishing was
        // skipped (visibility='nobody') — then it's one lookup at finish.
        let dogId = activeWalkDogId.current;
        if (!activeWalkContextReady.current) {
          const { data: dog } = await supabase
            .from('dogs')
            .select('id')
            .eq('owner_id', userId)
            .limit(1)
            .maybeSingle();
          dogId = dog?.id ?? null;
        }
        await saveWalkHistory({
          user_id: userId,
          distance_km: distanceKm,
          duration_min: Math.floor(seconds / 60),
          duration_s: seconds,
          started_at: walkStartedAt,
          ended_at: new Date().toISOString(),
          steps,
          dog_id: dogId,
          path: toWalkPath(route),
          is_valid: isValidWalk,
        });
        const newBadges = await checkAndAwardBadges(confirmedCount);
        newBadgeIds = newBadges.map((b) => b.id);
      }
    }

    navigation.replace('WalkSummary', {
      duration: seconds,
      steps,
      distanceKm,
      routeCoordinates: route,
      isValidWalk,
      newBadgeIds,
    });
  }

  // 60s publish tick while walking — the gate decides publish vs unpublish
  // based on whether the current point is inside the home privacy zone.
  useEffect(() => {
    const id = setInterval(() => {
      if (latestPos.current) syncActiveWalkRow(latestPos.current);
    }, ACTIVE_WALK_PING_MS);
    return () => clearInterval(id);
  }, []);

  // Safety net: leaving the screen any other way than "Finish" still cleans up
  useEffect(() => {
    return () => { stopActiveWalkRow(); };
  }, []);

  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      setLocationGranted(true);
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 5 },
        (loc) => {
          // Everything below this line — marker, recorded track, distance,
          // the published presence row — is fed only by fixes that pass the
          // accuracy gate. A bad fix used to add tens of metres of phantom
          // distance to the walk and drag the route line with it.
          if (!isAccurateFix(loc.coords.accuracy)) return;
          const pt = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
          moveUserMarker(pt);
          reportGpsFix(loc.coords);
          setAccuracy(loc.coords.accuracy ?? undefined);
          setRoute((prev) => {
            if (prev.length > 0) {
              const inc = haversine(prev[prev.length - 1], pt);
              setDistanceKm((d) => {
                const next = d + inc;
                distanceKmRef.current = next;
                return next;
              });
            }
            return [...prev, pt];
          });
          setRegion((r) => ({ ...r, ...pt }));
          setUserLocation(pt);

          latestPos.current = pt;
          if (!activeWalkStartAttempted.current) {
            activeWalkStartAttempted.current = true;
            startActiveWalkRow(pt);
          }
        }
      );
    })();
    return () => {
      sub?.remove();
    };
  }, []);

  // ── Guest banner ───────────────────────────────────────────────────────
  // bannerDismissed — user explicitly closed it this session.
  // The banner shows whenever isGuest is true AND not dismissed.
  // When isGuest becomes false (after login) it hides automatically.
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const bannerVisible = isGuest && !bannerDismissed;

  function dismissBanner() {
    setBannerDismissed(true);
  }

  return (
    <View style={styles.container}>

      {/* ── Map (flex: 1, not absoluteFill) ── */}
      <View style={styles.mapContainer}>
        <MapView
          style={StyleSheet.absoluteFill}
          provider={PROVIDER_DEFAULT}
          region={region}
          showsMyLocationButton={false}
          showsCompass={false}
          toolbarEnabled={false}
        >
          {route.length > 1 && (
            <Polyline coordinates={route} strokeColor={colors.primary} strokeWidth={4} />
          )}

          {hasUserFix && (
            <MarkerAnimated
              coordinate={userCoord}
              anchor={{ x: 0.5, y: 0.5 }}
              flat
              // Constant true on this one marker only — the native-driven
              // rotation needs a live view; no more per-fix pulsing.
              tracksViewChanges
            >
              <UserLocationMarker headingAnim={headingAnim} accuracy={accuracy} />
            </MarkerAnimated>
          )}

          {filteredMarkers.map((m) => (
            <MapMarkerIcon
              key={m.id}
              coordinate={{ latitude: m.lat, longitude: m.lng }}
              emoji={MARKER_CONFIG[m.type]?.emoji ?? '📍'}
              color={MARKER_CONFIG[m.type]?.pinColor ?? '#6b7280'}
              onPress={() => setDetailMarker(m)}
            />
          ))}

          {filteredWaterSources.map((w) => (
            <MapMarkerIcon
              key={`water-${w.id}`}
              coordinate={{ latitude: w.lat, longitude: w.lng }}
              emoji={MARKER_CONFIG.water.emoji}
              color={MARKER_CONFIG.water.pinColor}
              title={MARKER_CONFIG.water.emoji}
              description={w.amenity ?? undefined}
            />
          ))}
        </MapView>

        {/* ── LIVE chip — top center ── */}
        <View style={[styles.liveChip, { top: insets.top + 12 }]}>
          <View style={styles.liveDot} />
          <Text style={styles.liveTxt}>LIVE</Text>
        </View>

        {/* ── Filter — top right group ── */}
        <TouchableOpacity
          onPress={() => setFilterSheetOpen(true)}
          style={[styles.iconBtn, shadows.sm, { position: 'absolute', zIndex: 30, top: insets.top + 8, right: 70 }]}
          activeOpacity={0.8}
          hitSlop={{ top: 4, right: 4, bottom: 4, left: 4 }}
        >
          <SlidersHorizontal size={20} color={colors.ink} />
          {hiddenCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeTxt}>{hiddenCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* ── Bell — top right ── */}
        <TouchableOpacity
          onPress={() => navigation.navigate('Alerts')}
          style={[styles.iconBtn, shadows.sm, { position: 'absolute', zIndex: 30, top: insets.top + 8, right: 14 }]}
          activeOpacity={0.8}
          hitSlop={{ top: 4, right: 4, bottom: 4, left: 4 }}
        >
          <Bell size={20} color={colors.ink} />
        </TouchableOpacity>

        {/* Spacer pushes bottom row to the bottom of the map */}
        <View style={{ flex: 1 }} />

        {/* ── Map bottom controls — flex row, no absolute ── */}
        <View style={styles.mapBottomRow}>
          {isHeatLoading ? (
            // Spacer keeps the FAB pinned right (mapBottomRow uses space-between)
            <View />
          ) : (
            <TouchableOpacity
              style={[styles.heatCard, shadows.sm]}
              onPress={() => navigation.navigate('HeatDetail')}
              activeOpacity={0.8}
            >
              <Text style={[styles.heatTemp, { color: heatVis_.color }]}>{heatData.surface_est_c}°</Text>
              <Text style={[styles.heatLabel, { color: heatVis_.color }]}>⚠️ asphalt</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.fab, shadows.lg]}
            onPress={() => navigation.navigate('MarkerCreate')}
            activeOpacity={0.85}
          >
            <Text style={styles.fabIcon}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Bottom sheet (natural height, always visible) ── */}
      <View style={[styles.bottomSheet, { paddingBottom: insets.bottom + 8 }]}>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatCol label={t('walk.active.duration')} value={timeStr} />
          <View style={styles.statDivider} />
          <StatCol label={t('walk.active.steps')} value={String(steps)} />
          <View style={styles.statDivider} />
          <StatCol label={t('walk.active.km')} value={distanceKm.toFixed(2)} />
        </View>

        {/* Walkers nearby */}
        <TouchableOpacity style={styles.nearbyRow} activeOpacity={0.7}>
          <Text style={styles.nearbyEmoji}>🐕🐕🦮</Text>
          <Text style={styles.nearbyTxt}>{nearbyTotal}  {t('walk.nearby')}</Text>
          <Text style={styles.nearbyArrow}>▼</Text>
        </TouchableOpacity>

        {/* Guest banner */}
        {bannerVisible && (
          <View style={styles.banner}>
            <View style={styles.bannerText}>
              <Text style={styles.bannerTitle}>{t('walk.guest.title')}</Text>
              <Text style={styles.bannerSub}>{t('walk.guest.subtitle')}</Text>
            </View>
            <TouchableOpacity
              style={styles.bannerCta}
              onPress={() => navigation.navigate('Register')}
              activeOpacity={0.85}
            >
              <Text style={styles.bannerCtaTxt}>{t('walk.guest.cta')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.bannerClose} onPress={dismissBanner} hitSlop={{ top: 14, right: 14, bottom: 14, left: 14 }}>
              <Text style={styles.bannerCloseTxt}>×</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Finish button */}
        <TouchableOpacity
          style={[styles.finishBtn, shadows.sm]}
          onPress={handleFinish}
          activeOpacity={0.85}
        >
          <Text style={styles.finishTxt}>{t('walk.active.finish')}</Text>
        </TouchableOpacity>
      </View>

      <MarkerFilterSheet
        visible={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        radius={radius}
        onRadiusChange={handleRadiusChange}
        activeCategories={activeCategories}
        onToggleCategory={toggleCategory}
        markerConfig={MARKER_CONFIG}
        t={t}
      />

      <MarkerDetailSheet
        marker={detailMarker}
        visible={detailMarker != null}
        onClose={() => setDetailMarker(null)}
      />

      <FirstWalkTipCard onSetupPrivacy={() => navigation.navigate('PrivacyRadius')} />
    </View>
  );
}

// ── Stat column ────────────────────────────────────────────────────────────────
function StatCol({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCol}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  mapContainer: { flex: 1, position: 'relative' },

  // Top-right icon buttons (Bell, Filter) — same style as MapScreen
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: '#9b1c1c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeTxt: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.white,
  },

  // Live chip
  liveChip: {
    position: 'absolute',
    alignSelf: 'center',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 30,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  liveTxt: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 1,
  },


  heatCard: {
    backgroundColor: colors.card,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 64,
  },
  heatTemp: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  heatLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },

  mapBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 14,
    paddingBottom: 12,
    zIndex: 30,
  },

  // FAB
  fab: {
    width: 52,
    height: 52,
    borderRadius: radii.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabIcon: {
    fontSize: 28,
    color: colors.white,
    lineHeight: 32,
    marginTop: -2,
  },

  // Bottom sheet
  bottomSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingTop: 16,
    paddingHorizontal: 16,
    gap: 10,
    zIndex: 20,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border,
  },

  // Walkers nearby
  nearbyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
    minHeight: 48,
  },
  nearbyEmoji: { fontSize: 16 },
  nearbyTxt: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink,
  },
  nearbyArrow: {
    fontSize: 11,
    color: colors.textMuted,
  },

  // Guest banner
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: radii.md,
    padding: 10,
    gap: 8,
  },
  bannerText: { flex: 1, gap: 2 },
  bannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  bannerSub: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  bannerCta: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 7,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerCtaTxt: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
  },
  bannerClose: {
    padding: 4,
    // banner's row gap already gives 8pt from bannerCta — this adds the
    // remaining 6pt to reach a 14pt gap between two small, adjacent targets.
    marginLeft: 6,
  },
  bannerCloseTxt: {
    fontSize: 18,
    color: colors.textMuted,
    lineHeight: 20,
  },

  // Finish
  finishBtn: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingVertical: 19,
    alignItems: 'center',
  },
  finishTxt: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.2,
  },
});
