// On-screen camera/data diagnostics for Map/WalkScreen.
//
// Включённость — РАНТАЙМ-значение, а не только флаг сборки:
//   • дефолт = EXPO_PUBLIC_MAP_DEBUG === '1' (preview-профиль eas.json);
//   • если в AsyncStorage задан рантайм-переключатель (DevPanel) — он важнее
//     env-дефолта, читается один раз при старте и меняется без перезапуска
//     (оверлей подписан через subscribe и перерисуется).
// Когда выключено — ВСЁ no-op: буфер не пишется, подписчики не дёргаются,
// MapDebugOverlay возвращает null. Кольцевой буфер живёт в модуле (не в стейте
// экрана), перерисовку делает только маленький оверлей — лог не вызывает
// ре-рендеров MapView.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEV_MAP_DEBUG_KEY } from '../constants/dev';

const ENV_DEFAULT = process.env.EXPO_PUBLIC_MAP_DEBUG === '1';
let enabled = ENV_DEFAULT;

const MAX_EVENTS = 10;
const events: string[] = [];
let markersStatus = 'markers=?';
let waterStatus = 'water=?';

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((l) => l());
}

// Рантайм-оверрайд из AsyncStorage важнее env-дефолта. Читаем один раз при
// старте; если ключ задан ('true'/'false') — применяем и будим оверлей.
AsyncStorage.getItem(DEV_MAP_DEBUG_KEY)
  .then((v) => {
    if (v === 'true' || v === 'false') {
      enabled = v === 'true';
      notify();
    }
  })
  .catch(() => {});

// мм:сс.ммм — достаточно, чтобы видеть порядок и задержки между событиями.
function stamp(): string {
  const d = new Date();
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${mm}:${ss}.${ms}`;
}

export const mapDebug = {
  // Живое значение (getter): оверлей читает его при каждом рендере и
  // подписан на notify, поэтому переключение из DevPanel действует сразу.
  get enabled(): boolean {
    return enabled;
  },

  // Рантайм-переключатель (DevPanel): меняет значение без перезапуска, persist
  // в AsyncStorage, будит подписчиков (оверлей). Гейт «только dev» — в вызывающем
  // (DevPanel открыт только для DEV_USER_IDS).
  async setEnabled(v: boolean): Promise<void> {
    enabled = v;
    notify();
    try {
      await AsyncStorage.setItem(DEV_MAP_DEBUG_KEY, v ? 'true' : 'false');
    } catch {
      // persist не критичен: значение уже применено в рантайме
    }
  },

  // Одно событие в кольцевой буфер (LAYOUT / READY / LOC / ANIM / REJECT / RC / PAD).
  log(line: string): void {
    if (!enabled) return;
    events.push(`${stamp()} ${line}`);
    if (events.length > MAX_EVENTS) events.shift();
    notify();
  },

  // Постоянная строка статуса данных — обновляется при каждой загрузке.
  setMarkersStatus(s: string): void {
    if (!enabled) return;
    markersStatus = s;
    notify();
  },
  setWaterStatus(s: string): void {
    if (!enabled) return;
    waterStatus = s;
    notify();
  },

  getSnapshot(): { data: string; lines: string[] } {
    return { data: `DATA ${markersStatus} ${waterStatus}`, lines: events.slice() };
  },

  subscribe(l: Listener): () => void {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};
