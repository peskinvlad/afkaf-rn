// Android PNG-пины по типу метки (тот же диск, что на карте). Единый источник
// для карты (MapMarkerIcon) и шапки callout (MarkerCallout), чтобы пин и
// карточка всегда совпадали. PNG сгенерированы scripts/gen-marker-pngs.ts из
// того же MARKER_CONFIG; require должен быть статичным литералом (Metro).
// Тип — number (asset-id от require): подходит и для <Marker image>, и для
// <Image source> (в отличие от широкого ImageSourcePropType, который у
// Marker.image не проходит по типам).
export const ANDROID_MARKER_IMAGES: Record<string, number> = {
  park: require('../../assets/markers/marker-park.png'),
  dog_park: require('../../assets/markers/marker-dog_park.png'),
  water: require('../../assets/markers/marker-water.png'),
  danger: require('../../assets/markers/marker-danger.png'),
  hazard: require('../../assets/markers/marker-hazard.png'),
  aggressive_dog: require('../../assets/markers/marker-aggressive_dog.png'),
  forbidden: require('../../assets/markers/marker-forbidden.png'),
};
