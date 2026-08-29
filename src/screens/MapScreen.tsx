import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Animated,
  Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import MapView, { PROVIDER_DEFAULT, MarkerAnimated, MapPressEvent } from 'react-native-maps';
import * as Location from 'expo-location';
import { Menu, Bell, SlidersHorizontal, Locate } from 'lucide-react-native';
import { useApp } from '../hooks/useApp';
import { colors, radii, shadows, heatVis } from '../theme/tokens';
import { WalkSlider } from '../components/WalkSlider';
import { MarkerFilterSheet, RadiusFilter } from '../components/MarkerFilterSheet';
import { MarkerCallout } from '../components/MarkerCallout';
import { UserLocationMarker } from '../components/UserLocationMarker';
import { MapMarkerIcon } from '../components/MapMarkerIcon';
import { useMapMarkers } from '../hooks/useMapMarkers';
import { useHeading } from '../hooks/useHeading';
import { useSmoothedPosition } from '../hooks/useSmoothedPosition';
import { useCalloutAnchor } from '../hooks/useCalloutAnchor';
import { useNearbyDogs } from '../hooks/useNearbyDogs';
import NearbyDogsSheet from '../components/NearbyDogsSheet';
import { CoverageBanner } from '../components/CoverageBanner';
import { LocationRequiredCard } from '../components/LocationRequiredCard';
import { filterMarkersAndWater } from '../lib/markerFilter';
import { MARKER_CONFIG } from '../lib/markerConfig';
import { ensureLocationPermission } from '../lib/locationPermission';
import { isAccurateFix, createGlitchFilter } from '../lib/gpsQuality';
import { supabase } from '../lib/supabase';

// Florentin, Tel Aviv
const FLORENTIN_COORD: [number, number] = [34.7722, 32.0559];

// Base resting position of the heat card / FAB, and how far they lift when
// NearbyDogsSheet is open — kept in sync with its own spring/timing so both
// move together instead of the sheet covering them.
const WIDGETS_BASE_BOTTOM = 165;
const SHEET_HEIGHT_FALLBACK = 220; // real NearbyDogsSheet content is ~200-220px; used until onLayout measures it

interface Props {
  navigation: any;
  onMenuPress?: () => void;
  drawerOpen?: boolean;
}

export function MapScreen({ navigation, onMenuPress, drawerOpen }: Props) {
  const insets = useSafeAreaInsets();
  const {
    t, heatData, isHeatLoading, setIsWalking, isGuest, isWalking, isTrusted,
    radius, setRadius, activeCategories, toggleCategory, userLocation, setUserLocation,
  } = useApp();

  const { markers, waterSources } = useMapMarkers();
  const { dogs: nearbyDogs, hiddenCount: nearbyHiddenCount, locationAvailable: nearbyLocationAvailable } = useNearbyDogs(userLocation);
  const nearbyTotal = nearbyDogs.length + nearbyHiddenCount;

  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [nearbySheetVisible, setNearbySheetVisible] = useState(false);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(130);
  const [detailMarker, setDetailMarker] = useState<import('../lib/markerConfig').MapMarker | null>(null);
  const [locationCardVisible, setLocationCardVisible] = useState(false);

  // Lift the heat card / FAB above NearbyDogsSheet while it's open, in sync
  // with its own open/close animation.
  const [nearbySheetHeight, setNearbySheetHeight] = useState(SHEET_HEIGHT_FALLBACK);
  const widgetsBottom = useRef(new Animated.Value(WIDGETS_BASE_BOTTOM)).current;
  const mapRef = useRef<MapView | null>(null);
  // Screen position of the open marker's pin, so the callout can sit on it.
  // refresh() is wired to the map's region events below — the bubble has to
  // follow its pin while the map moves under it.
  const { point: calloutAnchor, refresh: refreshCalloutAnchor } = useCalloutAnchor(
    mapRef,
    detailMarker ? { latitude: detailMarker.lat, longitude: detailMarker.lng } : null
  );

  function handleMapPress(e: MapPressEvent) {
    // Android delivers a marker tap through the map's onPress as well. That
    // gesture is what opened the callout — it must not close it again.
    if (e.nativeEvent.action === 'marker-press') return;
    setDetailMarker(null);
  }

  useEffect(() => {
    // Open: sit just above the sheet's top edge. Closed: rest at the base offset.
    const target = nearbySheetVisible ? nearbySheetHeight + 16 : WIDGETS_BASE_BOTTOM;
    // 'bottom' is a layout prop — no native driver support, so both branches
    // animate on the JS thread (useNativeDriver: false).
    const animation = nearbySheetVisible
      ? Animated.spring(widgetsBottom, { toValue: target, useNativeDriver: false, tension: 65, friction: 11 })
      : Animated.timing(widgetsBottom, { toValue: target, duration: 250, easing: Easing.in(Easing.ease), useNativeDriver: false });
    animation.start();
  }, [nearbySheetVisible, nearbySheetHeight, widgetsBottom]);

  // Live user position for the custom location marker. The marker slides to
  // each new fix instead of teleporting — see useSmoothedPosition.
  const { coord: userCoord, hasFix: hasUserFix, moveTo: moveUserMarker } = useSmoothedPosition();
  const [accuracy, setAccuracy] = useState<number | undefined>(undefined);

  // Subscriptions live in refs (not the effect closure) so a late start —
  // an in-app grant via handleEnableLocation — is still covered by the
  // unmount cleanup. Caller is responsible for permission being granted.
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  const locationUnmountedRef = useRef(false);
  // Second gate, after accuracy: drops fixes that report a healthy accuracy
  // but land somewhere no walker could have reached. Holds the stream's
  // reference position, so it lives as long as the screen, not the watcher.
  const glitchFilter = useRef(createGlitchFilter<Location.LocationObjectCoords>()).current;

  // Compass: Animated.Value straight into the marker — a heading tick never
  // re-renders this screen. Enabled once location permission is confirmed
  // (same gate the old inline watcher had via startLocationWatcher), and
  // paused while a walk is active — WalkScreen owns the compass then.
  const [locationGranted, setLocationGranted] = useState(false);
  const { headingAnim, reportGpsFix } = useHeading(locationGranted && !isWalking);
  // Ref mirror of isWalking for the async gap in startLocationWatcher —
  // a walk that started while watchPositionAsync was in flight must not
  // leave a live duplicate subscription behind.
  const walkPausedRef = useRef(isWalking);

  async function startLocationWatcher() {
    setLocationGranted(true); // callers only invoke this with permission granted
    if (locationSubRef.current) return; // one watcher max
    const sub = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 2 },
      (loc) => {
        // A fix worse than the gate is dropped whole: it moves neither the
        // marker nor the position everything else (radius filter, nearby
        // dogs, heading source) reads from. What survives that goes through
        // the plausibility filter, which may hold a fix back for one tick
        // and then release it together with the fix that confirmed it.
        if (!isAccurateFix(loc.coords.accuracy)) return;
        for (const coords of glitchFilter.accept(loc.coords, loc.timestamp)) {
          const pt = { latitude: coords.latitude, longitude: coords.longitude };
          moveUserMarker(pt);
          setUserLocation(pt);
          setAccuracy(coords.accuracy ?? undefined);
          reportGpsFix(coords);
        }
      }
    );
    // While we awaited: a concurrent start may have won, the screen unmounted,
    // or a walk began (WalkScreen's watcher feeds the shared context now)
    if (locationUnmountedRef.current || locationSubRef.current || walkPausedRef.current) {
      sub.remove();
      return;
    }
    locationSubRef.current = sub;
  }

  // Walk starts → drop our GPS watcher (WalkScreen runs its own and writes
  // userLocation to the shared context). Walk ends → resume, provided
  // permission was ever granted.
  useEffect(() => {
    walkPausedRef.current = isWalking;
    if (isWalking) {
      locationSubRef.current?.remove();
      locationSubRef.current = null;
      // WalkScreen's watcher owns the position now; whatever we last saw is
      // no longer the previous fix of a continuous stream.
      glitchFilter.reset();
    } else if (locationGranted) {
      startLocationWatcher();
    }
  }, [isWalking, locationGranted]);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      await startLocationWatcher();
    })();
    return () => {
      locationUnmountedRef.current = true;
      locationSubRef.current?.remove();
      locationSubRef.current = null;
    };
  }, []);

  const hiddenCount = Object.values(activeCategories).filter((v) => !v).length;

  // Bell badge: pending incoming friend requests. Lightweight head-count on
  // focus — returning from NotificationsScreen refocuses Main, so the badge
  // updates right after accept/decline without any polling.
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  useFocusEffect(
    useCallback(() => {
      if (isGuest) {
        setPendingRequestCount(0);
        return;
      }
      let cancelled = false;
      (async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;
        const { count } = await supabase
          .from('friendships')
          .select('id', { count: 'exact', head: true })
          .eq('addressee_id', user.id)
          .eq('status', 'pending');
        if (!cancelled) setPendingRequestCount(count ?? 0);
      })();
      return () => {
        cancelled = true;
      };
    }, [isGuest])
  );

  // Geolocation is fetched lazily — only once the user picks a radius other than "all"
  async function handleRadiusChange(next: RadiusFilter) {
    if (next !== 'all' && !userLocation) {
      const { granted } = await ensureLocationPermission();
      if (!granted) {
        setLocationCardVisible(true);
        return; // radius stays whatever it was — never silently claim "500m" while showing everything
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
    }
    setRadius(next);
  }

  // "Включить" in NearbyDogsSheet's no-location state. granted → start the
  // watcher immediately (the mount effect never retries after a denial), so
  // the sheet comes alive without leaving the screen. blocked → recovery card;
  // a bare first-time denial already got its own native dialog from this same
  // ensureLocationPermission() call.
  async function handleEnableLocation() {
    const { granted, blocked } = await ensureLocationPermission();
    if (granted) {
      startLocationWatcher();
      return;
    }
    if (blocked) setLocationCardVisible(true);
  }

  const { filteredMarkers, filteredWaterSources } = filterMarkersAndWater(
    markers, waterSources, radius, activeCategories, userLocation,
  );

  async function handleStartWalk() {
    // Location gate strictly before the heat intercept — without it the
    // walk can start but never actually get tracked/saved (WalkScreen's
    // GPS watcher silently no-ops without permission).
    const { granted } = await ensureLocationPermission();
    if (!granted) {
      setLocationCardVisible(true);
      return;
    }

    if (heatData.status === 'danger') {
      navigation.navigate('HeatWarning');
    } else {
      setIsWalking(true);
      navigation.navigate('WalkActive');
    }
  }

  function centerMapOn(coord: { latitude: number; longitude: number }) {
    // ~city-block zoom
    mapRef.current?.animateToRegion(
      { ...coord, latitudeDelta: 0.005, longitudeDelta: 0.005 },
      350,
    );
  }

  // One-shot centre on the user — no follow mode. Without a position yet:
  // same permission flow as the other entry points (first-time denial already
  // got its native dialog; blocked → recovery card).
  async function handleCenterOnMe() {
    if (userLocation) {
      centerMapOn(userLocation);
      return;
    }
    const { granted, blocked } = await ensureLocationPermission();
    if (!granted) {
      if (blocked) setLocationCardVisible(true);
      return;
    }
    startLocationWatcher();
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const pt = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
    setUserLocation(pt);
    centerMapOn(pt);
  }

  function handleMenuPress() {
    onMenuPress?.();
  }

  function handleBellPress() {
    navigation.navigate('Alerts');
  }

  const heatVis_ = heatVis[heatData.status];

  return (
    <View style={styles.container}>

      {/* ── Карта — занимает весь экран ── */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        initialRegion={{
          latitude: FLORENTIN_COORD[1],
          longitude: FLORENTIN_COORD[0],
          latitudeDelta: 0.018,
          longitudeDelta: 0.018,
        }}
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        onPress={handleMapPress}
        // During the gesture the anchor is recomputed as fast as the bridge
        // keeps up; the Complete event guarantees a final exact placement.
        onRegionChange={refreshCalloutAnchor}
        onRegionChangeComplete={refreshCalloutAnchor}
      >
        {hasUserFix && (
          <MarkerAnimated
            coordinate={userCoord}
            anchor={{ x: 0.5, y: 0.5 }}
            flat
            // Constant true on this one marker only: the native-driven rotation
            // needs a live view. The rest of the map never pulses anymore.
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

      {/* ── Hamburger — top-left ── */}
      {!drawerOpen && (
        <TouchableOpacity
          onPress={handleMenuPress}
          style={[styles.iconBtn, shadows.sm, { position: 'absolute', zIndex: 30, top: insets.top + 8, left: 14 }]}
          activeOpacity={0.8}
        >
          <Menu size={20} color={colors.ink} />
        </TouchableOpacity>
      )}

      {/* ── Filter — top-right group ── */}
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

      {/* ── Bell — top-right ── */}
      <TouchableOpacity
        onPress={handleBellPress}
        style={[styles.iconBtn, shadows.sm, { position: 'absolute', zIndex: 30, top: insets.top + 8, right: 14 }]}
        activeOpacity={0.8}
      >
        <Bell size={20} color={colors.ink} />
        {pendingRequestCount > 0 && (
          <View style={styles.filterBadge}>
            <Text style={styles.filterBadgeTxt}>
              {pendingRequestCount > 9 ? '9+' : pendingRequestCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* ── Heat card ── */}
      {!isHeatLoading && (
        <Animated.View style={{ position: 'absolute', zIndex: 50, bottom: widgetsBottom, left: 16 }}>
          <TouchableOpacity
            style={[styles.heatCard, shadows.sm]}
            onPress={() => navigation.navigate('PavementTemp')}
            activeOpacity={0.8}
          >
            <Text style={[styles.heatTemp, { color: heatVis_.color }]}>{heatData.surface_est_c}°</Text>
            <Text style={[styles.heatLabel, { color: heatVis_.color }]}>⚠️ asphalt</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* ── Right-hand map controls column: locate-me above add-marker FAB.
             Physical right — deliberately not mirrored in RTL, same as the FAB. ── */}
      <Animated.View style={{ position: 'absolute', zIndex: 50, bottom: widgetsBottom, right: 16, gap: 12 }}>
        <TouchableOpacity
          style={[styles.mapControlBtn, shadows.lg]}
          onPress={handleCenterOnMe}
          activeOpacity={0.85}
        >
          <Locate size={24} color={colors.white} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.mapControlBtn, shadows.lg]}
          onPress={() => {
            if (isGuest) {
              navigation.navigate('RegisterPrompt');
            } else if (isTrusted || isWalking) {
              navigation.navigate('MarkerCreate');
            } else {
              Alert.alert(t('marker.gatedTitle'), t('marker.gatedBody'));
            }
          }}
          activeOpacity={0.85}
        >
          <Text style={styles.fabIcon}>+</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* ── Coverage banner — показывается, если пользователь вне зоны покрытия ── */}
      <CoverageBanner />

      {/* ── NearbyDogsSheet — абсолютный, bottomOffset = высота нижней панели ── */}
      <View style={styles.nearbySheetWrap}>
        <NearbyDogsSheet
          visible={nearbySheetVisible}
          onClose={() => setNearbySheetVisible(false)}
          bottomOffset={bottomPanelHeight}
          onHeightChange={setNearbySheetHeight}
          dogs={nearbyDogs}
          anonymousCount={nearbyHiddenCount}
          locationAvailable={nearbyLocationAvailable}
          onEnableLocation={handleEnableLocation}
        />
      </View>

      {/* ── Нижняя панель — абсолютная, всегда внизу ── */}
      <View
        style={[styles.bottomPanel, { paddingBottom: insets.bottom + 12 }]}
        onLayout={e => setBottomPanelHeight(e.nativeEvent.layout.height)}
      >
        <TouchableOpacity onPress={() => setNearbySheetVisible(true)} activeOpacity={0.7}>
          <View style={styles.walkersRow}>
            <Text style={styles.walkersEmoji}>🐕🐕🦮</Text>
            <Text style={styles.walkersTxt}>{nearbyTotal}  {t('map.walkingNearby')}</Text>
          </View>
        </TouchableOpacity>

        <WalkSlider
          asphaltTemp={heatData.surface_est_c}
          onWalkStart={handleStartWalk}
        />
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

      <MarkerCallout
        marker={detailMarker}
        anchor={calloutAnchor}
        onClose={() => setDetailMarker(null)}
      />

      {locationCardVisible && (
        <LocationRequiredCard onDismiss={() => setLocationCardVisible(false)} />
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },

  // Top
  row: { flexDirection: 'row', alignItems: 'center' },
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

  // Heat card — bottom-left, rectangular
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

  // Shared look of the right-hand map controls (locate-me + add-marker FAB)
  mapControlBtn: {
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

  nearbySheetWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },

  // Bottom panel — абсолютный, всегда внизу
  bottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    backgroundColor: colors.card,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingTop: 16,
    paddingHorizontal: 16,
    gap: 12,
  },
  walkersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  walkersEmoji: {
    fontSize: 18,
  },
  walkersTxt: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink,
  },

});
