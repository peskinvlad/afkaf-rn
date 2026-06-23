import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  PanResponder,
  Dimensions,
  Platform,
} from 'react-native';
import MapView from 'react-native-maps';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../hooks/useApp';
import { colors, radii, shadows, spacing, typography } from '../theme/tokens';

const FLORENTIN = { latitude: 32.0559, longitude: 34.7722 };
const MIN_RADIUS = 50;
const MAX_RADIUS = 500;
const STEP = 50;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SLIDER_WIDTH = SCREEN_WIDTH - spacing.lg * 2 - 48; // horizontal padding

// Approximate metres → screen pixels at zoom 15 (~1px ≈ 3m)
function metresToPx(m: number, zoom = 15): number {
  const metersPerPx = (156543.03392 * Math.cos((FLORENTIN.latitude * Math.PI) / 180)) / Math.pow(2, zoom);
  return m / metersPerPx;
}

function clampStep(value: number): number {
  return Math.round(Math.min(Math.max(value, MIN_RADIUS), MAX_RADIUS) / STEP) * STEP;
}

export function PrivacyRadiusScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { t, userLocation } = useApp();
  const center = userLocation ?? FLORENTIN;

  const [radius, setRadius] = useState(150);
  const mapRef = useRef<MapView>(null);

  // PanResponder-based slider ─────────────────────────────────────────────────
  const sliderBase = useRef(0);
  const sliderStartX = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (_, gs) => {
        sliderStartX.current = gs.x0;
        sliderBase.current = radius;
      },
      onPanResponderMove: (_, gs) => {
        const delta = gs.dx / SLIDER_WIDTH;
        const raw = sliderBase.current + delta * (MAX_RADIUS - MIN_RADIUS);
        setRadius(clampStep(raw));
      },
    }),
  ).current;

  // Circle radius on screen (approximate, zoom 15)
  const circlePx = metresToPx(radius);
  const thumbLeft = ((radius - MIN_RADIUS) / (MAX_RADIUS - MIN_RADIUS)) * SLIDER_WIDTH;

  async function handleSave() {
    // Use map center if user panned; fall back to userLocation / Florentin
    let lat = center.latitude;
    let lng = center.longitude;
    try {
      const cam = await mapRef.current?.getCamera();
      if (cam?.center) { lat = cam.center.latitude; lng = cam.center.longitude; }
    } catch {}
    await AsyncStorage.multiSet([
      ['privacy_home_lat', String(lat)],
      ['privacy_home_lng', String(lng)],
      ['privacy_home_radius', String(radius)],
    ]);
    navigation.goBack();
  }

  const MAP_HEIGHT = Dimensions.get('window').height * 0.55;

  return (
    <View style={styles.root}>
      {/* ── Map (top 55%) ── */}
      <View style={{ height: MAP_HEIGHT }}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFillObject}
          initialRegion={{
            latitude: center.latitude,
            longitude: center.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
        />

        {/* Back button over map */}
        <TouchableOpacity
          style={[styles.mapBack, { top: insets.top + spacing.md }]}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.mapBackText}>←</Text>
        </TouchableOpacity>

        {/* Full-size overlay — centres both circle and dot on exact map centre */}
        <View style={styles.centreOverlay} pointerEvents="none">
          {/* Pin wrapper sized to the circle — centred by flex overlay */}
          <View style={{ width: circlePx * 2, height: circlePx * 2, alignItems: 'center', justifyContent: 'center' }}>
            {/* Privacy circle fills the wrapper */}
            <View style={[StyleSheet.absoluteFillObject, styles.privacyCircle, { borderRadius: circlePx }]} />
            {/* Centre dot — centred by flex */}
            <View style={styles.centreDot} />
            {/* Radius badge — anchored to right of wrapper centre */}
            <View style={styles.radiusBadge}>
              <Text style={styles.radiusBadgeText}>{radius} м</Text>
            </View>
          </View>
        </View>
      </View>

      {/* ── Bottom panel (bottom 45%) ── */}
      <View style={[styles.panel, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Text style={styles.panelTitle}>{t('privacy_radius.title')}</Text>
        <Text style={styles.panelSubtitle}>{t('privacy_radius.subtitle')}</Text>

        {/* Slider track */}
        <View style={styles.sliderContainer} {...panResponder.panHandlers}>
          {/* Track */}
          <View style={styles.sliderTrack}>
            <View style={[styles.sliderFill, { width: thumbLeft + 10 }]} />
          </View>
          {/* Thumb */}
          <View style={[styles.sliderThumb, { left: thumbLeft }]} />
        </View>

        <View style={styles.sliderLabels}>
          <Text style={styles.sliderLabel}>{MIN_RADIUS} м</Text>
          <Text style={styles.sliderLabel}>{MAX_RADIUS} м</Text>
        </View>

        <Text style={styles.description}>{t('privacy_radius.description')}</Text>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
          <Text style={styles.saveBtnText}>{t('common.save')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },

  // Map
  mapBack: {
    position: 'absolute',
    left: spacing.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  mapBackText: { fontSize: 20, color: colors.ink },

  centreOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  privacyCircle: {
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: 'rgba(44,95,37,0.12)',
  },
  centreDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.white,
  },
  radiusBadge: {
    position: 'absolute',
    left: '60%',
    top: '50%',
    marginTop: -10,
    backgroundColor: colors.white,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    ...shadows.sm,
  },
  radiusBadgeText: { ...typography.xs, color: colors.primary, fontFamily: 'Nunito_700Bold' },

  // Bottom panel
  panel: {
    flex: 1,
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: spacing.lg + spacing.md,
    paddingTop: spacing.xxl,
    gap: spacing.md,
    ...shadows.lg,
  },
  panelTitle: { ...typography.h2, color: colors.ink },
  panelSubtitle: { ...typography.sm, color: colors.textMuted },

  // Slider
  sliderContainer: {
    height: 40,
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  sliderTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  sliderFill: {
    height: 6,
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  sliderThumb: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.primary,
    top: 8,
    marginLeft: -12,
    ...shadows.sm,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -spacing.sm,
  },
  sliderLabel: { ...typography.xs, color: colors.textMuted },

  description: { ...typography.sm, color: colors.textSecondary, lineHeight: 20 },

  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  saveBtnText: { ...typography.h3, color: colors.white },
});
