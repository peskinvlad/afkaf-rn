import React, { useMemo, useRef } from 'react';
import { StyleSheet } from 'react-native';
import type { Lang } from '../../i18n';
import { LatLng, isValidCoord } from '../../lib/geo';
import { MapboxModule, mapLabelLayers, MAPBOX_STYLE_URL } from '../../lib/mapbox';
import { fromLngLat, toLngLat } from '../../lib/mapboxGeo';

// Mapbox-версия карты на экране домашней зоны (этап 1 переезда): голая карта,
// которую двигают под неподвижным кругом. Сам круг и точка — обычные View поверх
// карты в PrivacyRadiusScreen (как и раньше); эта карта только сообщает наверх
// свою камеру, чтобы экран (а) рисовал круг в НАСТОЯЩЕМ масштабе и (б) сохранял
// центр карты как дом.
//
// Отличие от старой карты: там круг считался для фиксированного «зума 15» и при
// щипке переставал соответствовать метрам. Здесь размер круга идёт от живого
// зума, поэтому радиус на экране честный на любом приближении.

// Старый экран открывался с «зумом 15» плитки 256 pt = зум 14 у Mapbox (плитка
// 512 pt): ≈4 м в точке, круг 500 м помещается по ширине экрана.
export const ZONE_START_ZOOM = 14;
// Дальше 12 круг 50 м превращается в точку; ближе 17 круг 500 м — уже в разы шире экрана.
const ZONE_MIN_ZOOM = 12;
const ZONE_MAX_ZOOM = 17;

export type ZoneCamera = { center: LatLng; zoom: number };

interface Props {
  Mapbox: MapboxModule;
  lang: Lang;
  // Где открыть карту. Читается один раз при монтировании.
  initialCenter: LatLng;
  // Камера сдвинулась/изменила зум. Зовётся часто (во время жеста) — экран сам
  // решает, когда перерисовываться.
  onCamera: (camera: ZoneCamera) => void;
}

export function MapboxZoneMap({ Mapbox, lang, initialCenter, onCamera }: Props) {
  const { MapView, Camera } = Mapbox;

  // defaultSettings — неуправляемый старт камеры (как initialRegion): фиксируем
  // первое значение, чтобы смена userLocation в useApp не дёргала карту из-под
  // пальца.
  const startRef = useRef({ centerCoordinate: toLngLat(initialCenter), zoomLevel: ZONE_START_ZOOM });

  const handlers = useMemo(() => {
    const report = (state: { properties: { center: GeoJSON.Position; zoom: number } }) => {
      const center = fromLngLat(state.properties.center);
      const zoom = state.properties.zoom;
      if (!isValidCoord(center) || !Number.isFinite(zoom)) return;
      onCamera({ center, zoom });
    };
    return { onCameraChanged: report, onMapIdle: report };
  }, [onCamera]);

  return (
    <MapView
      style={StyleSheet.absoluteFillObject}
      styleURL={MAPBOX_STYLE_URL}
      // Круг — плоский View поверх карты: наклон и поворот сделали бы его неправдой.
      pitchEnabled={false}
      rotateEnabled={false}
      scaleBarEnabled={false}
      compassEnabled={false}
      logoEnabled
      logoPosition={LOGO_POSITION}
      attributionEnabled
      attributionPosition={ATTRIBUTION_POSITION}
      onCameraChanged={handlers.onCameraChanged}
      onMapIdle={handlers.onMapIdle}
    >
      <Camera
        defaultSettings={startRef.current}
        minZoomLevel={ZONE_MIN_ZOOM}
        maxZoomLevel={ZONE_MAX_ZOOM}
      />
      {mapLabelLayers(Mapbox, lang)}
    </MapView>
  );
}

const LOGO_POSITION = { bottom: 10, left: 12 };
const ATTRIBUTION_POSITION = { bottom: 10, right: 12 };
