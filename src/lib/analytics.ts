// Продуктовые события для воронки (feat/app-events). Никакой сторонней
// аналитики: один вызов SECURITY DEFINER RPC log_event на событие, тот же
// анонимный device_id, что у пинга (lib/appPing). user_id сервер берёт из
// auth.uid() (у гостя NULL) — так шаги гостя до входа склеиваются с аккаунтом
// по device_id.
//
// ПРАВИЛА (см. CLAUDE.md → «Аналитика»):
// - в props только короткие примитивы; НИКАКИХ координат, имён, email, текстов
//   меток, id других людей;
// - dev-пользователь не логируется, чтобы тесты не портили цифры;
// - любая ошибка глушится — телеметрия не должна ронять приложение и не ждётся
//   (вызывать без await, fire-and-forget).
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Application from 'expo-application';
import { supabase } from './supabase';
import { isDevUser } from '../constants/dev';
import { getOrCreateDeviceId } from './appPing';

export type EventName =
  | 'lang_chosen'
  | 'onboarding_step'
  | 'onboarding_done'
  | 'auth_shown'
  | 'auth_tap'
  | 'auth_cancel'
  | 'auth_error'
  | 'signed_in'
  | 'dog_added'
  | 'heat_warning_shown'
  | 'heat_warning_choice'
  | 'walk_started'
  | 'walk_finished'
  | 'marker_created'
  | 'friend_request_sent'
  | 'friend_request_accepted';

type PropValue = string | number | boolean | null;
export type EventProps = Record<string, PropValue>;

const NAME_RE = /^[a-z][a-z0-9_]{1,39}$/;
const VERSION_RE = /^[0-9A-Za-z.\-]+$/;
const MAX_KEYS = 8;
const MAX_STR = 40;

// Отбрасывает всё, что не короткий примитив: защита от случайной утечки
// объектов/длинных строк в события.
function sanitize(props?: EventProps): EventProps {
  const out: EventProps = {};
  if (!props) return out;
  for (const [k, v] of Object.entries(props).slice(0, MAX_KEYS)) {
    if (!/^[a-z][a-z0-9_]{0,29}$/.test(k)) continue;
    if (v === null || typeof v === 'boolean') out[k] = v;
    else if (typeof v === 'number' && Number.isFinite(v)) out[k] = Math.round(v * 100) / 100;
    else if (typeof v === 'string') out[k] = v.slice(0, MAX_STR);
  }
  return out;
}

async function send(name: EventName, props?: EventProps): Promise<void> {
  try {
    if (!NAME_RE.test(name)) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (isDevUser(session?.user?.id)) return;

    const appVersion =
      Constants.expoConfig?.version ?? Application.nativeApplicationVersion ?? null;
    if (!appVersion || appVersion.length > 20 || !VERSION_RE.test(appVersion)) return;

    const deviceId = await getOrCreateDeviceId();
    const { error } = await supabase.rpc('log_event', {
      p_device_id: deviceId,
      p_name: name,
      p_props: sanitize(props),
      p_platform: Platform.OS === 'android' ? 'android' : 'ios',
      p_app_version: appVersion,
    });
    if (error) console.warn('[analytics] log_event failed:', error.message);
  } catch (e) {
    console.warn('[analytics] skipped:', e);
  }
}

// Fire-and-forget: никогда не бросает и не требует await.
export function logEvent(name: EventName, props?: EventProps): void {
  void send(name, props);
}
