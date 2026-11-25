import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useApp } from '../hooks/useApp';
import { useMapMarkers } from '../hooks/useMapMarkers';
import { INFRA_MARKER_TYPES } from '../lib/markerConfig';
import { ANDROID_MARKER_IMAGES } from '../lib/markerImages';
import { START_COORD, isValidCoord } from '../lib/geo';
import {
  getMapbox,
  mapLabelLayers,
  MapboxModule,
  MAPBOX_STYLE_URL,
  MAPBOX_TOKEN,
} from '../lib/mapbox';
import { colors, radii, shadows, typography } from '../theme/tokens';

// Фаза 1 переезда на Mapbox (docs/MAPBOX-RECON.md): тестовый экран, вход из
// DevPanel. Отвечает на вопрос «живой ли Mapbox у нас»: стиль и подписи на
// нужном языке, ~1660 точек одним слоем на видеокарте, кластеры, тап, своя
// позиция, логотип. Остальные экраны по-прежнему на react-native-maps.

const BRAND_GREEN = '#2c5f25';

// Mapbox считает координаты как [долгота, широта] — обратно нашему LatLng.
const START_CENTER: [number, number] = [START_COORD.longitude, START_COORD.latitude];
// ≈ охват INITIAL_REGION на MapScreen (START_DELTA 0.018 ≈ 2 км по вертикали).
const START_ZOOM = 14;
// Стабильная ссылка — привычка из правил про MapView, здесь тоже не повредит.
const CAMERA_DEFAULTS = { centerCoordinate: START_CENTER, zoomLevel: START_ZOOM };

// Те же PNG, что рисует Android-ветка (assets/markers, scripts/gen-marker-pngs.ts).
// Эмодзи слой Mapbox текстом не рисует — только картинками.
const ICON_PREFIX = 'marker-';
const MARKER_IMAGES: Record<string, number> = Object.fromEntries(
  Object.entries(ANDROID_MARKER_IMAGES).map(([type, source]) => [ICON_PREFIX + type, source]),
);

const SOURCE_ID = 'afkaf-points';
// Второй источник с теми же точками, но БЕЗ кластеризации — для режима «сжатие».
// Кластеризацию у уже созданного источника менять нельзя, поэтому источников два,
// оба смонтированы всегда, а режим переключает только видимость слоёв.
const FLAT_SOURCE_ID = 'afkaf-points-flat';

// Режим показа точек при отдалении (сравнение на тестовом экране):
//   cluster — близкие точки слипаются в кружок с числом (как было);
//   shrink  — идея Ани, «как в Google Maps»: издалека цветные точки, при
//             приближении они вырастают в значки. Чисел нет.
type ZoomMode = 'cluster' | 'shrink';

const DOT_BLUE = '#3b82f6';

// Границы «сжатия» по зуму. Точка → значок: перекрёстное затухание между
// SHRINK_FADE_FROM и SHRINK_FADE_TO; значок дорастает до полного размера к
// SHRINK_FULL_ZOOM. Числа подобраны на глаз — крутить здесь.
const SHRINK_FADE_FROM = 13;
const SHRINK_FADE_TO = 13.8;
const SHRINK_FULL_ZOOM = 16.5;

// Прореживание издалека: на виде «весь Гуш-Дан» 1660 точек сливаются, поэтому
// типы появляются по очереди. Собачьи площадки видны всегда (главные точки
// назначения), парки — с DOTS_PARKS_FROM, вода — с DOTS_WATER_FROM.
const DOTS_PARKS_FROM = 11;
const DOTS_WATER_FROM = 12;
const DOT_FADE = 0.3; // за сколько единиц зума новая группа точек проявляется

// Непрозрачность точки по зуму и типу. ['zoom'] в Mapbox можно ставить только
// входом верхнего interpolate/step, поэтому «появление по типу» и «угасание в
// значок» собраны в ОДНУ шкалу, а различие по типу — в значениях её ступеней.
const ONLY_DOG_PARKS = ['match', ['get', 'type'], 'dog_park', 1, 0];
const PARKS_TOO = ['match', ['get', 'type'], 'water', 0, 1];
const DOT_OPACITY = [
  'interpolate', ['linear'], ['zoom'],
  DOTS_PARKS_FROM, ONLY_DOG_PARKS,
  DOTS_PARKS_FROM + DOT_FADE, PARKS_TOO,
  DOTS_WATER_FROM, PARKS_TOO,
  DOTS_WATER_FROM + DOT_FADE, 1,
  SHRINK_FADE_FROM, 1,
  SHRINK_FADE_TO, 0,
];
// Тот же порядок появления — фильтром, чтобы ещё невидимая точка не ловила тап.
const DOT_FILTER = [
  'step', ['zoom'],
  ['==', ['get', 'type'], 'dog_park'],
  DOTS_PARKS_FROM, ['!=', ['get', 'type'], 'water'],
  DOTS_WATER_FROM, true,
];

type LayerVisibility = 'visible' | 'none';
const vis = (on: boolean): LayerVisibility => (on ? 'visible' : 'none');

type PointProps = {
  kind: 'marker' | 'water';
  type: string;
  title: string;
  icon: string;
};

interface Props {
  navigation: any;
}

export function MapboxTestScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const Mapbox = getMapbox();

  // Нет нативного модуля (сборка без Mapbox) или токена — объясняем, не падаем.
  const problem = !Mapbox
    ? 'В этой сборке нет нативной части Mapbox.\nНужен dev-клиент, собранный с APP_VARIANT=dev.'
    : !MAPBOX_TOKEN
      ? 'Не задан EXPO_PUBLIC_MAPBOX_TOKEN в .env.'
      : null;

  return (
    <View style={styles.root}>
      {Mapbox && !problem ? (
        <MapboxMap Mapbox={Mapbox} />
      ) : (
        <View style={styles.problem}>
          <Text style={styles.problemTxt}>{problem}</Text>
        </View>
      )}
      <TouchableOpacity
        style={[styles.backBtn, shadows.sm, { top: insets.top + 8 }]}
        onPress={() => navigation.goBack()}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Text style={styles.backTxt}>←</Text>
      </TouchableOpacity>
    </View>
  );
}

function MapboxMap({ Mapbox }: { Mapbox: MapboxModule }) {
  const { MapView, Camera, ShapeSource, SymbolLayer, CircleLayer, Images, MarkerView } = Mapbox;
  const insets = useSafeAreaInsets();
  const { lang } = useApp();
  const { markers, waterSources } = useMapMarkers();

  const cameraRef = useRef<React.ComponentRef<MapboxModule['Camera']> | null>(null);
  const sourceRef = useRef<InstanceType<MapboxModule['ShapeSource']> | null>(null);
  const [mapStatus, setMapStatus] = useState('загрузка…');
  const [zoomMode, setZoomMode] = useState<ZoomMode>('cluster');
  // Текущий зум — только для подписи в плашке (помогает подбирать границы
  // сжатия). Обновляется, когда карта остановилась, а не на каждом кадре.
  const [zoom, setZoom] = useState<number>(START_ZOOM);
  const clusterOn = zoomMode === 'cluster';

  // Постоянные метки (инфраструктура куратора) + точки воды из OSM — те же
  // данные и тот же хук, что на MapScreen.
  const permanent = useMemo(
    () => markers.filter((m) => INFRA_MARKER_TYPES.includes(m.type)),
    [markers],
  );

  const shape = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point, PointProps>>(() => {
    const features: GeoJSON.Feature<GeoJSON.Point, PointProps>[] = [];
    for (const m of permanent) {
      if (!isValidCoord({ latitude: m.lat, longitude: m.lng })) continue;
      features.push({
        type: 'Feature',
        id: `m-${m.id}`,
        geometry: { type: 'Point', coordinates: [m.lng, m.lat] },
        properties: {
          kind: 'marker',
          type: m.type,
          title: m.description?.trim() || m.type,
          icon: ICON_PREFIX + (MARKER_IMAGES[ICON_PREFIX + m.type] ? m.type : 'park'),
        },
      });
    }
    for (const w of waterSources) {
      if (!isValidCoord({ latitude: w.lat, longitude: w.lng })) continue;
      features.push({
        type: 'Feature',
        id: `w-${w.id}`,
        geometry: { type: 'Point', coordinates: [w.lng, w.lat] },
        properties: {
          kind: 'water',
          type: 'water',
          title: w.amenity ?? 'water',
          icon: ICON_PREFIX + 'water',
        },
      });
    }
    return { type: 'FeatureCollection', features };
  }, [permanent, waterSources]);

  // Своя позиция — из expo-location, как на остальных экранах. LocationPuck не
  // используем: у него утечка на Android (rnmapbox/maps#4225) и он идёт мимо
  // нашего GPS-фильтра.
  const [me, setMe] = useState<[number, number] | null>(null);
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || cancelled) return;
      const s = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 2000, distanceInterval: 3 },
        (loc) => {
          const pt = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
          if (isValidCoord(pt)) setMe([pt.longitude, pt.latitude]);
        },
      );
      if (cancelled) s.remove();
      else sub = s;
    })();
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, []);

  // Логотип и кнопка «i» (атрибуция + отказ от телеметрии) обязательны по
  // условиям Mapbox. Держим их в левом нижнем углу над home-индикатором,
  // ничем не перекрытыми; позиции — константы экрана, без замеров.
  const logoPosition = useMemo(() => ({ bottom: insets.bottom + 10, left: 12 }), [insets.bottom]);
  const attributionPosition = useMemo(
    () => ({ bottom: insets.bottom + 10, left: 104 }),
    [insets.bottom],
  );

  async function handlePointPress(e: { features: GeoJSON.Feature[] }) {
    const feature = e.features[0];
    if (!feature) return;
    const props = (feature.properties ?? {}) as Partial<PointProps> & {
      cluster?: boolean;
      point_count?: number;
    };

    // Тап по кластеру — приблизиться настолько, чтобы он распался.
    if (props.cluster) {
      try {
        const zoom = await sourceRef.current?.getClusterExpansionZoom(feature);
        const center = (feature.geometry as GeoJSON.Point).coordinates as [number, number];
        if (typeof zoom === 'number') {
          cameraRef.current?.setCamera({
            centerCoordinate: center,
            zoomLevel: zoom + 0.5,
            animationDuration: 350,
          });
        }
      } catch (err) {
        console.warn('[MapboxTest] cluster zoom failed:', err);
      }
      return;
    }

    Alert.alert(props.title ?? '—', `Тип: ${props.type ?? '?'}\nИсточник: ${props.kind === 'water' ? 'water_sources' : 'markers'}`);
  }

  function handleCenterOnMe() {
    if (!me) return;
    cameraRef.current?.setCamera({ centerCoordinate: me, zoomLevel: 16, animationDuration: 350 });
  }

  return (
    <>
      <MapView
        style={StyleSheet.absoluteFill}
        styleURL={MAPBOX_STYLE_URL}
        logoEnabled
        logoPosition={logoPosition}
        attributionEnabled
        attributionPosition={attributionPosition}
        scaleBarEnabled={false}
        compassEnabled={false}
        pitchEnabled={false}
        onDidFinishLoadingMap={() => setMapStatus('карта загружена')}
        onMapLoadingError={() => setMapStatus('ошибка загрузки карты')}
        onMapIdle={(state) => {
          const z = state?.properties?.zoom;
          if (typeof z === 'number') setZoom(z);
        }}
      >
        <Camera ref={cameraRef} defaultSettings={CAMERA_DEFAULTS} />

        {/* Подписи: he/ru → иврит, en → английский (lib/mapbox.ts). */}
        {mapLabelLayers(Mapbox, lang)}

        <Images images={MARKER_IMAGES} />

        {/* Все слои смонтированы всегда и под постоянными id — меняются только
            данные источника (rnmapbox/maps#3891: краш при частой вставке/удалении
            дочерних слоёв). */}
        <ShapeSource
          ref={sourceRef}
          id={SOURCE_ID}
          shape={shape}
          cluster
          clusterRadius={48}
          clusterMaxZoomLevel={14}
          onPress={handlePointPress}
        >
          <CircleLayer
            id="afkaf-clusters"
            filter={['has', 'point_count']}
            style={{
              circleColor: BRAND_GREEN,
              circleRadius: ['step', ['get', 'point_count'], 16, 25, 20, 100, 25, 400, 31],
              circleStrokeColor: '#ffffff',
              circleStrokeWidth: 2,
              visibility: vis(clusterOn),
            }}
          />
          <SymbolLayer
            id="afkaf-cluster-count"
            filter={['has', 'point_count']}
            style={{
              textField: ['get', 'point_count_abbreviated'],
              textSize: 13,
              textColor: '#ffffff',
              textAllowOverlap: true,
              textIgnorePlacement: true,
              visibility: vis(clusterOn),
            }}
          />
          <SymbolLayer
            id="afkaf-points-layer"
            filter={['!', ['has', 'point_count']]}
            style={{
              iconImage: ['get', 'icon'],
              iconAllowOverlap: true,
              iconIgnorePlacement: true,
              visibility: vis(clusterOn),
            }}
          />
        </ShapeSource>

        {/* Режим «сжатие»: те же точки без кластеров. Издалека — цветная точка
            (вода синяя, парки и площадки зелёные), при приближении она гаснет,
            а на её месте проявляется и растёт значок. */}
        <ShapeSource id={FLAT_SOURCE_ID} shape={shape} onPress={handlePointPress}>
          <CircleLayer
            id="afkaf-flat-dots"
            filter={DOT_FILTER as never}
            style={{
              circleColor: ['match', ['get', 'type'], 'water', DOT_BLUE, BRAND_GREEN],
              circleRadius: ['interpolate', ['linear'], ['zoom'], 9, 1.5, 12, 3, SHRINK_FADE_FROM, 5],
              circleStrokeColor: '#ffffff',
              circleStrokeWidth: ['interpolate', ['linear'], ['zoom'], 9, 0, 12, 1, SHRINK_FADE_FROM, 1.5],
              circleOpacity: DOT_OPACITY as never,
              circleStrokeOpacity: DOT_OPACITY as never,
              visibility: vis(!clusterOn),
            }}
          />
          <SymbolLayer
            id="afkaf-flat-icons"
            minZoomLevel={SHRINK_FADE_FROM}
            style={{
              iconImage: ['get', 'icon'],
              iconSize: ['interpolate', ['linear'], ['zoom'], SHRINK_FADE_FROM, 0.45, 15, 0.75, SHRINK_FULL_ZOOM, 1],
              iconOpacity: ['interpolate', ['linear'], ['zoom'], SHRINK_FADE_FROM, 0, SHRINK_FADE_TO, 1],
              iconAllowOverlap: true,
              iconIgnorePlacement: true,
              visibility: vis(!clusterOn),
            }}
          />
        </ShapeSource>

        {me && (
          <MarkerView coordinate={me} anchor={ME_ANCHOR} allowOverlap>
            <View style={styles.meDot} />
          </MarkerView>
        )}
      </MapView>

      {/* Счётчик — сколько точек реально загружено из тех же хуков. */}
      <View style={[styles.counter, shadows.sm, { top: insets.top + 8 }]} pointerEvents="none">
        <Text style={styles.counterTxt}>
          точек: {shape.features.length} · метки {permanent.length} · вода {waterSources.length}
        </Text>
        <Text style={styles.counterSub}>
          {mapStatus} · язык {lang} · GPS {me ? 'есть' : 'нет'} · зум {zoom.toFixed(1)}
        </Text>
      </View>

      {/* Переключатель режима — сравнить кластеры и «сжатие» на одних данных. */}
      <TouchableOpacity
        style={[styles.modeBtn, shadows.sm, { top: insets.top + 64 }]}
        onPress={() => setZoomMode((m) => (m === 'cluster' ? 'shrink' : 'cluster'))}
        activeOpacity={0.8}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.modeTxt}>
          {clusterOn ? 'Режим: кластеры' : 'Режим: сжатие'} · сменить
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.locateBtn, shadows.sm, { bottom: insets.bottom + 56 }]}
        onPress={handleCenterOnMe}
        activeOpacity={0.8}
      >
        <Text style={styles.locateTxt}>◎</Text>
      </TouchableOpacity>
    </>
  );
}

const ME_ANCHOR = { x: 0.5, y: 0.5 };

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  problem: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  problemTxt: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  backBtn: {
    position: 'absolute',
    left: 14,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backTxt: { fontSize: 20, color: colors.ink },
  counter: {
    position: 'absolute',
    right: 14,
    backgroundColor: colors.white,
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  counterTxt: { ...typography.xs, color: colors.ink, fontFamily: 'Nunito_700Bold' },
  counterSub: { ...typography.xs, color: colors.textMuted },
  modeBtn: {
    position: 'absolute',
    right: 14,
    minHeight: 44,
    justifyContent: 'center',
    backgroundColor: BRAND_GREEN,
    borderRadius: radii.sm,
    paddingHorizontal: 14,
  },
  modeTxt: { ...typography.xs, color: colors.white, fontFamily: 'Nunito_700Bold' },
  locateBtn: {
    position: 'absolute',
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locateTxt: { fontSize: 22, color: BRAND_GREEN },
  meDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: BRAND_GREEN,
    borderWidth: 3,
    borderColor: '#ffffff',
  },
});
