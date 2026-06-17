import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { PROVIDER_DEFAULT, Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { Menu, Bell, SlidersHorizontal } from 'lucide-react-native';
import { useApp } from '../hooks/useApp';
import { colors, radii, shadows, heatVis } from '../theme/tokens';
import { WalkSlider } from '../components/WalkSlider';
import { MarkerFilterSheet, RadiusFilter } from '../components/MarkerFilterSheet';
import { MarkerDetailSheet } from '../components/MarkerDetailSheet';
import { UserLocationMarker } from '../components/UserLocationMarker';
import { useMapMarkers } from '../hooks/useMapMarkers';
import { filterMarkersAndWater } from '../lib/markerFilter';
import { MARKER_CONFIG } from '../lib/markerConfig';

// Florentin, Tel Aviv
const FLORENTIN_COORD: [number, number] = [34.7722, 32.0559];

const WALKERS_NOW = 3;

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

  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [detailMarker, setDetailMarker] = useState<import('../lib/markerConfig').MapMarker | null>(null);

  // Live user position + heading for the custom location marker
  const [livePos, setLivePos] = useState<{ latitude: number; longitude: number } | null>(null);
  const [heading, setHeading] = useState(0);
  const [accuracy, setAccuracy] = useState<number | undefined>(undefined);
  // tracksViewChanges: briefly true after each heading update so react-native-maps redraws
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  const tracksTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 1000, distanceInterval: 2 },
        (loc) => {
          const pt = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
          setLivePos(pt);
          setUserLocation(pt);
          setAccuracy(loc.coords.accuracy ?? undefined);
          if (loc.coords.heading != null && loc.coords.heading >= 0) {
            setHeading(loc.coords.heading);
          }
          // Briefly re-enable tracksViewChanges so the marker view redraws
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

  const hiddenCount = Object.values(activeCategories).filter((v) => !v).length;

  // Geolocation is fetched lazily — only once the user picks a radius other than "all"
  async function handleRadiusChange(next: RadiusFilter) {
    setRadius(next);
    if (next !== 'all' && !userLocation) {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
    }
  }

  const { filteredMarkers, filteredWaterSources } = filterMarkersAndWater(
    markers, waterSources, radius, activeCategories, userLocation,
  );

  function handleStartWalk() {
    if (heatData.status === 'danger') {
      navigation.navigate('HeatWarning');
    } else {
      setIsWalking(true);
      navigation.navigate('WalkActive');
    }
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
      {/* ── Map ── */}
      <MapView
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
      >
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

      {/* ── Hamburger — always top-left ── */}
      {!drawerOpen && (
        <TouchableOpacity
          onPress={handleMenuPress}
          style={[styles.iconBtn, shadows.sm, { position: 'absolute', zIndex: 30, top: insets.top + 8, left: 14 }]}
          activeOpacity={0.8}
        >
          <Menu size={20} color={colors.ink} />
        </TouchableOpacity>
      )}

      {/* ── Filter — left of bell, top-right group ── */}
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

      {/* ── Bell — always top-right ── */}
      <TouchableOpacity
        onPress={handleBellPress}
        style={[styles.iconBtn, shadows.sm, { position: 'absolute', zIndex: 30, top: insets.top + 8, right: 14 }]}
        activeOpacity={0.8}
      >
        <Bell size={20} color={colors.ink} />
      </TouchableOpacity>

      {/* ── Heat card — always bottom-left of map (hidden while loading) ── */}
      {!isHeatLoading && (
        <TouchableOpacity
          style={[styles.heatCard, shadows.sm, { bottom: 148 + insets.bottom, left: 14 }]}
          onPress={() => navigation.navigate('HeatDetail')}
          activeOpacity={0.8}
        >
          <Text style={[styles.heatTemp, { color: heatVis_.color }]}>{heatData.surface_est_c}°</Text>
          <Text style={[styles.heatLabel, { color: heatVis_.color }]}>⚠️ asphalt</Text>
        </TouchableOpacity>
      )}

      {/* ── FAB — always bottom-right of map ── */}
      <TouchableOpacity
        style={[styles.fab, shadows.lg, { bottom: 148 + insets.bottom, right: 14 }]}
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

      {/* ── Bottom sheet ── */}
      <View style={[styles.bottomSheet, { paddingBottom: insets.bottom + 12 }]}>
        {/* Walkers row */}
        <View style={[styles.walkersRow, { flexDirection: 'row' }]}>
          <Text style={styles.walkersEmoji}>🐕🐕🦮</Text>
          <Text style={styles.walkersTxt}>{WALKERS_NOW}  {t('map.walkingNearby')}</Text>
        </View>

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

      <MarkerDetailSheet
        marker={detailMarker}
        visible={detailMarker != null}
        onClose={() => setDetailMarker(null)}
      />
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
    position: 'absolute',
    zIndex: 30,
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

  // FAB — square
  fab: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: radii.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
  },
  fabIcon: {
    fontSize: 28,
    color: colors.white,
    lineHeight: 32,
    marginTop: -2,
  },

  // Bottom sheet
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    backgroundColor: colors.card,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingTop: 16,
    paddingHorizontal: 16,
    gap: 12,
  },
  walkersRow: {
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
