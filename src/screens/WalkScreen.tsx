import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  Alert,
  Platform,
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
import { useFocusEffect } from '@react-navigation/native';
import { Bell, SlidersHorizontal, MapPinPlusInside, Users } from 'lucide-react-native';
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
import { FirstWalkNotifCard } from '../components/FirstWalkNotifCard';
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
import { toWalkPath } from '../lib/walkHistory';
import {
  finalizeWalk,
  finalizeAutoFinished,
  saveAutoFinished,
  AutoFinishedWalk,
} from '../lib/walkFinalize';
import {
  createAutoFinishDetector,
  AutoFinishDetector,
  AutoFinishHit,
  PARK_NEAR_M,
  HOME_PROMPT_MS,
  HOME_PROMPT_TEST_MS,
} from '../lib/autoFinish';
import {
  getDevAutoFinishTest,
  getDevParkCheckinTest,
  getDevParkPromptTest,
  getDevHomePromptTest,
  getDevStillWalkingTest,
  getDevProximityTest,
} from '../constants/dev';
import {
  startParkCheckinSession,
  endParkCheckinSession,
  feedParkFix,
  tickParkCheckin,
  checkInHere,
  subscribeParkCheckin,
  getParkCheckinState,
  PARK_PROMPT_MS,
  PARK_PROMPT_TEST_MS,
  DogPark,
} from '../lib/parkCheckin';
import { subscribeWalkLocations, startWalkTracking, stopWalkTracking } from '../lib/walkTracking';
import {
  isNotificationsAvailable,
  scheduleNotif,
  cancelScheduledNotification,
  presentWalkNotice,
  registerNotifHandler,
  KIND_PARK,
  CAT_PARK,
  ACT_PARK_HERE,
  KIND_HOME,
  CAT_HOME,
  ACT_FINISH,
  ACT_KEEP,
  KIND_STILL,
  CAT_STILL,
  KIND_MARKER,
  CAT_MARKER,
  ACT_MARKER_STILL,
  ACT_MARKER_GONE,
} from '../lib/notifications';
import { castMarkerVote } from '../lib/markerVotes';
import {
  NotifType,
  QUIET_EXEMPT,
  inQuietHours,
  loadNotifEnabled,
} from '../lib/notifPrefs';
import {
  parkText,
  homeText,
  autoFinishedText,
  hazardPermText,
  hazardTempText,
  stillText,
  markerText,
} from '../lib/notifText';

// Старт — общий START_COORD (Бат-Ям, см. lib/geo). Во время прогулки камера
// прыгает на пользователя первым же фиксом, так что этот регион виден лишь миг.
const INITIAL_REGION = { ...START_COORD, latitudeDelta: START_DELTA, longitudeDelta: START_DELTA };
const ACTIVE_WALK_PING_MS = 60000;
// Фоновый GPS-колбэк и 60-с таймер шлют active_walks через один троттл-гейт,
// чтобы в форграунде не было двойных запросов. Гейт чуть меньше интервала —
// иначе регулярный тик таймера глох бы о собственную частоту.
const ACTIVE_WALK_SYNC_GATE_MS = 50000;
// park_checkout при финише ждём не дольше этого, потом всё равно глушим трекинг.
const PARK_CHECKOUT_TIMEOUT_MS = 5000;
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
// Auto-finish (lib/autoFinish) is checked on every location callback; this
// timer covers the foreground stretches when no fix arrives (phone lying still).
const AUTO_FINISH_CHECK_MS = 30_000;
// «Неподвижность» не засчитывается, если шагомер за то же окно насчитал
// столько шагов и больше — человек ходит (по квартире, по кругу у площадки).
const STILL_MAX_STEPS = 300;

// Сценарий №3 «Опасность рядом» и №5 «Метка ещё актуальна?»: пороги сближения с
// меткой. Dev-переключатель «радиус 150 м» увеличивает оба для теста.
const HAZARD_TYPES = ['danger', 'hazard', 'aggressive_dog'];
const HAZARD_RADIUS_M = 50;
const MARKER_RADIUS_M = 30;
const PROXIMITY_TEST_RADIUS_M = 150;

// Сценарий №4 «Ты всё ещё гуляешь?» (только без домашней зоны): первый раз через
// 2 ч, повтор не раньше +1 ч. Dev-тест: 2 мин / +1 мин.
const STILL_WALKING_MS = 2 * 60 * 60_000;
const STILL_WALKING_TEST_MS = 2 * 60_000;
const STILL_WALKING_REPEAT_MS = 60 * 60_000;
const STILL_WALKING_REPEAT_TEST_MS = 60_000;

// Сценарий №5 «Метка ещё актуальна?»: не чаще 3 за прогулку. Временные метки =
// не инфраструктура и не типы-опасности (ими занимается №3) — чтобы одну метку
// не дёргать двумя уведомлениями.
const MARKER_PROMPT_MAX = 3;

// Steps between two moments from the motion coprocessor (iOS CMPedometer; the
// live watcher gets no updates in the background, so its count at T would be
// short). null when unavailable (Android, no permission) or too slow.
async function pedometerStepsBetween(fromMs: number, toMs: number): Promise<number | null> {
  if (Platform.OS !== 'ios' || !(toMs > fromMs)) return null;
  try {
    if (!(await Pedometer.isAvailableAsync())) return null;
    const res = await Promise.race([
      Pedometer.getStepCountAsync(new Date(fromMs), new Date(toMs)),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
    ]);
    return res?.steps ?? null;
  } catch (e) {
    console.warn('[WalkScreen] getStepCountAsync failed:', e);
    return null;
  }
}

// Дожидаемся промиса, но не дольше ms — чтобы висящий в фоне сетевой запрос
// (park_checkout) не задерживал остановку трекинга сверх окна пробуждения iOS.
function raceWithTimeout(p: Promise<unknown>, ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    let settled = false;
    const done = () => { if (!settled) { settled = true; resolve(); } };
    const id = setTimeout(done, ms);
    p.then(() => { clearTimeout(id); done(); }, () => { clearTimeout(id); done(); });
  });
}

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
  const { dogs: nearbyDogs, hiddenCount: nearbyHiddenCount, locationAvailable: nearbyLocationAvailable, refresh: refreshNearby } = useNearbyDogs(userLocation);
  const nearbyTotal = nearbyDogs.length + nearbyHiddenCount;
  const { statusByUser: friendStatusByUser, incomingCount, refresh: refreshFriends } = useFriends();
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

  // Returning from the Friends screen (e.g. after accepting a request) refreshes
  // the incoming-count badge without waiting out the 30s poll. Skip the very
  // first focus — useFriends already load()s on mount, so refetching here too
  // would be a redundant back-to-back request on startup.
  const didInitialFocus = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!didInitialFocus.current) {
        didInitialFocus.current = true;
        return;
      }
      refreshFriends();
    }, [refreshFriends])
  );

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
    // Coming back to the foreground: catch up now, not on the next tick — and
    // pull fresh friends + nearby walks instead of waiting out their 30s poll.
    const appStateSub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        tick();
        refreshNearby();
        refreshFriends();
      }
    });
    return () => {
      clearInterval(id);
      appStateSub.remove();
    };
  }, [walkStartedAtMs, trackingStarted, refreshNearby, refreshFriends]);
  const timeStr = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

  // ── Steps — Pedometer (real, 0 if unavailable) ─────────────────────────
  const [steps, setSteps] = useState(0);
  // Mirror for the fix handler's closure — auto-finish snapshots it per fix.
  const stepsRef = useRef(0);
  useEffect(() => {
    let sub: { remove: () => void } | null = null;
    Pedometer.isAvailableAsync().then((available) => {
      if (!available) return;
      sub = Pedometer.watchStepCount((result) => {
        stepsRef.current = result.steps;
        setSteps(result.steps);
      });
    });
    return () => { sub?.remove(); };
  }, []);

  // ── GPS route + Haversine distance ────────────────────────────────────
  const [route, setRoute] = useState<{ latitude: number; longitude: number }[]>([]);
  // Synchronous source of truth for the route; `route` state is its render copy.
  // Auto-finish cuts the route by index, so the index must be known at the fix.
  const routeRef = useRef<LatLng[]>([]);
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
  // Each fix carries its timestamp through the filter — a held run is released
  // later, and auto-finish needs when every point was actually taken.
  const glitchFilter = useRef(
    createGlitchFilter<Location.LocationObjectCoords & { timestamp: number }>()
  ).current;
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
  // Последняя отправка active_walks (создание/пинг/снятие) — общий троттл для
  // фонового GPS-колбэка и 60-с таймера, чтобы в форграунде не слать дубль.
  const lastActiveWalkSyncAt = useRef(0);
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
      lastActiveWalkSyncAt.current = Date.now();
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

  // Троттл-обёртка над syncActiveWalkRow: общий гейт для фонового GPS-пути и
  // 60-с таймера (без дублей в форграунде). Во время финиша не шлём — иначе
  // поздний фикс мог бы заново создать строку, которую мы только что удалили.
  function maybeSyncActiveWalk(pt: LatLng, nowMs: number) {
    if (finishingRef.current) return;
    if (nowMs - lastActiveWalkSyncAt.current < ACTIVE_WALK_SYNC_GATE_MS) return;
    lastActiveWalkSyncAt.current = nowMs;
    syncActiveWalkRow(pt);
  }

  // First GPS fix: resolve context once, then run the publish gate.
  async function startActiveWalkRow(pt: LatLng) {
    const ok = await resolveActiveWalkContext();
    if (!ok) return;
    await syncActiveWalkRow(pt);
  }

  // A walk only "counts" (walk_history + badges) past a minimum bar — see
  // lib/walkFinalize, shared with the recovery card.
  async function handleFinish() {
    if (finishingRef.current) return; // double-tap: the first tap owns the save
    finishingRef.current = true;
    setFinishing(true);
    cancelHomePrompt(); // прогулка завершается — подсказки «Уже дома?»/«Всё ещё гуляешь?» не нужны
    cancelStillWalking();
    // park_checkout ДО остановки трекинга (с таймаутом), тем же порядком, что и в
    // авто-финише: пока трекинг жив, у приложения есть время доставить запрос.
    await raceWithTimeout(endParkCheckinSession(), PARK_CHECKOUT_TIMEOUT_MS);
    await stopActiveWalkRow();
    // The walk is over from this tap on — no fix may extend the route or the
    // distance while the save below is in flight. finalizeWalk берёт снимок
    // route/distanceKm/seconds из замыкания, так что ожидание выше их не меняет.
    await stopWalkTracking();

    // Температурный статус фиксируем ЗДЕСЬ, в момент завершения. heatData
    // приходит из единственного useAsphaltTemp через getEffectiveAsphaltTemp
    // (lib/heat.ts), то есть уже с учётом dev-оверрайда. Экран итогов получает
    // готовое значение и не перечитывает погоду: остывший к тому времени
    // асфальт не должен задним числом отменять вердикт про жару.
    const heatStatusAtFinish = heatData.status;

    const { isValidWalk, newBadgeIds, isPersonalBest } = await finalizeWalk({
      startedAt: walkStartedAt,
      durationS: seconds,
      distanceKm,
      steps,
      path: toWalkPath(route),
      // Dog already resolved on the first GPS fix unless publishing was
      // skipped (visibility='nobody') — then finalizeWalk looks it up.
      dogId: activeWalkContextReady.current ? activeWalkDogId.current : undefined,
      confirmedCount,
      checkPersonalBest: true,
    });

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

  // ── Auto-finish of a forgotten walk (lib/autoFinish) ────────────────────
  // Home rule: confirmed outside the home zone, then inside it for 20 min →
  // the walk ends at the moment of entry (T). No home zone → stillness rule
  // (30 min within 50 m, 60 min near a park / dog park). Everything recorded
  // after T is left out of the distance, time, steps and saved path.
  //
  // May fire in the background. Saving to Supabase from there is unreliable
  // (iOS suspends the app seconds after tracking stops), so the background
  // only stores a snapshot already cut at T; it is saved and the summary shown
  // when the app is back in the foreground — or by useApp on the next cold
  // start if iOS evicted the app meanwhile.
  const autoDetector = useRef<AutoFinishDetector | null>(null);
  const autoPendingRef = useRef<AutoFinishedWalk | null>(null);
  const autoRouteRef = useRef<LatLng[]>([]);
  const parksRef = useRef<LatLng[]>([]);
  // ── Сценарий №2 «Уже дома?» ───────────────────────────────────────────────
  // Подсказку планируем в ОС на «вход в домашнюю зону (кандидат) + порог» (10 мин),
  // отменяем при выходе из зоны / «Ещё гуляю» / авто-завершении / конце прогулки.
  const homePromptThresholdMs = useRef<number>(HOME_PROMPT_MS);
  const homePromptScheduledId = useRef<string | null>(null);
  const homePromptForSince = useRef<number | null>(null);
  // ── Сценарии №3/№5: сближение с метками ────────────────────────────────────
  // Общий флаг «радиус 150 м» для теста обоих. currentUserId / домашняя зона —
  // чтобы не предупреждать о своих метках и о метках у дома (приватность).
  const hazardsRef = useRef<
    Array<{
      id: string;
      lat: number;
      lng: number;
      userId: string | null;
      type: string;
      temporary: boolean;
      createdAt: string | null;
    }>
  >([]);
  const notifiedHazards = useRef<Set<string>>(new Set());
  const proximityTestRef = useRef<boolean>(false);
  const currentUserIdRef = useRef<string | null>(null);
  const notifHomeZoneRef = useRef<HomeZone | null>(null);
  const dogNameRef = useRef<string | null>(null); // имя первой собаки для текстов ({dog})
  // ── Сценарий №4 «Ты всё ещё гуляешь?» (только без домашней зоны) ─────────────
  const noHomeZoneRef = useRef<boolean>(false);
  const stillWalkingIntervalMs = useRef<number>(STILL_WALKING_MS);
  const stillWalkingRepeatMs = useRef<number>(STILL_WALKING_REPEAT_MS);
  const stillWalkingScheduledId = useRef<string | null>(null);
  const stillWalkingFireAt = useRef<number | null>(null);
  // ── Сценарий №5 «Метка ещё актуальна?» ──────────────────────────────────────
  const tempMarkersRef = useRef<
    Array<{ id: string; lat: number; lng: number; userId: string | null; type: string }>
  >([]);
  const notifiedMarkers = useRef<Set<string>>(new Set());
  const markerPromptCount = useRef<number>(0);
  // Выключатели типов уведомлений (Настройки) + тихие часы. canShow() — единый гейт.
  const notifEnabledRef = useRef<Record<NotifType, boolean>>({
    park: true,
    home: true,
    hazard: true,
    still: true,
    marker: true,
  });
  // Источник — ПОЛНЫЙ markers, НЕ filteredMarkers: фильтр карты (activeCategories/
  // радиус) скрывает только пины. Фолбэк автозавершения «около парка» не должен
  // зависеть от того, что тестер снял галочку с парков в фильтре.
  useEffect(() => {
    parksRef.current = markers
      .filter((m) => m.type === 'park' || m.type === 'dog_park')
      .map((m) => ({ latitude: m.lat, longitude: m.lng }));
  }, [markers]);

  // Метки-опасности для №3 (полный markers, не filteredMarkers — фильтр карты на
  // предупреждения не влияет).
  useEffect(() => {
    hazardsRef.current = markers
      .filter((m) => HAZARD_TYPES.includes(m.type))
      .map((m) => ({
        id: m.id,
        lat: m.lat,
        lng: m.lng,
        userId: m.user_id,
        type: m.type,
        temporary: m.expires_at != null, // временная (пользовательская) vs постоянная
        createdAt: m.created_at ?? null,
      }));
  }, [markers]);

  // Временные метки для №5: не инфраструктура (вода/парки — постоянные, голоса нет)
  // и не опасности (их ведёт №3). Сейчас это по сути «запрещено» и будущее «еда».
  useEffect(() => {
    tempMarkersRef.current = markers
      .filter((m) => !INFRA_MARKER_TYPES.includes(m.type) && !HAZARD_TYPES.includes(m.type))
      .map((m) => ({ id: m.id, lat: m.lat, lng: m.lng, userId: m.user_id, type: m.type }));
  }, [markers]);

  // Кто я и где мой дом — для фильтра «не предупреждать о своих метках и о метках
  // в домашней зоне». Нужно и гостю (у него userId=null, своих меток нет).
  useEffect(() => {
    let disposed = false;
    (async () => {
      const [{ data: { session } }, zone] = await Promise.all([
        supabase.auth.getSession(),
        loadHomeZone(),
      ]);
      if (disposed) return;
      const uid = session?.user?.id ?? null;
      currentUserIdRef.current = uid;
      notifHomeZoneRef.current = zone;
      if (uid) {
        const { data: dog } = await supabase
          .from('dogs')
          .select('name')
          .eq('owner_id', uid)
          .limit(1)
          .maybeSingle();
        if (!disposed) dogNameRef.current = (dog?.name as string | undefined)?.trim() || null;
      }
    })();
    return () => {
      disposed = true;
    };
  }, []);

  // Выключатели типов уведомлений: читаем при входе и при возврате в foreground
  // (пользователь мог переключить в Настройках, не завершая прогулку).
  useEffect(() => {
    const load = () => {
      loadNotifEnabled().then((e) => {
        notifEnabledRef.current = e;
      });
    };
    load();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') load();
    });
    return () => sub.remove();
  }, []);

  // Единый гейт показа: выключатель типа в Настройках + тихие часы (кроме home/still).
  function canShow(type: NotifType): boolean {
    if (!notifEnabledRef.current[type]) return false;
    if (!QUIET_EXEMPT.includes(type) && inQuietHours()) return false;
    return true;
  }

  // Home zone read on its own here: the publish context skips it for guests
  // and visibility='nobody', but auto-finish applies to every walk.
  useEffect(() => {
    let disposed = false;
    (async () => {
      const [zone, testMode, homePromptTest, proximityTest, stillWalkingTest] = await Promise.all([
        loadHomeZone(),
        getDevAutoFinishTest(),
        getDevHomePromptTest(),
        getDevProximityTest(),
        getDevStillWalkingTest(),
      ]);
      if (disposed) return;
      homePromptThresholdMs.current = homePromptTest ? HOME_PROMPT_TEST_MS : HOME_PROMPT_MS;
      proximityTestRef.current = proximityTest;
      noHomeZoneRef.current = zone == null;
      stillWalkingIntervalMs.current = stillWalkingTest ? STILL_WALKING_TEST_MS : STILL_WALKING_MS;
      stillWalkingRepeatMs.current = stillWalkingTest
        ? STILL_WALKING_REPEAT_TEST_MS
        : STILL_WALKING_REPEAT_MS;
      autoDetector.current = createAutoFinishDetector({
        home: zone,
        testMode,
        isNearPark: (pt) => parksRef.current.some((p) => haversine(p, pt) * 1000 <= PARK_NEAR_M),
      });
    })();
    return () => {
      disposed = true;
      autoDetector.current?.dispose();
      autoDetector.current = null;
    };
  }, []);

  // ── Park check-in (lib/parkCheckin) ─────────────────────────────────────
  // Signed-in walks only. Auto check-in after PARK_DWELL_MS inside a dog_park
  // zone, checkout on a confirmed exit and at the end of the walk; the park
  // card's "I'm here" goes through the same session. visibility='nobody' still
  // tracks the zone (so the card can explain why "I'm here" is off) but never
  // checks in. The session is closed by Finish / auto-finish and on unmount.
  const dogParksRef = useRef<DogPark[]>([]);
  // Источник — ПОЛНЫЙ markers, НЕ filteredMarkers: фильтр карты (activeCategories/
  // радиус) влияет только на показ пинов. Зоны чек-ина (авто-отметка, «Я здесь»,
  // nearestPark) должны работать, даже если юзер снял галочку с парков в фильтре.
  useEffect(() => {
    dogParksRef.current = markers
      .filter((m) => m.type === 'dog_park')
      .map((m) => ({ id: m.id, latitude: m.lat, longitude: m.lng }));
  }, [markers]);

  // ── Сценарий №1 «Ты на площадке?» ────────────────────────────────────────
  // Подсказку планируем в ОС на «вход в зону + порог» (система покажет её сама,
  // даже если JS не получит ни одного фикса). Отменяем при выходе из зоны /
  // чек-ине / конце прогулки. Один раз за прогулку на парк; не шлём, если уже
  // отмечен (вручную или авто) или visibility='nobody'. Кнопка «Я здесь» = тот
  // же checkInHere, что в карточке площадки.
  const parkPromptThresholdMs = useRef<number>(PARK_PROMPT_MS);
  const parkPromptScheduledId = useRef<string | null>(null);
  const parkPromptForParkId = useRef<string | null>(null); // парк текущей запланированной подсказки
  const parkPromptFireAt = useRef<number | null>(null); // когда подсказка должна показаться
  const parkPromptedParks = useRef<Set<string>>(new Set()); // уже ПОКАЗАЛИ за эту прогулку

  useEffect(() => {
    let disposed = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return; // guest — no check-in
      const [zone, testMode, promptTest, stored] = await Promise.all([
        loadHomeZone(),
        getDevParkCheckinTest(),
        getDevParkPromptTest(),
        AsyncStorage.getItem('privacy_visibility'),
      ]);
      if (disposed || finishingRef.current) return;
      parkPromptThresholdMs.current = promptTest ? PARK_PROMPT_TEST_MS : PARK_PROMPT_MS;
      startParkCheckinSession({
        parks: () => dogParksRef.current,
        homeZone: zone,
        eligibility: (stored as Visibility | null) === 'nobody' ? 'nobody' : 'ok',
        testMode,
      });
    })();
    return () => {
      disposed = true;
      endParkCheckinSession();
    };
  }, []);

  // Планирование/отмена подсказки №1 по состоянию чек-ина (parkCheckin store).
  useEffect(() => {
    if (!isNotificationsAvailable) return;

    function cancelPrompt() {
      const pid = parkPromptForParkId.current;
      const fireAt = parkPromptFireAt.current;
      if (parkPromptScheduledId.current) {
        cancelScheduledNotification(parkPromptScheduledId.current);
        parkPromptScheduledId.current = null;
      }
      // «Один раз за прогулку на парк» засчитываем ТОЛЬКО если порог уже прошёл,
      // пока мы были в зоне (уведомление успело показаться). Выход из зоны раньше
      // порога — парк снова свободен, подсказка придёт при следующем дожитии.
      if (pid && fireAt != null && Date.now() >= fireAt) parkPromptedParks.current.add(pid);
      parkPromptForParkId.current = null;
      parkPromptFireAt.current = null;
    }

    async function schedulePrompt(parkId: string, insideSince: number) {
      parkPromptForParkId.current = parkId;
      const fireAt = insideSince + parkPromptThresholdMs.current;
      parkPromptFireAt.current = fireAt;
      const fireInSeconds = Math.max(1, Math.round((fireAt - Date.now()) / 1000));
      const content = parkText(t, dogNameRef.current);
      const id = await scheduleNotif({
        kind: KIND_PARK,
        categoryId: CAT_PARK,
        actions: [{ identifier: ACT_PARK_HERE, buttonTitle: t('park.notif.action') }],
        title: content.title,
        body: content.body,
        data: { parkId },
        fireInSeconds,
      });
      // Пока ждали планирования — вышли из зоны / сменили парк: лишнее отменяем.
      if (parkPromptForParkId.current === parkId) parkPromptScheduledId.current = id;
      else if (id) cancelScheduledNotification(id);
    }

    function evaluate() {
      const s = getParkCheckinState();
      // Отмена: не в зоне / уже отмечен / «никто» / нет прогулки.
      if (
        !s.active ||
        s.eligibility !== 'ok' ||
        s.parkId == null ||
        s.checkedIn ||
        s.insideSince == null
      ) {
        cancelPrompt();
        return;
      }
      if (parkPromptForParkId.current === s.parkId) return; // уже запланировано на этот парк
      if (parkPromptedParks.current.has(s.parkId)) return; // уже показывали за прогулку
      if (!canShow('park')) return; // тип выключен в настройках / тихие часы
      cancelPrompt(); // снять возможную подсказку прошлого парка
      void schedulePrompt(s.parkId, s.insideSince);
    }

    const unsub = subscribeParkCheckin(evaluate);
    evaluate();
    return () => {
      unsub();
      cancelPrompt();
    };
  }, [t]);

  // Кнопка «Я здесь» из подсказки №1 → существующий checkInHere, затем короткий
  // результат (приложение не открывалось — иначе не узнать, сработало ли).
  useEffect(() => {
    return registerNotifHandler(KIND_PARK, (data, action) => {
      if (action !== ACT_PARK_HERE) return;
      const parkId = typeof data.parkId === 'string' ? data.parkId : null;
      if (!parkId) return;
      void (async () => {
        const res = await checkInHere(parkId);
        if (res === 'ok') {
          presentWalkNotice(t('park.notif.okTitle'), t('park.notif.okBody'));
        } else if (res !== 'nobody') {
          presentWalkNotice(t('park.notif.failTitle'), t('park.notif.failBody'));
        }
      })();
    });
  }, [t]);

  // ── Сценарий №2: планирование / отмена / действия подсказки «Уже дома?» ─────
  function cancelHomePrompt() {
    if (homePromptScheduledId.current) {
      cancelScheduledNotification(homePromptScheduledId.current);
      homePromptScheduledId.current = null;
    }
    homePromptForSince.current = null;
  }

  async function evaluateHomePrompt() {
    if (!isNotificationsAvailable) return;
    if (!canShow('home')) {
      cancelHomePrompt();
      return;
    }
    const since = finishingRef.current ? null : autoDetector.current?.homeCandidateSince() ?? null;
    if (since == null) {
      cancelHomePrompt();
      return;
    }
    if (homePromptForSince.current === since) return; // уже запланировано на этого кандидата
    cancelHomePrompt();
    homePromptForSince.current = since;
    const fireInSeconds = Math.max(
      1,
      Math.round((since + homePromptThresholdMs.current - Date.now()) / 1000),
    );
    const content = homeText(t, dogNameRef.current);
    const id = await scheduleNotif({
      kind: KIND_HOME,
      categoryId: CAT_HOME,
      actions: [
        { identifier: ACT_FINISH, buttonTitle: t('home.notif.finish') },
        { identifier: ACT_KEEP, buttonTitle: t('home.notif.keep') },
      ],
      title: content.title,
      body: content.body,
      fireInSeconds,
    });
    if (homePromptForSince.current === since) homePromptScheduledId.current = id;
    else if (id) cancelScheduledNotification(id);
  }

  const homeEvalRef = useRef(evaluateHomePrompt);
  homeEvalRef.current = evaluateHomePrompt;

  // ── Сценарий №3: предупреждение при сближении с меткой-опасностью ───────────
  // Раз на метку за прогулку, без кнопок, работает и у гостя. Не предупреждаем о
  // своих метках и о метках в домашней зоне.
  function evaluateHazards(pt: LatLng) {
    if (!isNotificationsAvailable) return;
    if (!canShow('hazard')) return;
    const radius = proximityTestRef.current ? PROXIMITY_TEST_RADIUS_M : HAZARD_RADIUS_M;
    const zone = notifHomeZoneRef.current;
    const uid = currentUserIdRef.current;
    for (const h of hazardsRef.current) {
      if (notifiedHazards.current.has(h.id)) continue;
      if (uid && h.userId === uid) continue;
      if (zone && isInsideHomeZone(h.lat, h.lng, zone)) continue;
      const distM = haversine(pt, { latitude: h.lat, longitude: h.lng }) * 1000;
      if (distM > radius) continue;
      notifiedHazards.current.add(h.id);
      const dist = Math.round(distM);
      // Временная опасная метка + залогинен → одно уведомление: предупреждение С
      // кнопками-голосом (castMarkerVote через обработчик KIND_MARKER). Лимит ≤3
      // из №5 сюда НЕ применяется — опасность важнее. Постоянная опасная метка или
      // гость → без кнопок, как раньше.
      if (h.temporary && uid) {
        const ageMs = h.createdAt ? Date.now() - Date.parse(h.createdAt) : 0;
        const content = hazardTempText(t, dogNameRef.current, h.type, dist, ageMs);
        void scheduleNotif({
          kind: KIND_MARKER,
          categoryId: CAT_MARKER,
          actions: [
            { identifier: ACT_MARKER_STILL, buttonTitle: t('marker.notif.still') },
            { identifier: ACT_MARKER_GONE, buttonTitle: t('marker.notif.gone') },
          ],
          title: content.title,
          body: content.body,
          data: { markerId: h.id },
          fireInSeconds: 1,
        });
      } else {
        const content = hazardPermText(t, dogNameRef.current, h.type, dist);
        presentWalkNotice(content.title, content.body);
      }
    }
  }
  const hazardEvalRef = useRef(evaluateHazards);
  hazardEvalRef.current = evaluateHazards;

  // ── Сценарий №5: «Метка ещё актуальна?» при проходе рядом с временной меткой ──
  // Кнопки = те же голоса, что в карточке метки. Раз на метку, не чаще 3 за
  // прогулку, не своя метка, только для залогиненных (голос требует аккаунт).
  function evaluateMarkerPrompts(pt: LatLng) {
    if (!isNotificationsAvailable) return;
    if (!canShow('marker')) return;
    const uid = currentUserIdRef.current;
    if (!uid) return; // гость голосовать не может
    if (markerPromptCount.current >= MARKER_PROMPT_MAX) return;
    const radius = proximityTestRef.current ? PROXIMITY_TEST_RADIUS_M : MARKER_RADIUS_M;
    for (const m of tempMarkersRef.current) {
      if (markerPromptCount.current >= MARKER_PROMPT_MAX) break;
      if (notifiedMarkers.current.has(m.id)) continue;
      if (m.userId === uid) continue; // не своя метка
      if (haversine(pt, { latitude: m.lat, longitude: m.lng }) * 1000 > radius) continue;
      notifiedMarkers.current.add(m.id);
      markerPromptCount.current += 1;
      const content = markerText(t, m.type);
      void scheduleNotif({
        kind: KIND_MARKER,
        categoryId: CAT_MARKER,
        actions: [
          { identifier: ACT_MARKER_STILL, buttonTitle: t('marker.notif.still') },
          { identifier: ACT_MARKER_GONE, buttonTitle: t('marker.notif.gone') },
        ],
        title: content.title,
        body: content.body,
        data: { markerId: m.id },
        fireInSeconds: 1,
      });
    }
  }
  const markerEvalRef = useRef(evaluateMarkerPrompts);
  markerEvalRef.current = evaluateMarkerPrompts;

  // Кнопки №5 → тот же голос, что в карточке метки (castMarkerVote), затем
  // короткое подтверждение.
  useEffect(() => {
    return registerNotifHandler(KIND_MARKER, (data, action) => {
      const markerId = typeof data.markerId === 'string' ? data.markerId : null;
      const uid = currentUserIdRef.current;
      if (!markerId || !uid) return;
      const vote =
        action === ACT_MARKER_STILL ? 'still_there' : action === ACT_MARKER_GONE ? 'gone' : null;
      if (!vote) return;
      void (async () => {
        const err = await castMarkerVote(markerId, uid, vote);
        if (!err) presentWalkNotice(t('marker.notif.thanksTitle'), t('marker.notif.thanksBody'));
      })();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  // ── Сценарий №4: «Ты всё ещё гуляешь?» (только без домашней зоны) ────────────
  function cancelStillWalking() {
    if (stillWalkingScheduledId.current) {
      cancelScheduledNotification(stillWalkingScheduledId.current);
      stillWalkingScheduledId.current = null;
    }
    stillWalkingFireAt.current = null;
  }

  async function scheduleStillWalking(fireAtMs: number) {
    cancelStillWalking();
    stillWalkingFireAt.current = fireAtMs;
    const content = stillText(t, fireAtMs - walkStartedAtMs);
    const id = await scheduleNotif({
      kind: KIND_STILL,
      categoryId: CAT_STILL,
      actions: [
        { identifier: ACT_FINISH, buttonTitle: t('home.notif.finish'), opensApp: true },
        { identifier: ACT_KEEP, buttonTitle: t('home.notif.keep') },
      ],
      title: content.title,
      body: content.body,
      fireInSeconds: Math.max(1, Math.round((fireAtMs - Date.now()) / 1000)),
    });
    if (stillWalkingFireAt.current === fireAtMs) stillWalkingScheduledId.current = id;
    else if (id) cancelScheduledNotification(id);
  }

  function evaluateStillWalking(now: number) {
    if (!isNotificationsAvailable) return;
    if (!noHomeZoneRef.current || finishingRef.current || !canShow('still')) {
      cancelStillWalking();
      return;
    }
    if (stillWalkingFireAt.current == null) {
      void scheduleStillWalking(walkStartedAtMs + stillWalkingIntervalMs.current);
      return;
    }
    // Запланированное уже должно было показаться → дошлём следующее через +повтор.
    if (now >= stillWalkingFireAt.current) {
      void scheduleStillWalking(now + stillWalkingRepeatMs.current);
    }
  }
  const stillEvalRef = useRef(evaluateStillWalking);
  stillEvalRef.current = evaluateStillWalking;

  // Кнопки №4: «Завершить» (открывает приложение — handleFinish читает таймер из
  // состояния) → обычное завершение; «Ещё гуляю» → следующий вопрос через +повтор.
  useEffect(() => {
    const unreg = registerNotifHandler(KIND_STILL, (_data, action) => {
      if (action === ACT_FINISH) {
        cancelStillWalking();
        void handleFinish();
      } else if (action === ACT_KEEP) {
        void scheduleStillWalking(Date.now() + stillWalkingRepeatMs.current);
      }
    });
    return () => {
      unreg();
      cancelStillWalking();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  // Кнопки подсказки №2: «Завершить» → forceHome + handleAutoFinish (завершение с
  // прибытием к двери); «Ещё гуляю» → rejectHome (до следующего выхода из зоны).
  useEffect(() => {
    const unreg = registerNotifHandler(KIND_HOME, (_data, action) => {
      if (action === ACT_FINISH) {
        cancelHomePrompt();
        const hit = autoDetector.current?.forceHome();
        if (hit) void handleAutoFinish(hit);
      } else if (action === ACT_KEEP) {
        autoDetector.current?.rejectHome();
        cancelHomePrompt();
      }
    });
    return () => {
      unreg();
      cancelHomePrompt(); // конец прогулки / уход с экрана — снять запланированную подсказку
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  function runAutoFinishCheck() {
    if (finishingRef.current) return;
    const hit = autoDetector.current?.check(Date.now());
    if (hit) handleAutoFinish(hit);
  }

  async function handleAutoFinish(hit: AutoFinishHit) {
    if (hit.reason === 'still') {
      const moved = await pedometerStepsBetween(hit.endAt, Date.now());
      if (moved != null && moved >= STILL_MAX_STEPS) {
        autoDetector.current?.rejectStill(Date.now());
        return;
      }
    }
    // The user tapped Finish while the check above was in flight.
    if (finishingRef.current) return;
    finishingRef.current = true;
    setFinishing(true);
    cancelHomePrompt(); // прогулка завершается — подсказки больше не нужны
    cancelStillWalking();

    // Трек режем на ВХОДЕ в домашнюю зону (routeCutLen), даже если время/дистанция
    // посчитаны до прибытия к двери: точки внутри зоны в сохранённый трек не идут.
    const cutRoute = routeRef.current.slice(0, hit.routeCutLen);
    autoRouteRef.current = cutRoute;
    const stepsAtT = await pedometerStepsBetween(walkStartedAtMs, hit.endAt);
    const { data: { session } } = await supabase.auth.getSession();
    const walk: AutoFinishedWalk = {
      userId: session?.user?.id ?? null,
      reason: hit.reason,
      startedAt: walkStartedAt,
      endedAt: new Date(hit.endAt).toISOString(),
      durationS: Math.max(0, Math.floor((hit.endAt - walkStartedAtMs) / 1000)),
      distanceKm: hit.mark.distanceKm,
      steps: stepsAtT ?? hit.mark.steps,
      path: toWalkPath(cutRoute),
      dogResolved: activeWalkContextReady.current,
      dogId: activeWalkDogId.current,
      heatStatusAtFinish: heatData.status,
    };
    await saveAutoFinished(walk);
    // Приложение не открыто (фон) — иначе человек не узнает, что прогулка
    // завершилась сама: отдельное уведомление без кнопок «Прогулка завершена».
    // Открыто → сразу покажем экран итогов, уведомление не нужно.
    if (AppState.currentState !== 'active') {
      const content = autoFinishedText(t, walk.distanceKm.toFixed(2), Math.round(walk.durationS / 60));
      presentWalkNotice(content.title, content.body);
    }
    // park_checkout ДО остановки трекинга (с таймаутом): в фоне iOS усыпляет
    // приложение сразу после stopWalkTracking — fire-and-forget checkout терялся.
    await raceWithTimeout(endParkCheckinSession(), PARK_CHECKOUT_TIMEOUT_MS);
    await stopActiveWalkRow();
    await stopWalkTracking();
    autoPendingRef.current = walk;
    if (AppState.currentState === 'active') resumeAutoFinish();
  }

  function resumeAutoFinish() {
    const walk = autoPendingRef.current;
    if (!walk) return;
    autoPendingRef.current = null;
    finalizeAutoAndShow(walk);
  }

  async function finalizeAutoAndShow(walk: AutoFinishedWalk) {
    const result = await finalizeAutoFinished(walk, confirmedCount);
    if (!result) return; // already being saved elsewhere
    navigation.replace('WalkSummary', {
      duration: walk.durationS,
      steps: walk.steps ?? 0,
      distanceKm: walk.distanceKm,
      routeCoordinates: autoRouteRef.current,
      isValidWalk: result.isValidWalk,
      newBadgeIds: result.newBadgeIds,
      isPersonalBest: false,
      heatStatusAtFinish: walk.heatStatusAtFinish,
      autoFinishReason: walk.reason,
      autoFinishedAt: walk.endedAt,
    });
  }

  // The fix handler and the timers below are created once; they call through
  // these refs so they always reach this render's state (confirmedCount, heat).
  const autoCheckRef = useRef(runAutoFinishCheck);
  autoCheckRef.current = runAutoFinishCheck;
  const autoResumeRef = useRef(resumeAutoFinish);
  autoResumeRef.current = resumeAutoFinish;

  useEffect(() => {
    const id = setInterval(() => {
      autoCheckRef.current();
      tickParkCheckin(Date.now());
      void homeEvalRef.current();
      stillEvalRef.current(Date.now());
    }, AUTO_FINISH_CHECK_MS);
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      autoCheckRef.current();
      tickParkCheckin(Date.now());
      void homeEvalRef.current();
      stillEvalRef.current(Date.now());
      autoResumeRef.current();
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, []);

  // 60s publish tick while walking — the gate decides publish vs unpublish
  // based on whether the current point is inside the home privacy zone.
  useEffect(() => {
    const id = setInterval(() => {
      if (latestPos.current) maybeSyncActiveWalk(latestPos.current, Date.now());
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
      // Once per batch, not per fix: after the background the batch carries
      // old timestamps, and an exit at its end must land before the dwell is
      // judged against Date.now().
      tickParkCheckin(Date.now());
      void homeEvalRef.current(); // подсказка №2: кандидат «дом» мог появиться/исчезнуть
      stillEvalRef.current(Date.now()); // подсказка №4: 2 ч без домашней зоны
      // Публикуем active_walks и из фонового пути (не только 60-с таймер, который
      // iOS не крутит при погашенном экране) — тем же троттл-гейтом. Иначе
      // updated_at протухает: нас теряют в «гуляют рядом» и сервер режет
      // park-чек-ин (обе функции требуют свежую active_walks).
      if (latestPos.current) maybeSyncActiveWalk(latestPos.current, Date.now());
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
      if (!isAccurateFix(loc.coords.accuracy)) {
        // Indoors most fixes land here. They can't move the walk, but they
        // are the only clock tick the background gets — run the check.
        autoCheckRef.current();
        return;
      }
      const stamped = { ...loc.coords, timestamp: loc.timestamp };
      for (const coords of glitchFilter.accept(stamped, loc.timestamp)) {
        const pt = { latitude: coords.latitude, longitude: coords.longitude };
        moveUserMarker(pt);
        reportGpsFix(coords);
        setAccuracy(coords.accuracy ?? undefined);
        const prev = routeRef.current[routeRef.current.length - 1];
        if (prev) distanceKmRef.current += haversine(prev, pt);
        routeRef.current = [...routeRef.current, pt];
        setRoute(routeRef.current);
        setDistanceKm(distanceKmRef.current);
        autoDetector.current?.feed(
          { ...pt, accuracy: coords.accuracy, timestamp: coords.timestamp },
          { routeLen: routeRef.current.length, distanceKm: distanceKmRef.current, steps: stepsRef.current },
        );
        feedParkFix({ ...pt, accuracy: coords.accuracy, timestamp: coords.timestamp });
        hazardEvalRef.current(pt); // №3: предупреждение при сближении с опасностью
        markerEvalRef.current(pt); // №5: «метка ещё актуальна?» у временной метки
        followWith(pt);
        setUserLocation(pt);

        latestPos.current = pt;
        if (!activeWalkStartAttempted.current) {
          activeWalkStartAttempted.current = true;
          startActiveWalkRow(pt);
        }
      }
      autoCheckRef.current();
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
          {/* Always mounted under a stable key. An empty/short route becomes an
              MKPolyline with 0/1 points (count 0 → no deref natively), so there
              is no churn as route crosses length 1 mid-walk. */}
          <Polyline key="route" coordinates={route} strokeColor={colors.primary} strokeWidth={4} />

          {/* Always mounted under a stable key so toggling marker types in the
              filter can never unmount/remount this node — that churn is what made
              the arrow vanish (symptom a). Before the first GPS fix userCoord sits
              at 0,0, so hide it with opacity 0 instead of unmounting. */}
          <MarkerAnimated
            key="me"
            coordinate={userCoord}
            opacity={hasUserFix ? 1 : 0}
            anchor={{ x: 0.5, y: 0.5 }}
            flat
            // Above every other marker (friend pins are 2, hazards/water 1).
            zIndex={3}
            // Constant true on this one marker only — the native-driven
            // rotation needs a live view; no more per-fix pulsing.
            tracksViewChanges
          >
            <UserLocationMarker headingAnim={headingAnim} accuracy={accuracy} />
          </MarkerAnimated>

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

        {/* ── Friends — top left (no burger here, unlike MapScreen) ── */}
        <TouchableOpacity
          onPress={() => { setDetailMarker(null); setSelectedFriendId(null); navigation.navigate('Friends'); }}
          style={[styles.iconBtn, shadows.sm, { position: 'absolute', zIndex: 30, top: insets.top + 8, left: 14 }]}
          activeOpacity={0.8}
          accessibilityLabel={t('menu.friends')}
          hitSlop={{ top: 4, right: 4, bottom: 4, left: 4 }}
        >
          <Users size={20} color={colors.ink} />
          {incomingCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeTxt}>{incomingCount}</Text>
            </View>
          )}
        </TouchableOpacity>

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

      {/* Разрешение на уведомления — своя карточка «зачем» на первой прогулке,
          после старта трека (гейтится trackingStarted), перед системным диалогом. */}
      {trackingStarted && <FirstWalkNotifCard />}

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
