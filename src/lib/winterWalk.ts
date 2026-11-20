// «Лучшее время» зимой: асфальт не греется, поэтому вместо «когда остынет»
// отвечаем на вопрос «когда сухо». Чистая функция — без React и сети.
import { WALK_WINDOW_START_H, WALK_WINDOW_END_H, weatherKind } from './heat';

// Слот считаем «дождь вероятен», если вероятность осадков ≥ 40% или сама
// погода слота — дождь/гроза.
export const RAIN_LIKELY_POP = 0.4;

export type DryWindow =
  | { kind: 'dryAll' }                                       // сухо весь день
  | { kind: 'dryAllTomorrow' }                               // ближайшие часы в окне — уже завтра, сухо
  | { kind: 'dryUntil' | 'dryUntilTomorrow'; timeEpoch: number }   // сухо до HH:00, потом вероятен дождь
  | { kind: 'rainUntil' | 'rainUntilTomorrow'; timeEpoch: number } // дождь вероятен до HH:00, потом суше
  | { kind: 'rainAll' }                                      // дождь вероятен весь период
  | { kind: 'none' };                                        // в окне нет слотов

interface Slot {
  timeEpoch: number;
  icon: string;
  pop: number;
}

export function isRainLikely(slot: { icon: string; pop: number }): boolean {
  const k = weatherKind(slot.icon);
  return slot.pop >= RAIN_LIKELY_POP || k === 'rain' || k === 'storm';
}

function inWalkWindow(d: Date): boolean {
  const h = d.getHours() + d.getMinutes() / 60; // местное время
  return h >= WALK_WINDOW_START_H && h <= WALK_WINDOW_END_H;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

// nowRaining — идёт ли дождь прямо сейчас по текущей погоде (прогноз OWM
// начинается со СЛЕДУЮЩЕГО слота и «сейчас» не покрывает). Учитывается только
// если «сейчас» попадает в окно 05:30–23:00.
export function pickDryWindow(forecast: Slot[], nowMs: number, nowRaining = false): DryWindow {
  const now = new Date(nowMs);
  const slots = forecast
    .filter((pt) => pt.timeEpoch * 1000 > nowMs && inWalkWindow(new Date(pt.timeEpoch * 1000)))
    .sort((a, b) => a.timeEpoch - b.timeEpoch);
  if (slots.length === 0) return { kind: 'none' };

  const isToday = (pt: Slot) => sameDay(now, new Date(pt.timeEpoch * 1000));
  const rainyNow = (nowRaining && inWalkWindow(now)) || isRainLikely(slots[0]);

  if (rainyNow) {
    const dry = slots.find((pt) => !isRainLikely(pt));
    if (!dry) return { kind: 'rainAll' };
    return { kind: isToday(dry) ? 'rainUntil' : 'rainUntilTomorrow', timeEpoch: dry.timeEpoch };
  }

  const rain = slots.find(isRainLikely);
  if (!rain) return { kind: isToday(slots[0]) ? 'dryAll' : 'dryAllTomorrow' };
  return { kind: isToday(rain) ? 'dryUntil' : 'dryUntilTomorrow', timeEpoch: rain.timeEpoch };
}
