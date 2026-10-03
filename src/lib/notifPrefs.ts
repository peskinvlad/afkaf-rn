import AsyncStorage from '@react-native-async-storage/async-storage';

// Настройки показа боевых уведомлений: по одному выключателю на тип + тихие часы.
// Все пять типов по умолчанию ВКЛючены (ключа нет → включено).

export type NotifType = 'park' | 'home' | 'hazard' | 'still' | 'marker';

export const NOTIF_TYPES: NotifType[] = ['park', 'home', 'hazard', 'still', 'marker'];

export const NOTIF_TYPE_KEY: Record<NotifType, string> = {
  park: 'notif_type_park',
  home: 'notif_type_home',
  hazard: 'notif_type_hazard',
  still: 'notif_type_still',
  marker: 'notif_type_marker',
};

// Тихие часы 23:00–07:00. НЕ действуют на «забытую прогулку» (home/still) — их
// смысл в том, чтобы напомнить завершить прогулку, даже поздно вечером/ночью.
const QUIET_START_HOUR = 23;
const QUIET_END_HOUR = 7;
export const QUIET_EXEMPT: NotifType[] = ['home', 'still'];

export function inQuietHours(date = new Date()): boolean {
  const h = date.getHours();
  return h >= QUIET_START_HOUR || h < QUIET_END_HOUR;
}

export async function loadNotifEnabled(): Promise<Record<NotifType, boolean>> {
  const pairs = await AsyncStorage.multiGet(NOTIF_TYPES.map((t) => NOTIF_TYPE_KEY[t]));
  const map = Object.fromEntries(pairs) as Record<string, string | null>;
  const result = {} as Record<NotifType, boolean>;
  for (const t of NOTIF_TYPES) result[t] = map[NOTIF_TYPE_KEY[t]] !== 'false';
  return result;
}

export async function setNotifEnabled(type: NotifType, enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(NOTIF_TYPE_KEY[type], String(enabled));
}
