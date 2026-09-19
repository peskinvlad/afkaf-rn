// ── Единственный источник температурной логики ───────────────────────────────
// Пороги живут ТОЛЬКО здесь, и подмена dev-оверрайдом происходит ТОЛЬКО здесь.
// Любой потребитель (виджет, слайдер старта прогулки, баннер опасности,
// интерцепт HeatWarning, экран асфальта) обязан идти через getEffectiveAsphaltTemp
// / statusFor, а не считать статус по своим числам — иначе неизбежен разнобой
// «виджет видит оверрайд, баннер нет».

export type HeatStatus = 'ok' | 'caution' | 'danger';

// <35 зелёный · 35–45 жёлтый · >45 красный
export const HEAT_CAUTION_FROM_C = 35;
export const HEAT_DANGER_ABOVE_C = 45;

export function statusFor(surfaceTempC: number): HeatStatus {
  if (surfaceTempC < HEAT_CAUTION_FROM_C) return 'ok';
  if (surfaceTempC <= HEAT_DANGER_ABOVE_C) return 'caution';
  return 'danger';
}

// Оценка температуры покрытия по температуре воздуха (та же формула, что была
// в useAsphaltTemp для текущей погоды и для прогноза).
export function surfaceFromAir(airTempC: number): number {
  return Math.round(airTempC * 1.3 + 2);
}

// ── «Лучшее время для прогулки» ───────────────────────────────────────────────
// Один перебор прогноза на оба экрана (карточка на PavementTempScreen и на
// HeatWarningScreen раньше держали по своей копии этой логики).

// Окно «человеческих» часов в местном времени (десятичные часы): 05:30…23:00.
// Ночные слоты прогноза (00:00, 03:00) сюда не попадают — раньше именно они
// давали совет «гулять в 3 ночи».
const WALK_WINDOW_START_H = 5.5;
const WALK_WINDOW_END_H = 23;

export type BestWalkTime =
  | { kind: 'now' } // прямо сейчас уже прохладно
  | { kind: 'today' | 'tomorrowMorning' | 'tomorrow'; timeEpoch: number; surfaceTempC: number }
  | { kind: 'none' }; // в пределах прогноза безопасного окна нет

// Статус берём готовый (slot.status уже посчитан через statusFor), поэтому
// после будущей правки формулы порог подхватится автоматически.
export function pickBestWalkTime(
  forecast: { timeEpoch: number; surfaceTempC: number; status: HeatStatus }[],
  currentStatus: HeatStatus,
  nowMs: number,
): BestWalkTime {
  if (currentStatus === 'ok') return { kind: 'now' };

  const slot = forecast.find((pt) => {
    if (pt.timeEpoch * 1000 <= nowMs) return false; // только будущее
    if (pt.status !== 'ok') return false;           // только безопасные
    const d = new Date(pt.timeEpoch * 1000);
    const h = d.getHours() + d.getMinutes() / 60;   // местное время
    return h >= WALK_WINDOW_START_H && h <= WALK_WINDOW_END_H;
  });

  if (!slot) return { kind: 'none' };

  const now = new Date(nowMs);
  const slotDate = new Date(slot.timeEpoch * 1000);
  const sameDay =
    now.getFullYear() === slotDate.getFullYear() &&
    now.getMonth() === slotDate.getMonth() &&
    now.getDate() === slotDate.getDate();

  const kind = sameDay
    ? 'today'
    : slotDate.getHours() < 12
    ? 'tomorrowMorning'
    : 'tomorrow';

  return { kind, timeEpoch: slot.timeEpoch, surfaceTempC: slot.surfaceTempC };
}

export interface EffectiveHeat {
  // Температура, которую видит весь UI: оверрайд, если он активен, иначе OWM.
  surfaceTempC: number | null;
  status: HeatStatus;
  overrideActive: boolean;
  // Настоящее значение OWM — нужно только диагностике в DevPanel, чтобы в поле
  // было видно, что именно подменено.
  realSurfaceTempC: number | null;
}

// overrideC уже прошёл гейт isDevUser в constants/dev.ts: для всех, кого нет в
// DEV_USER_IDS, сюда всегда приходит null и подмены не происходит никогда.
export function getEffectiveAsphaltTemp(
  realSurfaceTempC: number | null,
  overrideC: number | null,
): EffectiveHeat {
  const overrideActive = overrideC != null;
  const surfaceTempC = overrideActive ? overrideC : realSurfaceTempC;
  return {
    surfaceTempC,
    status: surfaceTempC != null ? statusFor(surfaceTempC) : 'ok',
    overrideActive,
    realSurfaceTempC,
  };
}
