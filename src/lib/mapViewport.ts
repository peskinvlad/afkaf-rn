import { MapMarker, WaterSource, INFRA_MARKER_TYPES } from './markerConfig';

// Android-only viewport culling for map pins.
//
// react-native-maps@1.20.1 растеризует каждый children-View маркер в bitmap на
// главном потоке. На старте WalkScreen/MapScreen монтировались ВСЕ пины сразу
// (~826 markers + ~835 water = ~1660) → ANR на слабом устройстве (Samsung S9).
// Здесь оставляем только пины в текущем видимом регионе (+запас), с потолком.
// iOS этим не пользуется — там дерево прежнее (см. вызовы под Platform.OS).

export interface ViewportRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

// Запас вокруг видимой области: пины у самого края уже смонтированы к моменту,
// когда их доводит до центра лёгкий пан.
export const VIEWPORT_MARGIN = 0.30; // +30%
// Потолок пинов в области: больше — инфраструктуру не показываем (как infraHidden),
// опасные пользовательские метки остаются всегда.
export const VIEWPORT_MAX_PINS = 150;

interface Bounds { minLat: number; maxLat: number; minLng: number; maxLng: number; }

export function regionBounds(region: ViewportRegion, margin = VIEWPORT_MARGIN): Bounds {
  const latPad = (Math.abs(region.latitudeDelta) / 2) * (1 + margin);
  const lngPad = (Math.abs(region.longitudeDelta) / 2) * (1 + margin);
  return {
    minLat: region.latitude - latPad,
    maxLat: region.latitude + latPad,
    minLng: region.longitude - lngPad,
    maxLng: region.longitude + lngPad,
  };
}

function inBounds(lat: number, lng: number, b: Bounds): boolean {
  return lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng;
}

const isInfra = (type: string): boolean => INFRA_MARKER_TYPES.includes(type);

// Пины к рендеру на Android для данного региона.
//   region === null (регион ещё не известен) → инфраструктуру не монтируем
//     вообще; пользовательские (опасные) метки показываем — их немного.
//   регион известен → всё в пределах видимой области (+запас); если пинов в
//     области больше VIEWPORT_MAX_PINS — инфраструктуру убираем, опасные метки
//     остаются.
export function selectVisiblePins(
  region: ViewportRegion | null,
  markers: MapMarker[],
  waterSources: WaterSource[],
): { markers: MapMarker[]; waterSources: WaterSource[] } {
  if (!region) {
    return { markers: markers.filter((m) => !isInfra(m.type)), waterSources: [] };
  }

  const b = regionBounds(region);
  const userMarkers: MapMarker[] = [];
  const infraMarkers: MapMarker[] = [];
  for (const m of markers) {
    if (!inBounds(m.lat, m.lng, b)) continue;
    (isInfra(m.type) ? infraMarkers : userMarkers).push(m);
  }
  const infraWater = waterSources.filter((w) => inBounds(w.lat, w.lng, b));

  const infraCount = infraMarkers.length + infraWater.length;
  if (userMarkers.length + infraCount > VIEWPORT_MAX_PINS) {
    return { markers: userMarkers, waterSources: [] }; // потолок → без инфраструктуры
  }
  return { markers: [...userMarkers, ...infraMarkers], waterSources: infraWater };
}
