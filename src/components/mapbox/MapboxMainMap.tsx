import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Lang } from '../../i18n';
import { LatLng, isValidCoord } from '../../lib/geo';
import { MapboxModule, mapLabelLayers, MAPBOX_STYLE_URL } from '../../lib/mapbox';
import { circlePolygon, toLngLat } from '../../lib/mapboxGeo';
import { mapDebug } from '../../lib/mapDebug';
import type { HomeZone } from '../../lib/privacyZone';
import {
  INFRA_DOT_FILTER,
  INFRA_DOT_STYLE,
  INFRA_ICON_STYLE,
  INFRA_IMAGES,
  InfraPointProps,
  infraFeatureCollection,
  SHRINK_FADE_FROM,
} from '../../lib/mapboxMarkers';
import { MapMarker, WaterSource, MARKER_CONFIG, INFRA_MARKER_TYPES } from '../../lib/markerConfig';
import { UserLocationMarker } from '../UserLocationMarker';
import { FRIEND_PIN_STALE_MS } from '../FriendWalkerMarker';

// Mapbox-версия главной карты (этап 3 переезда, заходы 1–2 — docs/MAPBOX-MIGRATION.md).
// Рисуется только при useMapEngine() === 'mapbox'; старая карта в MapScreen не тронута.
//
// Что где рисуется:
//   • площадки, парки, вода — слой на видеокарте со «сжатием» (lib/mapboxMarkers);
//   • опасные пользовательские метки — обычными View (MarkerView): их мало, они
//     всегда значком и всегда поверх инфраструктуры, эмодзи настоящие (PNG для
//     новых типов не нужны);
//   • друзья на прогулке и маркер «я» — тоже MarkerView; «я» плавно скользит
//     между фиксами (MeMarker ниже);
//   • точка воды из OSM по тапу показывает маленькую подпись (WaterBubble);
//   • домашняя зона — круг, который виден только пока экран просит (кнопка-«глаз»).
//
// Экран общается с картой через MainMapHandle — тот же минимум, что он брал у
// react-native-maps (подвинуть камеру, узнать точку экрана для координаты),
// поэтому логика MapScreen (пузырь метки, «найти меня», авто-центр) общая для
// обеих карт.

export type MainMapHandle = {
  // Плавно центрировать карту на точке с «квартальным» зумом.
  centerOn: (target: LatLng, durationMs: number) => void;
  // Где на экране (в точках, от левого верхнего угла карты) лежит координата.
  pointFor: (coord: LatLng) => Promise<{ x: number; y: number }>;
  // Попадает ли координата в видимую сейчас часть карты.
  isOnScreen: (coord: LatLng) => Promise<boolean>;
};

// Позиция «я» как пара Animated-значений — то, что отдаёт useSmoothedPosition
// (AnimatedRegion из react-native-maps; здесь нужен только этот минимум).
export type AnimatedCoord = { latitude: Animated.Value; longitude: Animated.Value };

export type FriendPin = { userId: string; lat: number; lng: number; avatar: string; ageMs: number };

// Старт ≈ INITIAL_REGION главной карты (START_DELTA 0.018 ≈ 2 км по вертикали).
const START_ZOOM = 14;
// «Найти меня» / первый фикс: старый код ставил latitudeDelta 0.005 (≈ квартал).
const LOCATE_ZOOM = 16.5;
const SOURCE_ID = 'afkaf-main-infra';
// Тап по MarkerView доходит и до самой карты как «тап по пустому месту» —
// столько миллисекунд после тапа по значку такие тапы игнорируем.
const MARKER_TAP_GUARD_MS = 400;

interface Props {
  Mapbox: MapboxModule;
  lang: Lang;
  startCenter: LatLng;
  // Уже отфильтрованные (категории + радиус) метки и точки воды.
  markers: MapMarker[];
  waterSources: WaterSource[];
  friends: FriendPin[];
  // Плавная позиция «я» и флаг «первый фикс уже был» (useSmoothedPosition).
  userCoord: AnimatedCoord;
  hasUserFix: boolean;
  // Домашняя зона (null — не настроена) и видна ли она сейчас.
  homeZone: HomeZone | null;
  homeZoneVisible: boolean;
  // Подпись для точки воды по её типу из OSM.
  waterLabel: (amenity: string) => string;
  headingAnim: Animated.Value;
  accuracy?: number;
  // Нижний отступ логотипа и «i» от низа экрана (над чипом температуры).
  ornamentBottom: number;
  ornamentLeft: number;
  // Сколько низа карты закрыто нижней панелью (константа экрана, не замер):
  // «центр» карты считается по видимой части над панелью, как на старой карте.
  bottomInset: number;
  onReady: (handle: MainMapHandle) => void;
  onMarkerPress: (marker: MapMarker) => void;
  onFriendPress: (userId: string) => void;
  onMapPress: () => void;
  // Камера движется (каждый кадр жеста) / остановилась.
  onCameraMove: (byGesture: boolean) => void;
  onCameraIdle: () => void;
}

export function MapboxMainMap({
  Mapbox, lang, startCenter, markers, waterSources, friends, userCoord, hasUserFix, homeZone,
  homeZoneVisible, waterLabel, headingAnim, accuracy, bottomInset, ornamentBottom, ornamentLeft, onReady, onMarkerPress, onFriendPress, onMapPress, onCameraMove, onCameraIdle,
}: Props) {
  const { MapView, Camera, ShapeSource, SymbolLayer, CircleLayer, FillLayer, LineLayer, Images, MarkerView } = Mapbox;
  const mapRef = useRef<InstanceType<MapboxModule['MapView']> | null>(null);
  const cameraRef = useRef<React.ComponentRef<MapboxModule['Camera']> | null>(null);
  // Отступ камеры: один и тот же объект на всю жизнь карты (первое значение пропа).
  const paddingRef = useRef({ paddingTop: 0, paddingLeft: 0, paddingRight: 0, paddingBottom: Math.max(0, bottomInset) });
  const startRef = useRef({
    centerCoordinate: toLngLat(startCenter),
    zoomLevel: START_ZOOM,
    padding: paddingRef.current,
  });
  const lastMarkerTapRef = useRef(0);

  // Инфраструктура — в слой на видеокарте, опасные метки — отдельными View.
  const infraMarkers = useMemo(() => markers.filter((m) => INFRA_MARKER_TYPES.includes(m.type)), [markers]);
  const hazardMarkers = useMemo(
    () =>
      markers.filter(
        (m) => !INFRA_MARKER_TYPES.includes(m.type) && isValidCoord({ latitude: m.lat, longitude: m.lng }),
      ),
    [markers],
  );
  const shape = useMemo(() => infraFeatureCollection(infraMarkers, waterSources), [infraMarkers, waterSources]);
  const infraById = useMemo(() => new Map(infraMarkers.map((m) => [String(m.id), m])), [infraMarkers]);

  // Подпись у точки воды из OSM (у них нет карточки метки — только «что это»).
  const [waterBubble, setWaterBubble] = useState<WaterBubbleState | null>(null);
  // Точку убрали фильтром или радиусом — подпись не должна висеть в пустоте.
  useEffect(() => {
    if (waterBubble && !waterSources.some((w) => String(w.id) === waterBubble.id)) setWaterBubble(null);
  }, [waterSources, waterBubble]);

  // Круг зоны лежит в источнике всегда (слои не перемонтируются — rnmapbox#3891),
  // а показывается и гаснет прозрачностью.
  const zoneShape = useMemo<GeoJSON.FeatureCollection>(
    () => ({ type: 'FeatureCollection', features: homeZone ? [circlePolygon(homeZone, homeZone.radiusM)] : [] }),
    [homeZone],
  );

  // Обработчики, которые экран создаёт заново на каждом рендере, держим в ref —
  // так объект handle и колбэки карты остаются стабильными.
  const cb = useRef({ onReady, onMarkerPress, onFriendPress, onMapPress, onCameraMove, onCameraIdle, waterLabel });
  cb.current = { onReady, onMarkerPress, onFriendPress, onMapPress, onCameraMove, onCameraIdle, waterLabel };

  const handle = useMemo<MainMapHandle>(
    () => ({
      centerOn: (target, durationMs) => {
        if (!isValidCoord(target)) return;
        cameraRef.current?.setCamera({
          centerCoordinate: toLngLat(target),
          zoomLevel: LOCATE_ZOOM,
          padding: paddingRef.current,
          animationMode: 'easeTo',
          animationDuration: durationMs,
        });
      },
      pointFor: async (coord) => {
        const map = mapRef.current;
        if (!map) throw new Error('map not ready');
        const [x, y] = await map.getPointInView(toLngLat(coord));
        return { x, y };
      },
      isOnScreen: async (coord) => {
        const map = mapRef.current;
        if (!map || !isValidCoord(coord)) return false;
        const [[east, north], [west, south]] = await map.getVisibleBounds();
        return (
          coord.latitude <= north && coord.latitude >= south &&
          coord.longitude <= east && coord.longitude >= west
        );
      },
    }),
    [],
  );

  const logoPosition = useMemo(() => ({ bottom: ornamentBottom, left: ornamentLeft }), [ornamentBottom, ornamentLeft]);
  const attributionPosition = useMemo(
    () => ({ bottom: ornamentBottom, left: ornamentLeft + 92 }),
    [ornamentBottom, ornamentLeft],
  );

  const handlers = useMemo(
    () => ({
      onLoaded: () => {
        mapDebug.log('MB READY');
        cb.current.onReady(handle);
      },
      onCameraChanged: (state: { gestures?: { isGestureActive?: boolean } }) =>
        cb.current.onCameraMove(!!state?.gestures?.isGestureActive),
      onMapIdle: (state: { properties?: { center?: number[]; zoom?: number }; gestures?: { isGestureActive?: boolean } }) => {
        // Отладочный оверлей (DevPanel → «Отладка карты»): где встала камера.
        if (mapDebug.enabled) {
          const c = state?.properties?.center;
          const z = state?.properties?.zoom;
          mapDebug.log(
            `MB IDLE ${c?.[1]?.toFixed(5)},${c?.[0]?.toFixed(5)},z=${z?.toFixed(2)},gesture=${!!state?.gestures?.isGestureActive}`,
          );
        }
        cb.current.onCameraIdle();
      },
      onMapPress: () => {
        if (Date.now() - lastMarkerTapRef.current < MARKER_TAP_GUARD_MS) return;
        setWaterBubble(null);
        cb.current.onMapPress();
      },
      onInfraPress: (e: { features: GeoJSON.Feature[] }) => {
        const feature = e.features[0];
        const props = (feature?.properties ?? null) as Partial<InfraPointProps> | null;
        if (!props || !props.rowId) return;
        if (props.kind === 'water') {
          // Точка воды из OSM: карточки метки нет — показываем подпись «что это»
          // (на старой карте здесь было системное окошко Apple).
          const g = feature.geometry;
          if (!g || g.type !== 'Point') return;
          lastMarkerTapRef.current = Date.now();
          cb.current.onMapPress(); // закрыть открытую карточку метки / друга
          setWaterBubble({
            id: props.rowId,
            coordinate: [g.coordinates[0], g.coordinates[1]],
            label: cb.current.waterLabel(props.title ?? ''),
          });
          return;
        }
        const marker = infraById.get(props.rowId);
        if (!marker) return;
        lastMarkerTapRef.current = Date.now();
        setWaterBubble(null);
        cb.current.onMarkerPress(marker);
      },
    }),
    [handle, infraById],
  );

  // Карта размонтирована — экран не должен дёргать мёртвую ссылку.
  useEffect(() => () => { mapRef.current = null; }, []);

  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      styleURL={MAPBOX_STYLE_URL}
      pitchEnabled={false}
      rotateEnabled={false}
      scaleBarEnabled={false}
      compassEnabled={false}
      logoEnabled
      logoPosition={logoPosition}
      attributionEnabled
      attributionPosition={attributionPosition}
      onDidFinishLoadingMap={handlers.onLoaded}
      onCameraChanged={handlers.onCameraChanged}
      onMapIdle={handlers.onMapIdle}
      onPress={handlers.onMapPress}
    >
      <Camera ref={cameraRef} defaultSettings={startRef.current} />

      {mapLabelLayers(Mapbox, lang)}

      <Images images={INFRA_IMAGES} />

      {/* Домашняя зона — под значками. Слои смонтированы всегда; виден круг только
          пока экран держит homeZoneVisible (кнопка-«глаз»), гаснет плавно. */}
      <ShapeSource id="afkaf-main-zone" shape={zoneShape}>
        <FillLayer id="afkaf-main-zone-fill" style={homeZoneVisible ? ZONE_FILL_ON : ZONE_FILL_OFF} />
        <LineLayer id="afkaf-main-zone-line" style={homeZoneVisible ? ZONE_LINE_ON : ZONE_LINE_OFF} />
      </ShapeSource>

      {/* Слои смонтированы всегда и под постоянными id — меняются только данные
          источника (rnmapbox/maps#3891). */}
      <ShapeSource id={SOURCE_ID} shape={shape} onPress={handlers.onInfraPress}>
        <CircleLayer id="afkaf-main-infra-dots" filter={INFRA_DOT_FILTER} style={INFRA_DOT_STYLE} />
        <SymbolLayer id="afkaf-main-infra-icons" minZoomLevel={SHRINK_FADE_FROM} style={INFRA_ICON_STYLE} />
      </ShapeSource>

      {/* Опасные метки: всегда значком, не сжимаются, поверх инфраструктуры. */}
      {hazardMarkers.map((m) => (
        <MarkerView key={`hz-${m.id}`} coordinate={[m.lng, m.lat]} anchor={CENTER} allowOverlap allowOverlapWithPuck>
          <Pressable
            style={styles.touchArea}
            onPress={() => {
              lastMarkerTapRef.current = Date.now();
              setWaterBubble(null);
              cb.current.onMarkerPress(m);
            }}
          >
            <View style={[styles.disc, { backgroundColor: MARKER_CONFIG[m.type]?.pinColor ?? '#6b7280' }]}>
              <Text style={styles.emoji}>{MARKER_CONFIG[m.type]?.emoji ?? '📍'}</Text>
            </View>
          </Pressable>
        </MarkerView>
      ))}

      {/* Друзья на прогулке — белый диск с эмодзи в зелёном кольце; давний пин бледнеет. */}
      {friends.map((f) => (
        <MarkerView key={`fr-${f.userId}`} coordinate={[f.lng, f.lat]} anchor={CENTER} allowOverlap allowOverlapWithPuck>
          <Pressable
            style={[styles.touchArea, f.ageMs > FRIEND_PIN_STALE_MS && styles.stale]}
            onPress={() => {
              lastMarkerTapRef.current = Date.now();
              setWaterBubble(null);
              cb.current.onFriendPress(f.userId);
            }}
          >
            <View style={styles.friendDisc}>
              <Text style={styles.emoji}>{f.avatar}</Text>
            </View>
          </Pressable>
        </MarkerView>
      ))}

      {/* Подпись у точки воды: над значком, тап по ней закрывает. */}
      {waterBubble && (
        <MarkerView coordinate={waterBubble.coordinate} anchor={BOTTOM_CENTER} allowOverlap allowOverlapWithPuck>
          <Pressable
            style={styles.bubbleWrap}
            onPress={() => {
              lastMarkerTapRef.current = Date.now();
              setWaterBubble(null);
            }}
          >
            <View style={styles.bubble}>
              <Text style={styles.bubbleText} numberOfLines={1}>
                {MARKER_CONFIG.water.emoji} {waterBubble.label}
              </Text>
            </View>
          </Pressable>
        </MarkerView>
      )}

      {/* «Я» — последним, чтобы лежал поверх остальных значков. Тапов не ловит. */}
      {hasUserFix && (
        <MeMarker MarkerView={MarkerView} coord={userCoord} headingAnim={headingAnim} accuracy={accuracy} />
      )}
    </MapView>
  );
}

type WaterBubbleState = { id: string; coordinate: [number, number]; label: string };

// Маркер «я». Позицию ведёт Animated-пара из useSmoothedPosition: между фиксами
// она плавно едет 400 мс. MarkerView анимированных координат не понимает, поэтому
// значение читаем сами — не чаще раза в кадр — и перерисовываем ТОЛЬКО этот
// маленький компонент, а не всю карту с метками.
function MeMarker({
  MarkerView, coord, headingAnim, accuracy,
}: {
  MarkerView: MapboxModule['MarkerView'];
  coord: AnimatedCoord;
  headingAnim: Animated.Value;
  accuracy?: number;
}) {
  const [pos, setPos] = useState<LatLng>(() => readCoord(coord));
  useEffect(() => {
    let frame: number | null = null;
    const schedule = () => {
      if (frame != null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        setPos(readCoord(coord));
      });
    };
    const latSub = coord.latitude.addListener(schedule);
    const lngSub = coord.longitude.addListener(schedule);
    schedule(); // значение могло смениться между первым рендером и подпиской
    return () => {
      coord.latitude.removeListener(latSub);
      coord.longitude.removeListener(lngSub);
      if (frame != null) cancelAnimationFrame(frame);
    };
  }, [coord]);

  if (!isValidCoord(pos)) return null;
  return (
    <MarkerView coordinate={toLngLat(pos)} anchor={CENTER} allowOverlap allowOverlapWithPuck>
      <View pointerEvents="none">
        <UserLocationMarker headingAnim={headingAnim} accuracy={accuracy} />
      </View>
    </MarkerView>
  );
}

function readCoord(coord: AnimatedCoord): LatLng {
  // __getValue — штатный способ синхронно прочитать Animated.Value (в типах его нет).
  const read = (v: Animated.Value) => (v as unknown as { __getValue: () => number }).__getValue();
  return { latitude: read(coord.latitude), longitude: read(coord.longitude) };
}

const CENTER = { x: 0.5, y: 0.5 };
const BOTTOM_CENTER = { x: 0.5, y: 1 };

// Домашняя зона: зелёная полупрозрачная заливка с контуром; появляется и гаснет
// за ZONE_FADE_MS. Стили — константы (стабильные ссылки).
const ZONE_FADE_MS = 350;
const ZONE_FADE = { duration: ZONE_FADE_MS, delay: 0 };
const ZONE_FILL_ON = { fillColor: '#2c5f25', fillOpacity: 0.18, fillOpacityTransition: ZONE_FADE } as never;
const ZONE_FILL_OFF = { fillColor: '#2c5f25', fillOpacity: 0, fillOpacityTransition: ZONE_FADE } as never;
const ZONE_LINE_ON = { lineColor: '#2c5f25', lineWidth: 2, lineOpacity: 0.9, lineOpacityTransition: ZONE_FADE } as never;
const ZONE_LINE_OFF = { lineColor: '#2c5f25', lineWidth: 2, lineOpacity: 0, lineOpacityTransition: ZONE_FADE } as never;

// Те же размеры, что у MapMarkerIcon / FriendWalkerMarker на старой карте.
const TOUCH_SIZE = 44;
const DISC_SIZE = 38;

const styles = StyleSheet.create({
  touchArea: { width: TOUCH_SIZE, height: TOUCH_SIZE, alignItems: 'center', justifyContent: 'center' },
  stale: { opacity: 0.5 },
  disc: {
    width: DISC_SIZE,
    height: DISC_SIZE,
    borderRadius: DISC_SIZE / 2,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendDisc: {
    width: DISC_SIZE,
    height: DISC_SIZE,
    borderRadius: DISC_SIZE / 2,
    borderWidth: 3,
    borderColor: '#2c5f25',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 18, lineHeight: 20, textAlign: 'center', includeFontPadding: false },
  // Подпись стоит НАД значком воды: нижний отступ ≈ половина значка + зазор.
  bubbleWrap: { paddingBottom: 24, alignItems: 'center' },
  bubble: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: 220,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  bubbleText: { fontSize: 14, lineHeight: 18, color: '#1f2937' },
});
