import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  Alert,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import MapView, { PROVIDER_DEFAULT, Polyline, MarkerAnimated, MapPressEvent } from 'react-native-maps';
import * as Location from 'expo-location';
import { Pedometer } from 'expo-sensors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, SlidersHorizontal, MapPinPlusInside } from 'lucide-react-native';
import { useApp } from '../hooks/useApp';
import { colors, radii, shadows, heatVis } from '../theme/tokens';
import { haversine, LatLng, isValidCoord, START_COORD, START_DELTA } from '../lib/geo';
import { loadHomeZone, isInsideHomeZone, HomeZone } from '../lib/privacyZone';
import { useMapMarkers } from '../hooks/useMapMarkers';
import { useNearbyDogs } from '../hooks/useNearbyDogs';
import { useHeading } from '../hooks/useHeading';
import { useSmoothedPosition, MOVE_MS } from '../hooks/useSmoothedPosition';
import { useCalloutAnchor } from '../hooks/useCalloutAnchor';
import { isAccurateFix, createGlitchFilter } from '../lib/gpsQuality';
import { filterMarkersAndWater } from '../lib/markerFilter';
import { MARKER_CONFIG, INFRA_MARKER_TYPES, nextInfraHidden } from '../lib/markerConfig';
import { MarkerFilterSheet, RadiusFilter } from '../components/MarkerFilterSheet';
import { MarkerCallout } from '../components/MarkerCallout';
import { FriendCallout } from '../components/FriendCallout';
import { FriendWalkerMarker, FRIEND_PIN_HIDE_MS } from '../components/FriendWalkerMarker';
import { UserLocationMarker } from '../components/UserLocationMarker';
import { MapMarkerIcon } from '../components/MapMarkerIcon';
import { FirstWalkTipCard } from '../components/FirstWalkTipCard';
import { LocateButton } from '../components/LocateButton';
import NearbyDogsSheet from '../components/NearbyDogsSheet';
import { ShareProfileSheet } from '../components/ShareProfileSheet';
import { MapDebugOverlay } from '../components/MapDebugOverlay';
import { mapAttributionInsets, MapAttributionInsets } from '../lib/mapInsets';
import { MAP_CAMERA_ZOOM_RANGE } from '../lib/mapConfig';
import { useFriends } from '../hooks/useFriends';
import { sendFriendRequest } from '../lib/friendships';
import { supabase } from '../lib/supabase';
import { Visibility } from './SettingsScreen';
import { checkAndAwardBadges } from '../lib/badges';
import { saveWalkHistory, toWalkPath, getPreviousBestDistanceKm } from '../lib/walkHistory';
import { subscribeWalkLocations, startWalkTracking, stopWalkTracking } from '../lib/walkTracking';

// Старт — общий START_COORD (Бат-Ям, см. lib/geo). Во время прогулки камера
// прыгает на пользователя первым же фиксом, так что этот регион виден лишь миг.
const INITIAL_REGION = { ...START_COORD, latitudeDelta: START_DELTA, longitudeDelta: START_DELTA };
const ACTIVE_WALK_PING_MS = 60000;
// WalkScreen bottom-panel height ABOVE the safe-area inset (measured from the
// styles: paddingTop 16 + stats ~46 + gap 10 + nearby row 48 + gap 10 + finish
// ~59 + paddingBottom-non-safe 8 ≈ 198). The guest banner is intentionally NOT
// included — when it shows, the panel is taller and the logo just sits a bit
// higher above the chip, which is fine.
// Used ONLY for the constant map attribution (mapPadding / Apple logo+Legal),
// which must stay static — never from onLayout: the logo/Legal are native map
// ornaments and MapKit re-lays them out under a moving camera (AIRMap.m). The
// chip ROW, by contrast, is an RN element and is pinned to the panel's REAL
// measured height (panelHeight + WALK_CHIP_GAP) so it can't drift off the panel.
const WALK_PANEL_CONTENT = 198;
const WALK_CHIP_GAP = 12; // gap between the panel's top edge and the chip row
const HEAT_CHIP_HEIGHT = 54; // fixed heatCard height (matches styles.heatCard)
const MIN_VALID_DISTANCE_KM = 0.3;
const MIN_VALID_DURATION_SEC = 300;

interface Props {
  navigation: any;
}

export function WalkScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const {
    t, rtl, heatData, isHeatLoading, isGuest, confirmedCount,
    radius, setRadius, activeCategories, toggleCategory, userLocation, setUserLocation,
  } = useApp();
  const heatVis_ = heatVis[heatData.status];

  // Real panel height, measured via onLayout — drives the chip row's bottom so
  // it always sits WALK_CHIP_GAP above the actual panel (incl. guest banner).
  // Init from the constant estimate so the first frame is already close.
  const [panelHeight, setPanelHeight] = useState(WALK_PANEL_CONTENT + insets.bottom);

  // Apple logo / Legal: measured from the REAL chip so the ornaments hug its
  // top edge (see mapAttributionInsets). measureInWindow gives screen-space
  // top/left; we re-measure whenever the chip row can move (its onLayout, below —
  // fires at mount and whenever panelHeight shifts the row). State updates only
  // when the chip actually moved, so the native map isn't re-inset on unrelated
  // renders — and we measure the CHIP, never the panel, which is what used to
  // make the ornaments jitter. Fallback (below) is the old estimate, shown only
  // until the first measurement lands.
  const screenH = Dimensions.get('window').height;
  const heatChipRef = useRef<any>(null);
  const [walkMapAttribution, setWalkMapAttribution] = useState<MapAttributionInsets>(() => ({
    // Fallback (first frame only). chip top-from-bottom = panel + gap + chip
    // height; the safe-area subtraction cancels the +insets.bottom in the panel.
    top: 0,
    right: 0,
    bottom: WALK_PANEL_CONTENT + WALK_CHIP_GAP + HEAT_CHIP_HEIGHT + 4 - 8,
    left: 14 - 4,
  }));
  const measureHeatChip = useCallback(() => {
    heatChipRef.current?.measureInWindow((x: number, y: number, w: number) => {
      if (!w) return;
      const fallback = {
        left: 14 - 4,
        bottom: WALK_PANEL_CONTENT + WALK_CHIP_GAP + HEAT_CHIP_HEIGHT + 4 - 8,
      };
      const next = mapAttributionInsets({ top: y, left: x }, screenH, insets.bottom, fallback);
      setWalkMapAttribution((prev) =>
        prev.bottom === next.bottom && prev.left === next.left ? prev : next,
      );
    });
  }, [screenH, insets.bottom]);

  // ── Markers + water sources (same shared data as MapScreen) ────────────
  const { markers, waterSources } = useMapMarkers();
  const { dogs: nearbyDogs, hiddenCount: nearbyHiddenCount, locationAvailable: nearbyLocationAvailable } = useNearbyDogs(userLocation);
  const nearbyTotal = nearbyDogs.length + nearbyHiddenCount;
  const { statusByUser: friendStatusByUser, refresh: refreshFriends } = useFriends();
  const [nearbySheetVisible, setNearbySheetVisible] = useState(false);
  const [sendingFriendId, setSendingFriendId] = useState<string | null>(null);
  const [shareVisible, setShareVisible] = useState(false);

  async function handleAddNearbyFriend(userId: string) {
    if (sendingFriendId) return;
    setSendingFriendId(userId);
    const error = await sendFriendRequest(userId);
    if (error) console.warn('[WalkScreen] send friend request error:', error);
    await refreshFriends();
    setSendingFriendId(null);
  }

  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [detailMarker, setDetailMarker] = useState<import('../lib/markerConfig').MapMarker | null>(null);
  // Finish is a one-way action (saves the walk, awards badges, then replaces
  // the screen). The ref is the hard guard against a double-tap firing two
  // saves; the state just greys the button out.
  const finishingRef = useRef(false);
  const [finishing, setFinishing] = useState(false);
  // Screen position of the open marker's pin — the callout is placed on it.
  const mapRef = useRef<MapView | null>(null);
  const { point: calloutAnchor, refresh: refreshCalloutAnchor } = useCalloutAnchor(
    mapRef,
    detailMarker ? { latitude: detailMarker.lat, longitude: detailMarker.lng } : null
  );

  // Walking friends → pins (same rules as MapScreen: accepted friends, fresh,
  // valid coords). See friendWalkers/FriendWalkerMarker.
  const friendWalkers = useMemo(() => {
    const now = Date.now();
    return nearbyDogs
      .filter((d) => friendStatusByUser[d.userId] === 'friends')
      .map((d) => ({ ...d, ageMs: now - d.updatedAt }))
      .filter((d) => d.ageMs <= FRIEND_PIN_HIDE_MS && isValidCoord({ latitude: d.lat, longitude: d.lng }));
  }, [nearbyDogs, friendStatusByUser]);

  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const selectedFriend = selectedFriendId
    ? friendWalkers.find((w) => w.userId === selectedFriendId) ?? null
    : null;
  const { point: friendAnchor, refresh: refreshFriendAnchor } = useCalloutAnchor(
    mapRef,
    selectedFriend ? { latitude: selectedFriend.lat, longitude: selectedFriend.lng } : null
  );

  function handleWalkNearbyCardPress(userId: string) {
    const w = friendWalkers.find((x) => x.userId === userId);
    if (!w) return;
    setNearbySheetVisible(false);
    const center = { latitude: w.lat, longitude: w.lng };
    if (isValidCoord(center)) mapRef.current?.animateCamera({ center }, { duration: 350 });
  }

  function handleMapPress(e: MapPressEvent) {
    // Android delivers a marker tap through the map's onPress as well. That
    // gesture is what opened the callout — it must not close it again.
    if (e.nativeEvent.action === 'marker-press') return;
    setDetailMarker(null);
    setSelectedFriendId(null);
  }
  const hiddenCount = Object.values(activeCategories).filter((v) => !v).length;
  // Memoised so a re-render that doesn't move the walker (e.g. the 1s timer
  // tick) doesn't re-run the haversine filter over every marker.
  const { filteredMarkers, filteredWaterSources } = useMemo(
    () => filterMarkersAndWater(markers, waterSources, radius, activeCategories, userLocation),
    [markers, waterSources, radius, activeCategories, userLocation],
  );

  // Zoom gate: сильно отдалили → инфраструктуру (water/park/dog_park + точки
  // воды) НЕ монтируем вовсе — перф-мера от лага при панорамировании на широком
  // зуме (см. MapScreen). Ремоунт безопасен: «океан» был из-за нестабильного
  // initialRegion, уже исправлено. Состояние — по гистерезису.
  const [infraHidden, setInfraHidden] = useState(false);
  const markersToRender = useMemo(
    () => (infraHidden ? filteredMarkers.filter((m) => !INFRA_MARKER_TYPES.includes(m.type)) : filteredMarkers),
    [filteredMarkers, infraHidden],
  );
  const waterToRender = infraHidden ? [] : filteredWaterSources;

  // Radius change — no extra location request here: the GPS watcher below
  // (already running for route tracking) keeps userLocation fresh in context.
  function handleRadiusChange(next: RadiusFilter) {
    setRadius(next);
  }

  // ── Timer ──────────────────────────────────────────────────────────────
  const [seconds, setSeconds] = useState(0);
  // The timer only runs once location tracking has actually started — if GPS
  // permission or the background task fails, the GPS effect below alerts and
  // leaves this false, so the clock never ticks on a walk that isn't recording.
  const [trackingStarted, setTrackingStarted] = useState(false);
  const walkStartedAtMs = useRef(Date.now()).current;
  const walkStartedAt = useMemo(() => new Date(walkStartedAtMs).toISOString(), [walkStartedAtMs]);
  // Derived from the wall clock, not counted tick by tick: a tick counter
  // loses every second the JS thread is suspended (app in background), and
  // the duration feeds the validity bar and walk_history.
  useEffect(() => {
    if (!trackingStarted) return; // no live tracking → no timer
    const tick = () => setSeconds(Math.floor((Date.now() - walkStartedAtMs) / 1000));
    const id = setInterval(tick, 1000);
    // Coming back to the foreground: catch up now, not on the next tick.
    const appStateSub = AppState.addEventListener('change', (s) => {
      if (s === 'active') tick();
    });
    return () => {
      clearInterval(id);
      appStateSub.remove();
    };
  }, [walkStartedAtMs, trackingStarted]);
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
  // The marker slides to each new fix instead of teleporting there.
  const { coord: userCoord, hasFix: hasUserFix, moveTo: moveUserMarker } = useSmoothedPosition();
  // The map follows the walker by gliding the camera alongside the marker
  // slide. It used to be a controlled `region` re-set on every fix, which
  // MapKit applies without animation: the whole map jumped each fix while the
  // marker was still sliding, and any pinch-zoom was undone by the next fix.
  const cameraHasFix = useRef(false);
  // Готовность карты = onMapReady И onLayout с ненулевым размером. Ref (не state):
  // followWith зовётся из замыкания GPS-подписки, а ref читается всегда свежим —
  // иначе гейт застрял бы на false. Follow непрерывный, поэтому «отложенного»
  // one-shot не нужно: пропущенный до готовности фикс догонит следующий (и он же
  // будет первым реальным центрированием — cameraHasFix ещё false → duration 0).
  const mapReadyFiredRef = useRef(false);
  const mapLaidOutRef = useRef(false);
  const mapReadyRef = useRef(false);
  function markMapReadyIfDone() {
    if (mapReadyFiredRef.current && mapLaidOutRef.current) mapReadyRef.current = true;
  }
  // Follow mode: the camera tracks the walker until they pan the map by hand,
  // then it lets go until they tap the locate button to re-centre. The button
  // is always visible and looks identical to MapScreen's, so no render state is
  // needed — a ref is enough for the fix handler's closure.
  const followUserRef = useRef(true);
  function setFollow(next: boolean) {
    followUserRef.current = next;
  }
  function followWith(pt: LatLng) {
    // Hand panned away → don't yank the camera back on the next fix.
    if (!followUserRef.current) return;
    // Карта не готова → пропускаем (cameraHasFix не трогаем, чтобы первый
    // реальный фикс после готовности всё ещё «прыгнул» без пролёта).
    if (!mapReadyRef.current) return;
    // First fix jumps straight there — gliding from the default centre would
    // fly across the city.
    const duration = cameraHasFix.current ? MOVE_MS : 0;
    if (!isValidCoord(pt)) return; // битая координата увезла бы камеру в 0,0
    cameraHasFix.current = true;
    mapRef.current?.animateCamera({ center: pt }, { duration });
  }
  // Locate button: re-centre on the last fix and resume following.
  function handleCenterOnMe() {
    setFollow(true);
    if (!mapReadyRef.current) return; // карта не готова — тап игнорируем
    const pt = latestPos.current;
    if (isValidCoord(pt)) mapRef.current?.animateCamera({ center: pt }, { duration: 350 });
  }
  const [accuracy, setAccuracy] = useState<number | undefined>(undefined);
  // Second gate, after accuracy: a fix that reports good accuracy but lands
  // somewhere unreachable is held back, and only recorded if the next fix
  // confirms it. Holds this stream's reference position.
  const glitchFilter = useRef(createGlitchFilter<Location.LocationObjectCoords>()).current;
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
  // Зеркало activeWalkRowExists в state для бейджа: показывает, публикуется ли
  // позиция ПРЯМО СЕЙЧАС. Читает ТО ЖЕ решение (см. syncActiveWalkRow), а не
  // считает геометрию зоны заново. Обновляется только там, где меняется сам
  // activeWalkRowExists (создание/удаление строки active_walks).
  const [isPublishing, setIsPublishing] = useState(false);
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
    if (!error) {
      activeWalkRowExists.current = true;
      setIsPublishing(true);
    }
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
    setIsPublishing(false);
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
    if (finishingRef.current) return; // double-tap: the first tap owns the save
    finishingRef.current = true;
    setFinishing(true);
    stopActiveWalkRow();
    // The walk is over from this tap on — no fix may extend the route or the
    // distance while the save below is in flight.
    stopWalkTracking();

    const isValidWalk = distanceKm >= MIN_VALID_DISTANCE_KM && seconds >= MIN_VALID_DURATION_SEC;
    let newBadgeIds: string[] = [];
    let isPersonalBest = false;

    // Температурный статус фиксируем ЗДЕСЬ, в момент завершения. heatData
    // приходит из единственного useAsphaltTemp через getEffectiveAsphaltTemp
    // (lib/heat.ts), то есть уже с учётом dev-оверрайда. Экран итогов получает
    // готовое значение и не перечитывает погоду: остывший к тому времени
    // асфальт не должен задним числом отменять вердикт про жару.
    const heatStatusAtFinish = heatData.status;

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
        // Строго до вставки текущей прогулки — иначе она побьёт сама себя.
        const prevBest = await getPreviousBestDistanceKm(userId);
        isPersonalBest = prevBest.ok
          ? prevBest.bestKm == null || distanceKm > prevBest.bestKm
          : false;

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
      isPersonalBest,
      heatStatusAtFinish,
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

  // Route tracking runs through walkTracking, which keeps recording with the
  // app in the background. Fixes arrive in batches (several at once after a
  // stretch in the background), each carrying its own timestamp — handled in
  // order, exactly as if they had come one by one.
  useEffect(() => {
    let cancelled = false;
    const unsubscribe = subscribeWalkLocations((locations) => {
      for (const loc of locations) handleFix(loc);
    });
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (status !== 'granted') {
        Alert.alert(t('walk.geoError')); // permission denied → no tracking, no timer
        return;
      }
      setLocationGranted(true);
      try {
        await startWalkTracking();
      } catch (e) {
        console.warn('[WalkScreen] startWalkTracking failed:', e);
        if (!cancelled) Alert.alert(t('walk.geoError')); // task failed → no timer
        return;
      }
      // Left the screen while the start was in flight — the cleanup's stop ran
      // before there was anything to stop.
      if (cancelled) {
        stopWalkTracking();
        return;
      }
      setTrackingStarted(true); // tracking is live → the timer may run
    })();
    return () => {
      cancelled = true;
      unsubscribe();
      stopWalkTracking();
    };

    function handleFix(loc: Location.LocationObject) {
      // Everything below this line — marker, recorded track, distance,
      // the published presence row — is fed only by fixes that pass the
      // accuracy gate and then the plausibility gate. A bad fix used to
      // add tens of metres of phantom distance to the walk and drag the
      // route line with it; the reflection glitches that lie about their
      // accuracy did the same until the second gate went in.
      if (!isAccurateFix(loc.coords.accuracy)) return;
      for (const coords of glitchFilter.accept(loc.coords, loc.timestamp)) {
        const pt = { latitude: coords.latitude, longitude: coords.longitude };
        moveUserMarker(pt);
        reportGpsFix(coords);
        setAccuracy(coords.accuracy ?? undefined);
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
        followWith(pt);
        setUserLocation(pt);

        latestPos.current = pt;
        if (!activeWalkStartAttempted.current) {
          activeWalkStartAttempted.current = true;
          startActiveWalkRow(pt);
        }
      }
    }
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
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          provider={PROVIDER_DEFAULT}
          initialRegion={INITIAL_REGION}
          cameraZoomRange={MAP_CAMERA_ZOOM_RANGE}
          showsMyLocationButton={false}
          showsCompass={false}
          toolbarEnabled={false}
          // Apple logo + Legal: positioned by MapKit via layoutMargins
          // (mapPadding) alone — both ornaments on one line directly above the
          // chip, left-aligned and hugging it.
          // legalLabelInsets is deliberately NOT set: AIRMap
          // re-applies it async inside layoutSubviews (AIRMap.m), so during
          // follow-mode's per-second animateCamera the label ping-ponged between
          // MapKit's layoutMargins spot and AIRMap's insets spot (~1px, 1 Hz).
          // One mechanism = no flicker. Full-screen map keeps mapPadding stable
          // and recenters animateCamera (followWith) within the visible area.
          mapPadding={walkMapAttribution}
          onMapReady={() => {
            mapReadyFiredRef.current = true;
            markMapReadyIfDone();
          }}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            if (width > 0 && height > 0) mapLaidOutRef.current = true;
            markMapReadyIfDone();
          }}
          onPress={handleMapPress}
          // A hand pan (details.isGesture) drops follow mode. Programmatic
          // camera moves (followWith → animateCamera) report isGesture=false, so
          // they can't fight the camera they just moved. onPanDrag isn't used:
          // it never fires on the iOS Apple-Maps provider (PROVIDER_DEFAULT).
          onRegionChange={(_region, details) => {
            if ((details as any)?.isGesture && followUserRef.current) setFollow(false);
            // During the gesture the anchor is recomputed as fast as the bridge
            // keeps up; the Complete event guarantees a final exact placement.
            refreshCalloutAnchor();
            refreshFriendAnchor();
          }}
          onRegionChangeComplete={(region) => {
            setInfraHidden((prev) => nextInfraHidden(prev, region?.latitudeDelta));
            refreshCalloutAnchor();
            refreshFriendAnchor();
          }}
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

          {markersToRender.map((m) => (
            <MapMarkerIcon
              key={m.id}
              coordinate={{ latitude: m.lat, longitude: m.lng }}
              emoji={MARKER_CONFIG[m.type]?.emoji ?? '📍'}
              color={MARKER_CONFIG[m.type]?.pinColor ?? '#6b7280'}
              onPress={() => { setSelectedFriendId(null); setDetailMarker(m); }}
            />
          ))}

          {waterToRender.map((w) => (
            <MapMarkerIcon
              key={`water-${w.id}`}
              coordinate={{ latitude: w.lat, longitude: w.lng }}
              emoji={MARKER_CONFIG.water.emoji}
              color={MARKER_CONFIG.water.pinColor}
              title={MARKER_CONFIG.water.emoji}
              description={w.amenity ?? undefined}
            />
          ))}

          {friendWalkers.map((w) => (
            <FriendWalkerMarker
              key={`friend-${w.userId}`}
              coordinate={{ latitude: w.lat, longitude: w.lng }}
              avatar={w.avatar}
              ageMs={w.ageMs}
              onPress={() => { setDetailMarker(null); setSelectedFriendId(w.userId); }}
            />
          ))}
        </MapView>

        {/* ── LIVE chip — top center ── */}
        <View style={[styles.liveChip, { top: insets.top + 12 }]}>
          <View style={[styles.liveDot, !isPublishing && styles.hiddenDot]} />
          <Text style={[styles.liveTxt, !isPublishing && styles.hiddenTxt]}>
            {isPublishing ? t('map.live') : t('map.hidden')}
          </Text>
        </View>

        {/* ── Filter — top right group ── */}
        <TouchableOpacity
          onPress={() => { setDetailMarker(null); setSelectedFriendId(null); setFilterSheetOpen(true); }}
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
          onPress={() => { setDetailMarker(null); setSelectedFriendId(null); navigation.navigate('Alerts'); }}
          style={[styles.iconBtn, shadows.sm, { position: 'absolute', zIndex: 30, top: insets.top + 8, right: 14 }]}
          activeOpacity={0.8}
          hitSlop={{ top: 4, right: 4, bottom: 4, left: 4 }}
        >
          <Bell size={20} color={colors.ink} />
        </TouchableOpacity>

        {/* Inside mapContainer on purpose: pointForCoordinate answers in the
            map view's own coordinate space, which this full-screen container
            shares. Restructure keeps the map full-screen so the callout tail's
            anchor math is unchanged. */}
        <MarkerCallout
          marker={detailMarker}
          anchor={calloutAnchor}
          onClose={() => setDetailMarker(null)}
        />

        <FriendCallout
          friend={selectedFriend
            ? { dogName: selectedFriend.dogName, ownerName: selectedFriend.ownerName, updatedAt: selectedFriend.updatedAt }
            : null}
          anchor={friendAnchor}
          topInset={insets.top}
          t={t}
          rtl={rtl}
          onClose={() => setSelectedFriendId(null)}
        />
      </View>

      {/* ── Bottom sheet (natural height, always visible) ── */}
      <View
        style={[styles.bottomSheet, { paddingBottom: insets.bottom + 8 }]}
        onLayout={(e) => setPanelHeight(e.nativeEvent.layout.height)}
      >

        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatCol label={t('walk.active.duration')} value={timeStr} />
          <View style={styles.statDivider} />
          <StatCol label={t('walk.active.steps')} value={String(steps)} />
          <View style={styles.statDivider} />
          <StatCol label={t('walk.active.km')} value={distanceKm.toFixed(2)} />
        </View>

        {/* Walkers nearby — opens the same NearbyDogsSheet as MapScreen */}
        <TouchableOpacity style={styles.nearbyRow} activeOpacity={0.7} onPress={() => { setDetailMarker(null); setSelectedFriendId(null); setNearbySheetVisible(true); }}>
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
          style={[styles.finishBtn, shadows.sm, finishing && { opacity: 0.6 }]}
          onPress={handleFinish}
          activeOpacity={0.85}
          disabled={finishing}
        >
          <Text style={styles.finishTxt}>{t('walk.active.finish')}</Text>
        </TouchableOpacity>
      </View>

      {/* ── On-map bottom controls (heat chip + locate/FAB) — absolute above the
          panel. Sibling of the panel (not the full-screen map) so its zIndex can
          sit above it; bottom tracks the panel's REAL measured height
          (panelHeight + WALK_CHIP_GAP), so the chip never drifts onto the panel
          regardless of the constant's accuracy or the guest banner. ── */}
      <View
        style={[styles.mapBottomRow, { bottom: panelHeight + WALK_CHIP_GAP }]}
        onLayout={measureHeatChip}
        pointerEvents="box-none"
      >
        {/* Chip always rendered; plate keeps a constant height across
            loading / no-data / data states. */}
        <TouchableOpacity
          ref={heatChipRef}
          style={[styles.heatCard, shadows.sm]}
          onPress={() => navigation.navigate('PavementTemp')}
          activeOpacity={0.8}
        >
          {isHeatLoading ? (
            <>
              <Text style={[styles.heatTemp, { color: heatVis_.color }]}>—°</Text>
              <Text style={[styles.heatLabel, { color: heatVis_.color }]}>⚠️ {t('map.heatLabel')}</Text>
            </>
          ) : !heatData.has_data ? (
            <Text style={styles.heatUnavailable} numberOfLines={2}>{t('map.heatUnavailable')}</Text>
          ) : (
            <>
              <Text style={[styles.heatTemp, { color: heatVis_.color }]}>{heatData.surface_est_c}°</Text>
              <Text style={[styles.heatLabel, { color: heatVis_.color }]}>⚠️ {t('map.heatLabel')}</Text>
            </>
          )}
        </TouchableOpacity>
        {/* Right column: locate-me above the add-marker FAB — same shared
            LocateButton and layout as MapScreen. */}
        <View style={styles.mapControlsCol}>
          <LocateButton onPress={handleCenterOnMe} />
          <TouchableOpacity
            style={[styles.fab, shadows.lg]}
            onPress={() => navigation.navigate('MarkerCreate')}
            activeOpacity={0.85}
          >
            <MapPinPlusInside size={24} color={colors.white} />
          </TouchableOpacity>
        </View>
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

      <FirstWalkTipCard onSetupPrivacy={() => navigation.navigate('PrivacyRadius')} />

      {/* Nearby dogs — same sheet as MapScreen, opened from the walkers row.
          box-none so the closed (off-screen) sheet never blocks the panel. */}
      <View style={styles.nearbySheetWrap} pointerEvents="box-none">
        <NearbyDogsSheet
          visible={nearbySheetVisible}
          onClose={() => setNearbySheetVisible(false)}
          bottomOffset={insets.bottom}
          dogs={nearbyDogs}
          anonymousCount={nearbyHiddenCount}
          locationAvailable={nearbyLocationAvailable}
          onEnableLocation={() => {}}
          statusByUser={friendStatusByUser}
          onAddFriend={handleAddNearbyFriend}
          sendingUserId={sendingFriendId}
          onCardPress={handleWalkNearbyCardPress}
          onInvite={() => setShareVisible(true)}
        />
      </View>

      {!isGuest && <ShareProfileSheet visible={shareVisible} onClose={() => setShareVisible(false)} />}

      {/* Диагностический оверлей карты — тот же компонент/буфер, что на MapScreen.
          Рендерится только при включённом mapDebug (env preview или DevPanel). */}
      <MapDebugOverlay />
    </View>
  );
}

// ── Stat column ────────────────────────────────────────────────────────────────
function StatCol({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCol}>
      {/* Ограничиваем масштаб системного шрифта: при крупном Dynamic Type
          цифры/подписи ломали строку и обрезались («ВРЕМ…»). */}
      <Text style={styles.statValue} maxFontSizeMultiplier={1.2} numberOfLines={1}>{value}</Text>
      <Text style={styles.statLabel} maxFontSizeMultiplier={1.2} numberOfLines={1}>{label}</Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  // Full-screen, like MapScreen: the map's frame stays constant so the Apple
  // logo / Legal (anchored to that frame) don't move when the panel resizes.
  mapContainer: { ...StyleSheet.absoluteFillObject },

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
  // Позиция не публикуется (гость / «Никто» / домашняя зона) — серые точка и текст.
  hiddenDot: {
    backgroundColor: colors.textMuted,
  },
  hiddenTxt: {
    color: colors.textMuted,
  },


  // Fixed height so the plate doesn't change size between loading ("—°") /
  // no-data / data states.
  heatCard: {
    backgroundColor: colors.card,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    height: 54,
    justifyContent: 'center',
    minWidth: 64,
  },
  heatUnavailable: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
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

  // Absolute, above the panel (zIndex 30 > panel's 20). `bottom` is set inline
  // from walkChip.bottom; paddingHorizontal (14) is the chip's left edge, kept
  // in step with walkChip.left.
  mapBottomRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 14,
    zIndex: 30,
  },

  // Right-hand map controls column (locate-me + FAB)
  mapControlsCol: {
    alignItems: 'flex-end',
    gap: 12,
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

  // Nearby sheet overlay — above the walk bottom sheet (zIndex 20) while open.
  nearbySheetWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 40,
  },

  // Bottom sheet — absolute at the screen bottom; the full-screen map sits
  // behind it (like MapScreen's bottomPanel).
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
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
