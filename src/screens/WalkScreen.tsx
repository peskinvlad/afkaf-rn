import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import MapView, { PROVIDER_DEFAULT, Polyline, Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { Pedometer } from 'expo-sensors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, SlidersHorizontal } from 'lucide-react-native';
import { useApp } from '../hooks/useApp';
import { colors, radii, shadows, heatVis } from '../theme/tokens';
import { haversine } from '../lib/geo';
import { useMapMarkers } from '../hooks/useMapMarkers';
import { filterMarkersAndWater } from '../lib/markerFilter';
import { MARKER_CONFIG } from '../lib/markerConfig';
import { MarkerFilterSheet, RadiusFilter } from '../components/MarkerFilterSheet';
import { MarkerDetailSheet } from '../components/MarkerDetailSheet';
import { UserLocationMarker } from '../components/UserLocationMarker';

const FLORENTIN_COORD = { latitude: 32.0559, longitude: 34.7722 };
const WALKERS_NEARBY = 3;

interface Props {
  navigation: any;
}

export function WalkScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const {
    t, heatData, isHeatLoading, isGuest,
    radius, setRadius, activeCategories, toggleCategory, userLocation, setUserLocation,
  } = useApp();
  const heatVis_ = heatVis[heatData.status];

  // ── Markers + water sources (same shared data as MapScreen) ────────────
  const { markers, waterSources } = useMapMarkers();
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
  const [livePos, setLivePos] = useState<{ latitude: number; longitude: number } | null>(null);
  const [heading, setHeading] = useState(0);
  const [accuracy, setAccuracy] = useState<number | undefined>(undefined);
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  const tracksTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 1000, distanceInterval: 5 },
        (loc) => {
          const pt = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
          setLivePos(pt);
          setAccuracy(loc.coords.accuracy ?? undefined);
          if (loc.coords.heading != null && loc.coords.heading >= 0) {
            setHeading(loc.coords.heading);
          }
          setRoute((prev) => {
            if (prev.length > 0) {
              setDistanceKm((d) => d + haversine(prev[prev.length - 1], pt));
            }
            return [...prev, pt];
          });
          setRegion((r) => ({ ...r, ...pt }));
          setUserLocation(pt);
          setTracksViewChanges(true);
          if (tracksTimer.current) clearTimeout(tracksTimer.current);
          tracksTimer.current = setTimeout(() => setTracksViewChanges(false), 200);
        }
      );
    })();
    return () => {
      sub?.remove();
      if (tracksTimer.current) clearTimeout(tracksTimer.current);
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

          {livePos && (
            <Marker
              coordinate={livePos}
              anchor={{ x: 0.5, y: 0.5 }}
              flat
              tracksViewChanges={tracksViewChanges}
            >
              <UserLocationMarker heading={heading} accuracy={accuracy} />
            </Marker>
          )}

          {filteredMarkers.map((m) => (
            <Marker
              key={m.id}
              coordinate={{ latitude: m.lat, longitude: m.lng }}
              pinColor={MARKER_CONFIG[m.type]?.pinColor ?? '#6b7280'}
              onPress={() => setDetailMarker(m)}
            />
          ))}

          {filteredWaterSources.map((w) => (
            <Marker
              key={`water-${w.id}`}
              coordinate={{ latitude: w.lat, longitude: w.lng }}
              title={MARKER_CONFIG.water.emoji}
              pinColor={MARKER_CONFIG.water.pinColor}
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
          style={[styles.iconBtn, shadows.sm, { position: 'absolute', zIndex: 30, top: insets.top + 8, right: 66 }]}
          activeOpacity={0.8}
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
          <Text style={styles.nearbyTxt}>{WALKERS_NEARBY}  {t('walk.nearby')}</Text>
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
            <TouchableOpacity style={styles.bannerClose} onPress={dismissBanner} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <Text style={styles.bannerCloseTxt}>×</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Finish button */}
        <TouchableOpacity
          style={[styles.finishBtn, shadows.sm]}
          onPress={() => navigation.replace('WalkSummary', {
            duration: seconds,
            steps,
            distanceKm,
            routeCoordinates: route,
          })}
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
  },
  bannerCtaTxt: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
  },
  bannerClose: {
    padding: 2,
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
    paddingVertical: 14,
    alignItems: 'center',
  },
  finishTxt: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.2,
  },
});
