// «Сообщить в мэрию»: сборка сообщения, открытие канала (WhatsApp / звонок) и
// локальная отметка «уже сообщил». Сервер не трогаем (этап 1, только клиент).
import { Alert, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MapMarker } from './markerConfig';
import { MUNICIPAL_106 } from '../config/municipal106';
import { resolveMunicipality, type CityId } from './municipality';

// Типы, для которых показываем кнопку. forbidden — нет (это не мэрийный вопрос).
// food в MARKER_CONFIG пока нет; когда появится — добавить сюда.
export const REPORT106_TYPES: string[] = [
  'danger', 'hazard', 'aggressive_dog', 'water', 'park', 'dog_park',
];

// Для этих типов всегда показываем шторку (подсказка про полицию).
export const REPORT106_POLICE_TYPES: string[] = ['danger', 'hazard'];

export const canReportToCity = (type: string) => REPORT106_TYPES.includes(type);
export const needsPoliceHint = (type: string) => REPORT106_POLICE_TYPES.includes(type);

// Текст в мэрию ВСЕГДА на иврите, независимо от языка интерфейса.
const HE_TYPE_NAMES: Record<string, string> = {
  danger: 'סכנה',
  hazard: 'מפגע מסוכן',
  aggressive_dog: 'כלב תוקפני משוטט',
  water: 'ברזייה / מים לכלבים',
  park: 'פארק',
  dog_park: 'גינת כלבים',
  food: 'שאריות אוכל על הקרקע',
};

// Без имени/id пользователя и без его собственных координат — только метка.
export function buildReportText(m: Pick<MapMarker, 'type' | 'lat' | 'lng' | 'description'>): string {
  const typeName = HE_TYPE_NAMES[m.type] ?? 'מפגע';
  const lines = [`שלום, אני רוצה לדווח על מפגע: ${typeName}`];
  const desc = m.description?.trim();
  if (desc) lines.push(desc);
  lines.push(`מיקום: https://maps.google.com/?q=${m.lat.toFixed(6)},${m.lng.toFixed(6)}`);
  lines.push('');
  lines.push('נשלח בעזרת afkaf');
  return lines.join('\n');
}

export type ChannelKind = 'whatsapp' | 'phone' | 'none';

export function channelFor(cityId: CityId): ChannelKind {
  const c = MUNICIPAL_106[cityId];
  if (c?.whatsapp) return 'whatsapp';
  if (c?.phone) return 'phone';
  return 'none';
}

// Кнопку в пузыре не показываем, если город известен точно, но контакта у него нет
// (иначе тупик). При 'unsure' — показываем: пользователь выберет город сам.
export function shouldShowReport106(m: Pick<MapMarker, 'type' | 'lat' | 'lng'>): boolean {
  if (!canReportToCity(m.type)) return false;
  const res = resolveMunicipality(m.lat, m.lng);
  // danger/hazard: кнопка остаётся — шторка покажет подсказку про полицию (100).
  if (needsPoliceHint(m.type)) return true;
  return !(res.status === 'sure' && channelFor(res.cityId) === 'none');
}

type TFn = (key: string, vars?: Record<string, string | number>) => string;

// Открывает канал города. true — канал реально открыт (или пользователь
// подтвердил звонок и tel: открылся); false — нечего открывать / отмена / ошибка.
export async function openCityChannel(
  cityId: CityId,
  marker: Pick<MapMarker, 'type' | 'lat' | 'lng' | 'description'>,
  t: TFn,
): Promise<boolean> {
  const contact = MUNICIPAL_106[cityId];
  const kind = channelFor(cityId);
  const cityName = t(`report106.city.${cityId}`);

  if (kind === 'none') {
    Alert.alert(cityName, t('report106.noContact'));
    return false;
  }

  try {
    if (kind === 'whatsapp') {
      const url = `https://wa.me/${contact.whatsapp}?text=${encodeURIComponent(buildReportText(marker))}`;
      await Linking.openURL(url);
      return true;
    }
    // Телефон: сначала подтверждение — случайный звонок в мэрию не нужен.
    const confirmed = await new Promise<boolean>((resolve) => {
      Alert.alert(t('report106.callTitle', { city: cityName }), undefined, [
        { text: t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
        { text: t('report106.call'), onPress: () => resolve(true) },
      ], { cancelable: true, onDismiss: () => resolve(false) });
    });
    if (!confirmed) return false;
    await Linking.openURL(`tel:${contact.phone}`);
    return true;
  } catch (e) {
    console.warn('[report106] openURL failed:', e);
    if (kind === 'phone') Alert.alert(t('report106.error.phone'));
    else Alert.alert(t('report106.error.title'), t('report106.error.body'));
    return false;
  }
}

// ── «Ты сообщил в мэрию»: локальная отметка ───────────────────────────────
const SENT_PREFIX = 'report106:sent:';
const listeners = new Set<(markerId: string) => void>();

export async function loadReportSent(markerId: string): Promise<number | null> {
  try {
    const v = await AsyncStorage.getItem(SENT_PREFIX + markerId);
    const n = v ? Number(v) : NaN;
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export async function markReportSent(markerId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(SENT_PREFIX + markerId, String(Date.now()));
  } catch {
    // отметка — косметика, не ломаем поток
  }
  listeners.forEach((l) => l(markerId));
}

export function subscribeReportSent(cb: (markerId: string) => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
