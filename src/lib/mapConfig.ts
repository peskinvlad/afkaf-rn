import type { CameraZoomRange } from 'react-native-maps';

// Стабильная ссылка для пропа cameraZoomRange у MapView (правило CLAUDE.md:
// объектные пропсы MapView — только константой/useMemo/state, не инлайн).
//
// Зачем: непустой объект (хотя бы одно из min/maxCenterCoordinateDistance) уводит
// нативный setCameraZoomRange в ветку `legacyZoomConstraintsEnabled = NO`
// (react-native-maps AIRMap.m:503) — она отключает легаси-zoom-клэмп
// applyLegacyZoomConstrains (AIRMapManager.m:1170). Именно этот клэмп после зума
// синхронно переустанавливал регион: getZoomLevel делит на region.span
// .longitudeDelta (AIRMap.m:750) и берёт log2 (:753); при вырожденной
// longitudeDelta=0 выходит +inf > maxZoomLevel → setCenterCoordinate:zoomLevel:
// с переворотом долготы на антипод («сплошная вода» после щипка, только Release).
// Пустой/nil cameraZoomRange, наоборот, форсит клэмп (YES, :483) — поэтому объект
// должен быть непустым.
//
// Границы широкие, чтобы зум НЕ ограничивался сильнее прежнего (значения в метрах,
// MKMapCameraZoomRange.centerCoordinateDistance = дистанция камеры до центра):
//   min 50 м        — близкий зум (улица), не режем приближение;
//   max 40 000 000 м — ≈ окружность Земли, фактически без ограничения отдаления.
export const MAP_CAMERA_ZOOM_RANGE: CameraZoomRange = {
  minCenterCoordinateDistance: 50,
  maxCenterCoordinateDistance: 40_000_000,
};

// AddMarkerScreen: тот же фикс (отключить legacy-clamp), НО с ограничением
// отдаления — раньше это делал minZoomLevel={15} (легаси-путь, который
// cameraZoomRange отключает). Возвращаем ограничение через maxCenterCoordinateDistance.
//
// Расчёт «эквивалент zoom 15 на 430 pt»:
//   web-mercator zoom 15: 360°/2^15 = 0.010986°/256 px; на ширину 430 px →
//   0.010986·(430/256) = 0.018457° долготы; на широте 32° ×cos(32°)=0.848 →
//   0.015656° ≈ 0.015656·111320 ≈ 1740 м видимой ширины (~1.7 км).
//   MapKit centerCoordinateDistance (дистанция камеры до центра при pitch 0)
//   эмпирически ≈ ~2× видимой ширины на портретном телефоне → ~3.4 км.
// Берём 3500 м как «не отдаляться дальше квартала» — приближённо, легко
// подстроить. minCenterCoordinateDistance 50 — как у общей (близкий зум для
// точной установки метки).
export const ADD_MARKER_CAMERA_ZOOM_RANGE: CameraZoomRange = {
  minCenterCoordinateDistance: 50,
  maxCenterCoordinateDistance: 3500,
};
