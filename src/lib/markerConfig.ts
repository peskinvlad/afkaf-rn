export const MARKER_CONFIG: Record<string, { emoji: string; pinColor: string }> = {
  park:           { emoji: '🌳', pinColor: '#2c5f25' },
  water:          { emoji: '💧', pinColor: '#3b82f6' },
  danger:         { emoji: '⚠️', pinColor: '#92580a' },
  hazard:         { emoji: '☠️', pinColor: '#9b1c1c' },
  aggressive_dog: { emoji: '🐕', pinColor: '#9b1c1c' },
  forbidden:      { emoji: '🚫', pinColor: '#92580a' },
};

export interface MapMarker {
  id: string;
  type: string;
  lat: number;
  lng: number;
  description: string | null;
  user_id: string | null;  // author — used for "own marker" check in voting
}

export interface WaterSource {
  id: string;
  lat: number;
  lng: number;
  amenity: string | null;
  dog_bowl: boolean | null;
}
