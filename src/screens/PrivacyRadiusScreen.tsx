import React, { useEffect, useRef, useState } from 'react';
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
import { loadHomeZone } from '../lib/privacyZone';
import { colors, radii, shadows, spacing, typography } from '../theme/tokens';

const FLORENTIN = { latitude: 32.0559, longitude: 34.7722 };
const MIN_RADIUS = 50;
const MAX_RADIUS = 500;
const STEP = 50;
// Показывается, только когда зона ещё не настроена — существующая всегда
// подгружается из хранилища (см. эффект в компоненте).
const DEFAULT_RADIUS = 150;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SLIDER_WIDTH = SCREEN_WIDTH - spacing.lg * 2 - 48; // horizontal padding
// Бейдж радиуса прижимается к правому краю круга, но не дальше — иначе на
// большом радиусе он уезжает за экран.
const BADGE_MAX_OFFSET = SCREEN_WIDTH / 2 - 70;

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

  const [radius, setRadius] = useState(DEFAULT_RADIUS);
  const [zoneCenter, setZoneCenter] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const mapRef = useRef<MapView>(null);

  // Экран редактирует УЖЕ СУЩЕСТВУЮЩУЮ зону, поэтому обязан сначала её
  // прочитать. Раньше он этого не делал: слайдер всегда вставал на дефолт
  // 150 м, а карта центрировалась на текущем положении вместо сохранённого
  // дома. Открыть экран и нажать «Сохранить», ничего не трогая, было
  // достаточно, чтобы молча подменить и радиус, и центр домашней зоны.
  // Читаем тем же loadHomeZone(), которым пользуется cloaking, — один
  // источник и одна валидация на оба места.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const zone = await loadHomeZone();
      if (cancelled) return;
      if (zone) {
        setRadius(clampStep(zone.radiusM));
        setZoneCenter({ latitude: zone.latitude, longitude: zone.longitude });
      }
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, []);

  // Сохранённый дом важнее текущего положения: экран открывается там, где
  // зона стоит сейчас, а не там, где юзер стоит сию секунду.
  const center = zoneCenter ?? userLocation ?? FLORENTIN;

  // PanResponder-based slider ─────────────────────────────────────────────────
  const sliderBase = useRef(0);
  const sliderStartX = useRef(0);

  // The PanResponder is created once so an in-flight gesture is never torn down
  // mid-drag, which means its handlers keep the *first* render's closure forever.
  // Anything they read that changes over time has to come through a ref that
  // each render refreshes — otherwise every drag would restart from the radius
  // the screen was opened with.
  const radiusRef = useRef(radius);
  useEffect(() => { radiusRef.current = radius; }, [radius]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (_, gs) => {
        sliderStartX.current = gs.x0;
        sliderBase.current = radiusRef.current;
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
      {/* Карта монтируется только после чтения зоны: initialRegion
          неуправляемый, и отрисуйся она раньше — осталась бы на дефолтном
          центре навсегда. */}
      <View style={{ height: MAP_HEIGHT }}>
        {loaded && (
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
        )}

        {/* Back button over map */}
        <TouchableOpacity
          style={[styles.mapBack, { top: insets.top + spacing.md }]}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.mapBackText}>←</Text>
        </TouchableOpacity>

        {/* Full-size overlay — centres both circle and dot on exact map centre.
            Под тем же гейтом, что и карта: круг дефолтного радиуса, мелькнувший
            до чтения зоны, — ровно та дезинформация, против которой этот экран. */}
        {loaded && (
        <View style={styles.centreOverlay} pointerEvents="none">
          {/* Pin wrapper sized to the circle — centred by flex overlay */}
          <View style={{ width: circlePx * 2, height: circlePx * 2, alignItems: 'center', justifyContent: 'center' }}>
            {/* Privacy circle fills the wrapper */}
            <View style={[StyleSheet.absoluteFillObject, styles.privacyCircle, { borderRadius: circlePx }]} />
            {/* Centre dot — centred by flex */}
            <View style={styles.centreDot} />
          </View>
          {/* Бейдж вынесен из обёртки круга. Обёртка шириной ровно в диаметр,
              и на малом радиусе (50 м ≈ 34 px) абсолютный потомок с left:'60%'
              получал ~14 px доступной ширины — «50 м» рассыпалось по букве в
              строку. Теперь позиционируется от центра полноэкранного оверлея,
              где места сколько угодно. */}
          <View
            style={[
              styles.radiusBadge,
              { transform: [{ translateX: Math.min(circlePx + spacing.sm, BADGE_MAX_OFFSET) }] },
            ]}
          >
            <Text style={styles.radiusBadgeText} numberOfLines={1}>
              {t('detail.distance.m', { n: radius })}
            </Text>
          </View>
        </View>
        )}
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
          <Text style={styles.sliderLabel} numberOfLines={1}>
            {t('detail.distance.m', { n: MIN_RADIUS })}
          </Text>
          <Text style={styles.sliderLabel} numberOfLines={1}>
            {t('detail.distance.m', { n: MAX_RADIUS })}
          </Text>
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
    left: '50%',
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
  sliderLabel: { ...typography.xs, color: colors.textMuted, flexShrink: 0 },

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
