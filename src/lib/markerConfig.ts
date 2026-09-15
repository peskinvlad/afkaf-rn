export const MARKER_CONFIG: Record<string, { emoji: string; pinColor: string }> = {
  park:           { emoji: '🌳', pinColor: '#2c5f25' },
  dog_park:       { emoji: '🎾', pinColor: '#2c5f25' },
  water:          { emoji: '💧', pinColor: '#3b82f6' },
  danger:         { emoji: '⚠️', pinColor: '#92580a' },
  hazard:         { emoji: '☠️', pinColor: '#9b1c1c' },
  aggressive_dog: { emoji: '🐕', pinColor: '#9b1c1c' },
  forbidden:      { emoji: '🚫', pinColor: '#92580a' },
};

// Постоянная инфраструктура из OSM-импорта Гуш-Дана. Эти типы создаёт только
// куратор (expires_at NULL); обычный юзер их поставить не может (триггер PT403),
// поэтому членство в этом списке = «постоянное место».
export const INFRA_MARKER_TYPES: string[] = ['water', 'park', 'dog_park'];

// Порог зума: при region.latitudeDelta больше этого значения инфраструктурные
// пины (типы выше + точки water_sources) не рендерятся вовсе — их ~1600, и на
// сильном отдалении они подтормаживают карту. Опасные типы рисуются всегда.
export const INFRA_HIDE_ZOOM_DELTA = 0.05;

export interface MapMarker {
  id: string;
  type: string;
  lat: number;
  lng: number;
  description: string | null;
  user_id: string | null;  // author — used for "own marker" check in voting
  created_at?: string | null; // freshness label in MarkerCallout
}

export interface WaterSource {
  id: string;
  lat: number;
  lng: number;
  amenity: string | null;
  dog_bowl: boolean | null;
}
