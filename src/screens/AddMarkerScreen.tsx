import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Animated,
  Easing,
  Keyboard,
} from 'react-native';
import MapView, { Marker, Circle, PROVIDER_DEFAULT, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../hooks/useApp';
import { supabase } from '../lib/supabase';
import { ensureLocationPermission } from '../lib/locationPermission';
import { LocationRequiredCard } from '../components/LocationRequiredCard';
import { haversine } from '../lib/geo';
import { isAccurateFix, GPS_ACCURACY_MAX_M } from '../lib/gpsQuality';
import { MARKER_CONFIG } from '../lib/markerConfig';
import { colors, radii, shadows } from '../theme/tokens';

// ── Types ─────────────────────────────────────────────────────────────────────
type MarkerType = 'hazard' | 'aggressive_dog' | 'forbidden' | 'danger';

// Icons and the active-chip fill come from MARKER_CONFIG — same visual
// language as the pins on the map.
const MARKER_TYPES: { id: MarkerType; labelKey: string }[] = [
  { id: 'hazard',         labelKey: 'addMarker.type.hazard' },
  { id: 'aggressive_dog', labelKey: 'addMarker.type.aggressiveDog' },
  { id: 'forbidden',      labelKey: 'addMarker.type.noDogs' },
  { id: 'danger',         labelKey: 'addMarker.type.other' },
];

const FLORENTIN = { latitude: 32.0559, longitude: 34.7722 };

// How far the marker may be nudged from the real GPS fix by panning the map.
const ADJUST_RADIUS_M = 150;

// How long we wait for a fix of *any* quality before offering the retry card.
// Once fixes are arriving we keep waiting for an accurate one instead — the
// user can see the accuracy climbing down and knows to step into the open.
const FIRST_FIX_TIMEOUT_MS = 10000;

// Map block: fixed-height rounded map + the adjust hint below it. The whole
// block collapses to 0 while the keyboard is up so chips + comment + submit
// stay visible on one screen.
const MAP_HEIGHT = 180;
const MAP_BLOCK_HEIGHT = MAP_HEIGHT + 32; // + hint line
const COLLAPSE_MS = 250;

interface Props {
  navigation: any;
}

export function AddMarkerScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useApp();

  // coords = the immutable GPS fix (circle centre + clamp anchor).
  // markerCoords = the point actually saved = current map centre, kept within
  // ADJUST_RADIUS_M of the fix. They start equal on a fresh fix.
  const [coords, setCoords] = useState(FLORENTIN);
  const [markerCoords, setMarkerCoords] = useState(FLORENTIN);
  const mapRef = useRef<MapView>(null);
  const isSnapping = useRef(false); // guards the snap-induced onRegionChangeComplete
  // Map-area state machine:
  //   'loading'   → spinner: permission settled, no fix of any quality yet
  //   'searching' → fixes are arriving but none within GPS_ACCURACY_MAX_M
  //   'nofix'     → nothing came back at all in FIRST_FIX_TIMEOUT_MS → retry card
  //   'ready'     → an accurate fix is locked in (or the FLORENTIN fallback when
  //                 permission was denied — the handleAdd guard blocks saving there)
  const [locState, setLocState] = useState<'loading' | 'searching' | 'nofix' | 'ready'>('loading');
  // A marker is a claim about a physical spot, so it may only be published on
  // a fix we actually trust. Everything that writes a coordinate — the adjust
  // circle, the map panning, the submit button — hangs off this flag.
  const [hasAccurateFix, setHasAccurateFix] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [fixAccuracy, setFixAccuracy] = useState<number | null>(null);
  const [locationCardVisible, setLocationCardVisible] = useState(false);

  const [selectedType, setSelectedType] = useState<MarkerType>('hazard');
  const [description, setDescription]   = useState('');
  const [saving, setSaving]             = useState(false);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ── Keyboard ⇄ map collapse ────────────────────────────────────────────────
  // 0 = map visible, 1 = collapsed. Height animates on the JS thread (layout
  // props don't support the native driver) — fine for a rare, short animation.
  const collapse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const run = (toValue: number) =>
      Animated.timing(collapse, {
        toValue,
        duration: COLLAPSE_MS,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }).start();
    const showSub = Keyboard.addListener(showEvt, () => run(1));
    const hideSub = Keyboard.addListener(hideEvt, () => run(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [collapse]);
  const mapBlockHeight = collapse.interpolate({ inputRange: [0, 1], outputRange: [MAP_BLOCK_HEIGHT, 0] });
  const mapBlockOpacity = collapse.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

  // ── Get current location ──────────────────────────────────────────────────
  // A marker is always the author's real physical position, so a one-shot fix
  // isn't enough: we watch at BestForNavigation until a fix lands inside
  // GPS_ACCURACY_MAX_M, then lock the anchor and stop. Until that happens the
  // screen sits in 'searching' with the submit button disabled — publishing a
  // ±60 m marker puts a hazard on the wrong street. coords stays at the
  // FLORENTIN fallback if permission is denied — used only for the preview,
  // never for a saved marker (see the hasAccurateFix guard in handleAdd).
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const firstFixTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockedRef = useRef(false); // an accurate fix arrived; anchor is final

  const stopWatching = useCallback(() => {
    watchRef.current?.remove();
    watchRef.current = null;
    if (firstFixTimer.current) {
      clearTimeout(firstFixTimer.current);
      firstFixTimer.current = null;
    }
  }, []);

  const fetchLocation = useCallback(async () => {
    stopWatching();
    lockedRef.current = false;
    setLocState('loading');
    setHasAccurateFix(false);
    setFixAccuracy(null);
    const { granted } = await ensureLocationPermission();
    if (!mountedRef.current) return;
    if (!granted) {
      setPermissionGranted(false);
      setLocationCardVisible(true);
      setLocState('ready'); // permission-denied path unchanged: fallback map + card
      return;
    }
    setPermissionGranted(true);
    try {
      const sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 0 },
        (loc) => {
          if (!mountedRef.current || lockedRef.current) return;
          const acc = loc.coords.accuracy ?? null;
          setFixAccuracy(acc);
          if (!isAccurateFix(acc)) {
            // Something is coming back, it just isn't good enough to pin a
            // marker on. Keep watching and show what we're waiting for.
            setLocState('searching');
            return;
          }
          // Locked on. The anchor stops moving here so the adjust circle
          // doesn't crawl out from under the user's finger while they aim.
          lockedRef.current = true;
          const fix = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
          setCoords(fix);
          setMarkerCoords(fix); // marker starts exactly on the fix, adjustable from there
          setHasAccurateFix(true);
          setLocState('ready');
          stopWatching();
        }
      );
      // The first callback can land before this await resolves — then the
      // watcher is already meant to be gone.
      if (!mountedRef.current || lockedRef.current) {
        sub.remove();
        return;
      }
      watchRef.current = sub;
      // Silence for the whole window → the retry card, as before. Once fixes
      // are flowing ('searching') we stay put and let the user decide.
      firstFixTimer.current = setTimeout(() => {
        if (!mountedRef.current) return;
        setLocState((prev) => (prev === 'loading' ? 'nofix' : prev));
      }, FIRST_FIX_TIMEOUT_MS);
    } catch (_) {
      if (!mountedRef.current) return;
      setLocState('nofix'); // reject no longer swallowed
    }
  }, [stopWatching]);

  useEffect(() => {
    fetchLocation();
  }, [fetchLocation]);

  useEffect(() => stopWatching, [stopWatching]);

  // ── Keep the marker (map centre) within ADJUST_RADIUS_M of the fix ──────────
  // Pin and saved point always coincide: if the centre drifts past the radius
  // we snap the map back to the nearest edge point rather than silently
  // clamping only the stored coords.
  function handleRegionChangeComplete(r: Region) {
    if (!hasAccurateFix) return; // no trusted anchor yet → nothing to adjust around
    if (isSnapping.current) {
      isSnapping.current = false; // ignore the callback our own snap triggered
      return;
    }
    const center = { latitude: r.latitude, longitude: r.longitude };
    const distM = haversine(coords, center) * 1000;
    if (distM <= ADJUST_RADIUS_M) {
      setMarkerCoords(center);
      return;
    }
    // Project the centre onto the circle edge (linear interp is exact enough at
    // 150m scale) and animate the map there — a soft snap.
    const ratio = ADJUST_RADIUS_M / distM;
    const snapped = {
      latitude: coords.latitude + (center.latitude - coords.latitude) * ratio,
      longitude: coords.longitude + (center.longitude - coords.longitude) * ratio,
    };
    setMarkerCoords(snapped);
    isSnapping.current = true;
    mapRef.current?.animateToRegion(
      { ...snapped, latitudeDelta: r.latitudeDelta, longitudeDelta: r.longitudeDelta },
      250,
    );
  }

  // ── Save to Supabase ───────────────────────────────────────────────────────
  async function handleAdd() {
    if (saving || !hasAccurateFix) return; // never save on a fallback or a loose fix
    // Second line of defence: the saved point must be within the adjust radius
    // of the fix. Shouldn't trip while the snap works, but the guard stays
    // (small epsilon absorbs float/interp rounding on the boundary).
    if (haversine(coords, markerCoords) * 1000 > ADJUST_RADIUS_M + 5) {
      Alert.alert(t('common.save_error'));
      return;
    }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { error } = await supabase.from('markers').insert({
        type:       selectedType,
        description: description.trim() || null,
        lat:        markerCoords.latitude,
        lng:        markerCoords.longitude,
        user_id:    session?.user?.id ?? null,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
      if (error) throw error;
      navigation.goBack();
    } catch (_) {
      // Keep the screen open so the typed description isn't lost.
      Alert.alert(t('common.save_error'));
    } finally {
      setSaving(false);
    }
  }

  const region = { ...coords, latitudeDelta: 0.004, longitudeDelta: 0.004 };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        >
          <Text style={styles.backTxt}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('addMarker.title')}</Text>
        {/* phantom spacer to center title */}
        <View style={styles.backBtn} />
      </View>

      {/* ── Map block: rounded map + adjust hint, collapses under keyboard ── */}
      <Animated.View style={{ height: mapBlockHeight, opacity: mapBlockOpacity, overflow: 'hidden' }}>
      <View style={styles.mapContainer}>
        {locState === 'loading' ? (
          <View style={styles.mapLoading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : locState === 'searching' ? (
          <View style={styles.noFixCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.noFixTitle}>{t('gps.searching.title')}</Text>
            <Text style={styles.noFixBody}>
              {t('gps.searching.body', { m: GPS_ACCURACY_MAX_M })}
            </Text>
            {fixAccuracy != null && (
              <Text style={styles.gpsAccuracy}>
                {t('gps.searching.accuracy', { n: Math.round(fixAccuracy) })}
              </Text>
            )}
          </View>
        ) : locState === 'nofix' ? (
          <View style={styles.noFixCard}>
            <Text style={styles.noFixEmoji}>📡</Text>
            <Text style={styles.noFixTitle}>{t('location.no_fix.title')}</Text>
            <Text style={styles.noFixBody}>{t('location.no_fix.body')}</Text>
            <TouchableOpacity style={styles.noFixBtn} onPress={fetchLocation} activeOpacity={0.85}>
              <Text style={styles.noFixBtnTxt}>{t('location.no_fix.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <MapView
              ref={mapRef}
              style={StyleSheet.absoluteFill}
              provider={PROVIDER_DEFAULT}
              initialRegion={region}
              scrollEnabled={hasAccurateFix}
              zoomEnabled={hasAccurateFix}
              minZoomLevel={15}
              pitchEnabled={false}
              rotateEnabled={false}
              showsCompass={false}
              toolbarEnabled={false}
              onRegionChangeComplete={handleRegionChangeComplete}
            >
              {hasAccurateFix ? (
                <Circle
                  center={coords}
                  radius={ADJUST_RADIUS_M}
                  strokeColor={colors.primary}
                  strokeWidth={1.5}
                  fillColor="rgba(44,95,37,0.12)"
                />
              ) : (
                <Marker coordinate={coords} pinColor="#ef4444" />
              )}
            </MapView>
            {/* Fixed centre pin — the marker point is always the map centre */}
            {hasAccurateFix && (
              <View style={styles.centerPinOverlay} pointerEvents="none">
                <View style={styles.centerPin} />
              </View>
            )}
          </>
        )}
      </View>

      {/* ── Adjust hint — own line under the map, fully visible ── */}
      {locState === 'ready' && hasAccurateFix && (
        <Text style={styles.adjustHint}>{t('marker.adjust_hint')}</Text>
      )}
      </Animated.View>

      {/* ── Form — no vertical scroll: everything fits on one screen ── */}
      <View style={styles.form}>
        {/* Type chips — horizontal row, icons/colors from MARKER_CONFIG */}
        <Text style={styles.sectionLabel}>{t('addMarker.typeLabel')}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.typeRowScroll}
          contentContainerStyle={styles.typeRow}
          keyboardShouldPersistTaps="handled"
        >
          {MARKER_TYPES.map((mt) => {
            const cfg = MARKER_CONFIG[mt.id];
            const selected = selectedType === mt.id;
            return (
              <TouchableOpacity
                key={mt.id}
                style={[
                  styles.typeChip,
                  selected
                    ? { backgroundColor: cfg.pinColor, borderColor: cfg.pinColor }
                    : styles.typeChipIdle,
                ]}
                onPress={() => setSelectedType(mt.id)}
                activeOpacity={0.75}
              >
                <Text style={styles.typeChipEmoji}>{cfg.emoji}</Text>
                <Text style={[styles.typeChipTxt, selected && styles.typeChipTxtActive]}>
                  {t(mt.labelKey)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Comment */}
        <Text style={styles.sectionLabel}>{t('addMarker.commentLabel')}</Text>
        <TextInput
          style={styles.commentInput}
          placeholder={t('addMarker.commentPlaceholder')}
          placeholderTextColor={colors.textSoft}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
          maxLength={500}
          textAlignVertical="top"
        />
      </View>

      {/* Pushes the submit button to the bottom */}
      <View style={styles.spacer} />

      {/* ── Add button — pinned to bottom ── */}
      <View style={[styles.addBtnContainer, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={[styles.addBtn, shadows.md, (saving || !hasAccurateFix) && styles.addBtnDisabled]}
          onPress={handleAdd}
          activeOpacity={0.85}
          disabled={saving || !hasAccurateFix}
        >
          {saving ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            // Disabled is never silent: the label says whether we're waiting
            // on permission or on a fix good enough to pin a marker on.
            <Text style={styles.addBtnTxt}>
              {!permissionGranted
                ? t('location.no_fix.waiting')
                : !hasAccurateFix
                  ? t('gps.searching.title')
                  : t('addMarker.submit')}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {locationCardVisible && (
        <LocationRequiredCard onDismiss={() => setLocationCardVisible(false)} />
      )}
    </KeyboardAvoidingView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 10,
    backgroundColor: colors.white,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backTxt: { fontSize: 26, color: colors.ink, lineHeight: 30, marginTop: -2 },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.3,
  },

  // Map — fixed height, card-style rounding
  mapContainer: {
    height: MAP_HEIGHT,
    marginHorizontal: 16,
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: colors.card,
  },
  mapLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noFixCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 6,
  },
  noFixEmoji: { fontSize: 30 },
  noFixTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink,
    textAlign: 'center',
  },
  noFixBody: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    textAlign: 'center',
  },
  // Live accuracy readout under the "searching" copy — turns an opaque wait
  // into something the walker can act on by stepping into the open.
  gpsAccuracy: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'center',
    marginTop: 2,
  },
  noFixBtn: {
    marginTop: 8,
    minHeight: 44,
    paddingHorizontal: 20,
    borderRadius: radii.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noFixBtnTxt: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },
  centerPinOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerPin: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ef4444',
    borderWidth: 3,
    borderColor: colors.white,
    ...shadows.sm,
  },
  adjustHint: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
  },

  // Form — plain block, no vertical scroll
  form: {
    paddingTop: 14,
    paddingHorizontal: 16,
    gap: 10,
  },
  spacer: { flex: 1 },

  // Section label
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 8,
  },

  // Type chips — horizontal row, ≥48pt touch targets
  typeRowScroll: { flexGrow: 0, marginHorizontal: -16 },
  typeRow: {
    paddingHorizontal: 16,
    gap: 8,
  },
  typeChip: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: radii.full,
    borderWidth: 1.5,
  },
  typeChipIdle: {
    backgroundColor: colors.card,
    borderColor: colors.border,
  },
  // includeFontPadding — Android: kill baseline padding that sinks emoji
  typeChipEmoji: { fontSize: 18, lineHeight: 20, textAlign: 'center', includeFontPadding: false },
  typeChipTxt: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  typeChipTxtActive: {
    color: colors.white,
  },

  // Comment
  commentInput: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.ink,
    minHeight: 80,
    ...shadows.sm,
  },

  // Add button — pinned to bottom
  addBtnContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  addBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: 18,
    alignItems: 'center',
  },
  addBtnDisabled: { opacity: 0.6 },
  addBtnTxt: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.white,
    letterSpacing: -0.3,
  },
});
