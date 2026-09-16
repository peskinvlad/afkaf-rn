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

// Порог зума с ГИСТЕРЕЗИСОМ: инфраструктурные пины (типы выше + точки
// water_sources) прячем, когда сильно отдалили, и возвращаем при приближении.
// Опасные типы рисуются всегда. Две границы вместо одной — чтобы у самого края
// один пинч не дёргал состояние туда-сюда (раньше порог стоял на 0.05, прямо на
// городском зуме, и мигал на каждом жесте). Границы подняты так, чтобы городской
// зум гарантированно попадал в «показывать»; region.latitudeDelta из
// onRegionChangeComplete считается по всей вьюхе, включая нижний mapPadding под
// логотип Apple, поэтому reported-значение крупнее визуального зума.
export const INFRA_HIDE_ABOVE_DELTA = 0.10; // отдалились сильнее → спрятать
export const INFRA_SHOW_BELOW_DELTA = 0.06; // приблизились ближе → показать

// Следующее состояние «инфраструктура спрятана» по гистерезису. Между границами
// состояние не меняется; невалидный delta (NaN/∞) оставляет как было. Пины при
// этом НЕ размонтируются — переключается только их прозрачность (см.
// MapMarkerIcon), так что пересечение порога не пересобирает ~1600 нативных
// аннотаций и не роняет карту в «сплошную воду».
export function nextInfraHidden(prev: boolean, latitudeDelta: number): boolean {
  if (!Number.isFinite(latitudeDelta)) return prev;
  if (latitudeDelta > INFRA_HIDE_ABOVE_DELTA) return true;
  if (latitudeDelta < INFRA_SHOW_BELOW_DELTA) return false;
  return prev;
}

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
