import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import type { Lang } from '../../i18n';
import { LatLng } from '../../lib/geo';
import { MapboxModule, mapLabelLayers, MAPBOX_STYLE_URL } from '../../lib/mapbox';
import { toLngLat, trackBounds, trackLine } from '../../lib/mapboxGeo';

// Mapbox-версия карты на экране итогов прогулки (этап 1 переезда,
// docs/MAPBOX-MIGRATION.md): статичная карта без жестов, трек линией, камера
// вписывает трек в видимую часть. Рисуется только при useMapEngine() === 'mapbox';
// старая карта (react-native-maps) остаётся в WalkSummaryScreen как была.

const TRACK_COLOR = '#2c5f25';
const EMPTY_LINE: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
const LINE_STYLE = {
  lineColor: TRACK_COLOR,
  lineWidth: 4,
  lineCap: 'round',
  lineJoin: 'round',
} as const;

// Трека нет (старт и финиш в одной точке, GPS не дал ни одного фикса).
const FALLBACK_ZOOM = 15;

interface Props {
  Mapbox: MapboxModule;
  lang: Lang;
  route: LatLng[];
  // Точка, на которой центрировать карту, когда трека нет.
  fallbackCenter: LatLng;
  // Сколько точек сверху занято чипами экрана («Готово», километры) — трек под
  // них не заезжает.
  topInset: number;
}

export function MapboxTrackMap({ Mapbox, lang, route, fallbackCenter, topInset }: Props) {
  const { MapView, Camera, ShapeSource, LineLayer } = Mapbox;

  // Экран передаёт трек из параметров навигации; когда их нет, значение по
  // умолчанию — новый пустой массив на каждый рендер. Поэтому мемоизируем по
  // содержимому (длина + концы), а не по ссылке: иначе источник перезаливался бы
  // в натив при любой перерисовке экрана.
  const first = route[0];
  const last = route[route.length - 1];
  const routeKey = route.length
    ? `${route.length}:${first.latitude},${first.longitude}:${last.latitude},${last.longitude}`
    : '';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const line = useMemo(() => trackLine(route), [routeKey]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const bounds = useMemo(() => trackBounds(route), [routeKey]);

  // Стабильные ссылки на всё, что уходит в натив.
  const cameraBounds = useMemo(
    () => (line && bounds ? { ne: bounds.ne, sw: bounds.sw } : undefined),
    [line, bounds],
  );
  const padding = useMemo(
    () => ({ paddingTop: topInset, paddingRight: 40, paddingBottom: 48, paddingLeft: 40 }),
    [topInset],
  );
  // defaultSettings читается нативом один раз при монтировании — считаем один раз.
  const fallback = useMemo(
    () => ({ centerCoordinate: toLngLat(bounds ? midpoint(bounds) : fallbackCenter), zoomLevel: FALLBACK_ZOOM }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bounds],
  );

  return (
    <MapView
      style={StyleSheet.absoluteFill}
      styleURL={MAPBOX_STYLE_URL}
      scrollEnabled={false}
      zoomEnabled={false}
      pitchEnabled={false}
      rotateEnabled={false}
      scaleBarEnabled={false}
      compassEnabled={false}
      logoEnabled
      logoPosition={LOGO_POSITION}
      attributionEnabled
      attributionPosition={ATTRIBUTION_POSITION}
    >
      {cameraBounds ? (
        <Camera bounds={cameraBounds} padding={padding} animationMode="none" animationDuration={0} />
      ) : (
        <Camera defaultSettings={fallback} />
      )}

      {mapLabelLayers(Mapbox, lang)}

      {/* Источник и слой смонтированы всегда (rnmapbox/maps#3891) — без трека
          источник просто пустой. */}
      <ShapeSource id="afkaf-summary-track" shape={line ?? EMPTY_LINE}>
        <LineLayer id="afkaf-summary-track-line" style={LINE_STYLE} />
      </ShapeSource>
    </MapView>
  );
}

function midpoint(b: { ne: [number, number]; sw: [number, number] }): LatLng {
  return { latitude: (b.ne[1] + b.sw[1]) / 2, longitude: (b.ne[0] + b.sw[0]) / 2 };
}

// Логотип и «i» обязательны по условиям Mapbox. Нижние углы карты на этом экране
// свободны (чипы экрана — сверху), позиции — константы.
// bottom 16: нижняя панель экрана заходит на карту на 8 pt (marginTop: -8).
const LOGO_POSITION = { bottom: 16, left: 12 };
const ATTRIBUTION_POSITION = { bottom: 16, right: 12 };
