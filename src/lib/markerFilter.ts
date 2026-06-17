import { MapMarker, WaterSource } from './markerConfig';
import { haversine, LatLng } from './geo';
import { RadiusFilter } from '../components/MarkerFilterSheet';

export function filterMarkersAndWater(
  markers: MapMarker[],
  waterSources: WaterSource[],
  radius: RadiusFilter,
  activeCategories: Record<string, boolean>,
  userLocation: LatLng | null,
): { filteredMarkers: MapMarker[]; filteredWaterSources: WaterSource[] } {
  const radiusKm = radius === '500m' ? 0.5 : radius === '1km' ? 1 : null;

  function withinRadius(lat: number, lng: number): boolean {
    if (radiusKm === null || !userLocation) return true;
    return haversine(userLocation, { latitude: lat, longitude: lng }) <= radiusKm;
  }

  const filteredMarkers = markers.filter(
    (m) => (activeCategories[m.type] ?? true) && withinRadius(m.lat, m.lng),
  );
  const filteredWaterSources = waterSources.filter(
    (w) => activeCategories.water && withinRadius(w.lat, w.lng),
  );

  return { filteredMarkers, filteredWaterSources };
}
