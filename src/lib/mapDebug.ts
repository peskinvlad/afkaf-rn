// On-screen camera/data diagnostics for MapScreen, gated by EXPO_PUBLIC_MAP_DEBUG.
// Без флага ВСЁ — no-op: буфер не пишется, подписчики не дёргаются, оверлей
// (см. MapDebugOverlay) не рендерится. Флаг задаётся ТОЛЬКО в preview-профиле
// eas.json — в production/development его нет.
//
// Кольцевой буфер живёт в модуле (не в стейте MapScreen), а перерисовку делает
// только маленький MapDebugOverlay через subscribe — так лог не вызывает
// ре-рендеров MapView.

export const MAP_DEBUG_ENABLED = process.env.EXPO_PUBLIC_MAP_DEBUG === '1';

const MAX_EVENTS = 10;
const events: string[] = [];
let markersStatus = 'markers=?';
let waterStatus = 'water=?';

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((l) => l());
}

// мм:сс.ммм — достаточно, чтобы видеть порядок и задержки между событиями.
function stamp(): string {
  const d = new Date();
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${mm}:${ss}.${ms}`;
}

export const mapDebug = {
  enabled: MAP_DEBUG_ENABLED,

  // Одно событие в кольцевой буфер (LAYOUT / READY / LOC / ANIM / REJECT / RC).
  log(line: string): void {
    if (!MAP_DEBUG_ENABLED) return;
    events.push(`${stamp()} ${line}`);
    if (events.length > MAX_EVENTS) events.shift();
    notify();
  },

  // Постоянная строка статуса данных — обновляется при каждой загрузке.
  setMarkersStatus(s: string): void {
    if (!MAP_DEBUG_ENABLED) return;
    markersStatus = s;
    notify();
  },
  setWaterStatus(s: string): void {
    if (!MAP_DEBUG_ENABLED) return;
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
