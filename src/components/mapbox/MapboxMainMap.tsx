import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Lang } from '../../i18n';
import { LatLng, isValidCoord } from '../../lib/geo';
import { MapboxModule, mapLabelLayers, MAPBOX_STYLE_URL } from '../../lib/mapbox';
import { toLngLat } from '../../lib/mapboxGeo';
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

// Mapbox-версия главной карты (этап 3 переезда, заход 1 — docs/MAPBOX-MIGRATION.md).
// Рисуется только при useMapEngine() === 'mapbox'; старая карта в MapScreen не тронута.
//
// Что где рисуется:
//   • площадки, парки, вода — слой на видеокарте со «сжатием» (lib/mapboxMarkers);
//   • опасные пользовательские метки — обычными View (MarkerView): их мало, они
//     всегда значком и всегда поверх инфраструктуры, эмодзи настоящие (PNG для
//     новых типов не нужны);
//   • друзья на прогулке и маркер «я» — тоже MarkerView.
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
};

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
  userLocation: LatLng | null;
  headingAnim: Animated.Value;
  accuracy?: number;
  // Нижний отступ логотипа и «i» от низа экрана (над чипом температуры).
  ornamentBottom: number;
  ornamentLeft: number;
  onReady: (handle: MainMapHandle) => void;
  onMarkerPress: (marker: MapMarker) => void;
  onFriendPress: (userId: string) => void;
  onMapPress: () => void;
  // Камера движется (каждый кадр жеста) / остановилась.
  onCameraMove: (byGesture: boolean) => void;
  onCameraIdle: () => void;
}

export function MapboxMainMap({
  Mapbox, lang, startCenter, markers, waterSources, friends, userLocation, headingAnim, accuracy,
  ornamentBottom, ornamentLeft, onReady, onMarkerPress, onFriendPress, onMapPress, onCameraMove, onCameraIdle,
}: Props) {
  const { MapView, Camera, ShapeSource, SymbolLayer, CircleLayer, Images, MarkerView } = Mapbox;
  const mapRef = useRef<InstanceType<MapboxModule['MapView']> | null>(null);
  const cameraRef = useRef<React.ComponentRef<MapboxModule['Camera']> | null>(null);
  const startRef = useRef({ centerCoordinate: toLngLat(startCenter), zoomLevel: START_ZOOM });
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

  // Обработчики, которые экран создаёт заново на каждом рендере, держим в ref —
  // так объект handle и колбэки карты остаются стабильными.
  const cb = useRef({ onReady, onMarkerPress, onFriendPress, onMapPress, onCameraMove, onCameraIdle });
  cb.current = { onReady, onMarkerPress, onFriendPress, onMapPress, onCameraMove, onCameraIdle };

  const handle = useMemo<MainMapHandle>(
    () => ({
      centerOn: (target, durationMs) => {
        if (!isValidCoord(target)) return;
        cameraRef.current?.setCamera({
          centerCoordinate: toLngLat(target),
          zoomLevel: LOCATE_ZOOM,
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
      onLoaded: () => cb.current.onReady(handle),
      onCameraChanged: (state: { gestures?: { isGestureActive?: boolean } }) =>
        cb.current.onCameraMove(!!state?.gestures?.isGestureActive),
      onMapIdle: () => cb.current.onCameraIdle(),
      onMapPress: () => {
        if (Date.now() - lastMarkerTapRef.current < MARKER_TAP_GUARD_MS) return;
        cb.current.onMapPress();
      },
      onInfraPress: (e: { features: GeoJSON.Feature[] }) => {
        const props = (e.features[0]?.properties ?? null) as Partial<InfraPointProps> | null;
        // Точки воды из OSM карточки не имеют — тап по ним пока ничего не открывает
        // (на старой карте там было системное окошко; своё — в следующем заходе).
        if (!props || props.kind !== 'marker' || !props.rowId) return;
        const marker = infraById.get(props.rowId);
        if (!marker) return;
        lastMarkerTapRef.current = Date.now();
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
              cb.current.onFriendPress(f.userId);
            }}
          >
            <View style={styles.friendDisc}>
              <Text style={styles.emoji}>{f.avatar}</Text>
            </View>
          </Pressable>
        </MarkerView>
      ))}

      {/* «Я» — последним, чтобы лежал поверх остальных значков. Тапов не ловит. */}
      {userLocation && isValidCoord(userLocation) && (
        <MarkerView coordinate={toLngLat(userLocation)} anchor={CENTER} allowOverlap allowOverlapWithPuck>
          <View pointerEvents="none">
            <UserLocationMarker headingAnim={headingAnim} accuracy={accuracy} />
          </View>
        </MarkerView>
      )}
    </MapView>
  );
}

const CENTER = { x: 0.5, y: 0.5 };

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
});
