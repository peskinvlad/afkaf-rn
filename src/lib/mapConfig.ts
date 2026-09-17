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
