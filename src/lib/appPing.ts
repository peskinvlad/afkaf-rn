// Анонимный пинг открытия приложения для метрик (feat/app-ping). Никакой
// сторонней аналитики: один вызов SECURITY DEFINER RPC log_app_open не чаще
// раза в день на устройство. Пишется только device_id (случайный UUID,
// хранится локально), дата (на сервере, по Asia/Jerusalem), платформа и версия;
// user_id сервер берёт из auth.uid() (у гостя NULL). Координат и прочих личных
// данных нет — см. supabase/migrations/2026-11-14_app_ping.sql.
//
// Любая ошибка глушится: пинг — побочная телеметрия, он не должен ни ронять
// приложение, ни показывать алерты.
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Application from 'expo-application';
import { supabase } from './supabase';
import { isDevUser } from '../constants/dev';

const DEVICE_ID_KEY = 'app_ping_device_id'; // случайный UUID устройства (навсегда)
const LAST_DAY_KEY = 'app_ping_last_day';   // дата последнего пинга (YYYY-MM-DD, Иерусалим)

// Защита от двойного вызова в одной сессии (холодный старт + сразу 'active').
let inFlight = false;

// Случайный v4 UUID на чистом JS. Это анонимный id устройства, а не секрет —
// крипто-стойкость не нужна, зато фича остаётся без нативных зависимостей
// (OTA-пригодна).
function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Сегодняшняя дата по Asia/Jerusalem в формате YYYY-MM-DD. en-CA даёт ISO-порядок.
// Та же зона, что в RPC, — локальный гейт «раз в день» совпадает с серверным.
function jerusalemDay(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date());
}

// Случайный UUID устройства: создаётся один раз и переживает перезапуски. Не
// привязан к пользователю и не содержит ничего личного — просто чтобы считать
// уникальные устройства и возвращаемость.
async function getOrCreateDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const id = uuidv4();
  await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  return id;
}

// Вызывать при холодном старте и при возвращении приложения на передний план.
// Сам решает, нужно ли слать (не чаще раза в день, не для dev-пользователя).
export async function logAppOpen(): Promise<void> {
  if (inFlight) return;
  inFlight = true;
  try {
    // Dev-пользователь не пингуется, чтобы тесты не портили цифры.
    const { data: { session } } = await supabase.auth.getSession();
    if (isDevUser(session?.user?.id)) return;

    // Не чаще раза в день: сверяем сегодняшнюю дату (Иерусалим) с последней.
    const today = jerusalemDay();
    if ((await AsyncStorage.getItem(LAST_DAY_KEY)) === today) return;

    const deviceId = await getOrCreateDeviceId();
    // Platform.OS → ровно 'ios' | 'android' (сервер отклоняет прочее). На нашем
    // нативном таргете других значений нет; всё не-android считаем 'ios'.
    const platform = Platform.OS === 'android' ? 'android' : 'ios';
    const appVersion =
      Constants.expoConfig?.version ?? Application.nativeApplicationVersion ?? null;

    // Те же правила, что в RPC log_app_open: 1..20 символов и ^[0-9A-Za-z.-]+$
    // (напр. «0.2.0»). При невалидной/пустой версии НЕ шлём и НЕ помечаем день —
    // чтобы не «съесть» сегодняшний пинг зря; сервер такой ввод всё равно
    // проигнорировал бы молча.
    if (!appVersion || appVersion.length > 20 || !/^[0-9A-Za-z.\-]+$/.test(appVersion)) {
      console.warn('[appPing] skipped: invalid app_version', appVersion);
      return;
    }

    const { error } = await supabase.rpc('log_app_open', {
      p_device_id: deviceId,
      p_platform: platform,
      p_app_version: appVersion,
    });
    if (error) {
      // Молча игнорируем — помечаем день как отправленный только при успехе,
      // чтобы при сбое попробовать снова при следующем открытии.
      console.warn('[appPing] log_app_open failed:', error.message);
      return;
    }

    await AsyncStorage.setItem(LAST_DAY_KEY, today);
  } catch (e) {
    // Нет сети, недоступный Intl/Crypto, гонка сессии и т.п. — не наша забота.
    console.warn('[appPing] skipped:', e);
  } finally {
    inFlight = false;
  }
}
