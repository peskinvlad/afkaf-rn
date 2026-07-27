import AsyncStorage from '@react-native-async-storage/async-storage';
import { haversine } from './geo';

export interface HomeZone {
  latitude: number;
  longitude: number;
  radiusM: number; // radius in metres
}

// Reads the user's configured home privacy zone from AsyncStorage.
// Returns null when it isn't set up (any missing/invalid field) — callers
// treat null as "no masking", i.e. publish position as usual.
export async function loadHomeZone(): Promise<HomeZone | null> {
  const entries = await AsyncStorage.multiGet([
    'privacy_home_lat',
    'privacy_home_lng',
    'privacy_home_radius',
  ]);
  const map = Object.fromEntries(entries) as Record<string, string | null>;
  const lat = Number(map.privacy_home_lat);
  const lng = Number(map.privacy_home_lng);
  const radiusM = Number(map.privacy_home_radius);
  if (
    map.privacy_home_lat == null ||
    map.privacy_home_lng == null ||
    map.privacy_home_radius == null ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    !Number.isFinite(radiusM) ||
    radiusM <= 0
  ) {
    return null;
  }
  return { latitude: lat, longitude: lng, radiusM };
}

// True when (lat,lng) falls within the home zone. haversine() returns km, the
// stored radius is in metres — convert once here.
export function isInsideHomeZone(lat: number, lng: number, zone: HomeZone): boolean {
  const distanceKm = haversine({ latitude: lat, longitude: lng }, zone);
  return distanceKm * 1000 <= zone.radiusM;
}
