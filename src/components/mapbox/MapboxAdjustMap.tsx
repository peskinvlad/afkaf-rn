import React, { useMemo, useRef } from 'react';
import { StyleSheet } from 'react-native';
import type { Lang } from '../../i18n';
import { LatLng, haversine, isValidCoord } from '../../lib/geo';
import { MapboxModule, mapLabelLayers, MAPBOX_STYLE_URL } from '../../lib/mapbox';
import { circlePolygon, clampToRadius, fromLngLat, toLngLat } from '../../lib/mapboxGeo';
import { colors } from '../../theme/tokens';

// Mapbox-версия карты на экране добавления метки (этап 2 переезда). Поведение то
// же, что у старой карты в AddMarkerScreen:
//   • метка — всегда центр карты (красный пин рисует сам экран поверх карты);
//   • двигать можно только в круге radiusM вокруг GPS-фикса; увели дальше —
//     карта мягко возвращается на край круга;
//   • отдалиться дальше «квартала» нельзя;
//   • без точного фикса (нет разрешения) карта неподвижна, на месте запасной
//     точки — красный кружок, круга нет.

// Старая карта открывалась с latitudeDelta 0.004 на 204 pt высоты ≈ 2,2 м в точке
// = зум 14,9 у Mapbox (плитка 512 pt). Круг 150 м ≈ 138 pt в диаметре — влезает.
const START_ZOOM = 14.9;
// Раньше отдаление ограничивал cameraZoomRange (≈ «зум 15» плитки 256) = 14 здесь.
const MIN_ZOOM = 14;
const MAX_ZOOM = 19;
const SNAP_MS = 250;
// Допуск на край круга: точка, поставленная ровно на границу, после округлений
// может оказаться на сантиметры снаружи — без допуска карта «возвращала» бы её
// снова и снова.
const EDGE_TOLERANCE_M = 1;

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

const CIRCLE_FILL_STYLE = { fillColor: 'rgba(44,95,37,0.12)' } as const;
const CIRCLE_LINE_STYLE = { lineColor: colors.primary, lineWidth: 1.5 } as const;
const FALLBACK_DOT_STYLE = {
  circleColor: '#ef4444',
  circleRadius: 9,
  circleStrokeColor: '#ffffff',
  circleStrokeWidth: 3,
} as const;

interface Props {
  Mapbox: MapboxModule;
  lang: Lang;
  // GPS-фикс: центр круга и якорь ограничения. Не меняется, пока карта на экране.
  anchor: LatLng;
  radiusM: number;
  // true — фикс точный: круг виден, карту можно двигать. false — запасная точка.
  adjustable: boolean;
  // Точка, которая будет сохранена (центр карты, уже прижатый к кругу).
  onPoint: (point: LatLng) => void;
}

export function MapboxAdjustMap({ Mapbox, lang, anchor, radiusM, adjustable, onPoint }: Props) {
  const { MapView, Camera, ShapeSource, FillLayer, LineLayer, CircleLayer } = Mapbox;
  const cameraRef = useRef<React.ComponentRef<MapboxModule['Camera']> | null>(null);

  // Старт камеры — один раз (экран монтирует карту уже с готовым фиксом).
  const startRef = useRef({ centerCoordinate: toLngLat(anchor), zoomLevel: START_ZOOM });

  const circle = useMemo(
    () => (adjustable ? circlePolygon(anchor, radiusM) : EMPTY),
    [adjustable, anchor, radiusM],
  );
  const fallbackDot = useMemo<GeoJSON.FeatureCollection | GeoJSON.Feature>(
    () =>
      adjustable
        ? EMPTY
        : { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: toLngLat(anchor) } },
    [adjustable, anchor],
  );

  // Карта остановилась: центр внутри круга — это и есть точка метки; снаружи —
  // точка встаёт на край, карта доезжает туда же. Событие от нашего же возврата
  // приходит уже с центром на краю (в пределах допуска) и второй раз не двигает.
  function handleIdle(state: { properties: { center: GeoJSON.Position } }) {
    if (!adjustable) return;
    const center = fromLngLat(state.properties.center);
    if (!isValidCoord(center)) return;
    const distM = haversine(anchor, center) * 1000;
    if (distM <= radiusM + EDGE_TOLERANCE_M) {
      onPoint(center);
      return;
    }
    const snapped = clampToRadius(anchor, center, distM, radiusM);
    onPoint(snapped);
    cameraRef.current?.setCamera({
      centerCoordinate: toLngLat(snapped),
      animationMode: 'easeTo',
      animationDuration: SNAP_MS,
    });
  }

  return (
    <MapView
      style={StyleSheet.absoluteFill}
      styleURL={MAPBOX_STYLE_URL}
      scrollEnabled={adjustable}
      zoomEnabled={adjustable}
      pitchEnabled={false}
      rotateEnabled={false}
      scaleBarEnabled={false}
      compassEnabled={false}
      logoEnabled
      logoPosition={LOGO_POSITION}
      attributionEnabled
      attributionPosition={ATTRIBUTION_POSITION}
      onMapIdle={handleIdle}
    >
      <Camera
        ref={cameraRef}
        defaultSettings={startRef.current}
        minZoomLevel={MIN_ZOOM}
        maxZoomLevel={MAX_ZOOM}
      />

      {mapLabelLayers(Mapbox, lang)}

      {/* Оба источника и все слои смонтированы всегда (rnmapbox/maps#3891):
          «нет круга» и «нет запасной точки» — это пустые данные, а не снятый слой. */}
      <ShapeSource id="afkaf-adjust-circle" shape={circle}>
        <FillLayer id="afkaf-adjust-circle-fill" style={CIRCLE_FILL_STYLE} />
        <LineLayer id="afkaf-adjust-circle-line" style={CIRCLE_LINE_STYLE} />
      </ShapeSource>
      <ShapeSource id="afkaf-adjust-fallback" shape={fallbackDot}>
        <CircleLayer id="afkaf-adjust-fallback-dot" style={FALLBACK_DOT_STYLE} />
      </ShapeSource>
    </MapView>
  );
}

// Карта на этом экране невысокая (204 pt): логотип и «i» — в нижних углах,
// плотно к краю, чтобы не налезать на круг.
const LOGO_POSITION = { bottom: 6, left: 8 };
const ATTRIBUTION_POSITION = { bottom: 6, right: 8 };
