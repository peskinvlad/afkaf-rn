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

// ── Калибровка модели температуры асфальта ────────────────────────────────────
// калибровка: будет уточняться по замерам инфракрасным термометром
const NIGHT_BASE_C = 2;         // асфальт теплее воздуха даже ночью (остаточное тепло)
const SOLAR_MAX_C = 27;         // максимальная солнечная добавка (ясный зенит, солнце в 90°)
const CLOUD_ATTENUATION = 0.6;  // какую долю солнечной добавки съедает сплошная облачность
// Тепловая память покрытия: асфальт нагревается и остывает с запаздыванием
// относительно солнца, поэтому «солнце» усредняем по недавнему прошлому.
const SUN_LAG_1H_WEIGHT = 0.6;  // вес высоты солнца час назад
const SUN_LAG_3H_WEIGHT = 0.4;  // вес высоты солнца три часа назад
const SUN_LAG_1H_MS = 60 * 60 * 1000;
const SUN_LAG_3H_MS = 3 * 60 * 60 * 1000;

const DEG = Math.PI / 180;

export function statusFor(surfaceTempC: number): HeatStatus {
  if (surfaceTempC < HEAT_CAUTION_FROM_C) return 'ok';
  if (surfaceTempC <= HEAT_DANGER_ABOVE_C) return 'caution';
  return 'danger';
}

// Синус высоты солнца над горизонтом в момент `date` для точки lat/lon.
// Чистая астрономия (алгоритм NOAA): склонение и уравнение времени по дню года,
// часовой угол по UTC-времени и долготе. Считает ТОЛЬКО по UTC — от часового
// пояса устройства не зависит. Возвращает sin(высоты): >0 солнце над горизонтом,
// ≤0 под горизонтом. Долгота восточная — положительная.
export function solarSinElevation(latDeg: number, lonDeg: number, date: Date): number {
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 0);
  const dayOfYear = Math.floor((date.getTime() - yearStart) / 86_400_000); // 1 = 1 января
  const hourUTC = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;

  // Дробный год (радианы).
  const g = (2 * Math.PI / 365) * (dayOfYear - 1 + (hourUTC - 12) / 24);
  // Уравнение времени (минуты) и склонение (радианы) — ряды NOAA.
  const eqTimeMin =
    229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g)
      - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const declRad =
    0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g)
    - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g)
    - 0.002697 * Math.cos(3 * g) + 0.001480 * Math.sin(3 * g);

  // Истинное солнечное время → часовой угол.
  const trueSolarMin = hourUTC * 60 + eqTimeMin + 4 * lonDeg;
  const hourAngleRad = (trueSolarMin / 4 - 180) * DEG;

  const latRad = latDeg * DEG;
  return Math.sin(latRad) * Math.sin(declRad)
    + Math.cos(latRad) * Math.cos(declRad) * Math.cos(hourAngleRad);
}

// Оценка температуры покрытия: воздух + ночная база + солнечный нагрев,
// приглушённый облачностью. Солнце берётся с тепловой задержкой (см. константы).
// atMs — момент в мс (UTC-безопасно), lat/lon — точка запроса погоды,
// cloudsPct — облачность 0–100 (нет данных → 0%, осторожная/жаркая сторона).
export function surfaceFromWeather(
  airTempC: number,
  cloudsPct: number | null | undefined,
  atMs: number,
  latDeg: number,
  lonDeg: number,
): number {
  const s1 = Math.max(0, solarSinElevation(latDeg, lonDeg, new Date(atMs - SUN_LAG_1H_MS)));
  const s3 = Math.max(0, solarSinElevation(latDeg, lonDeg, new Date(atMs - SUN_LAG_3H_MS)));
  const sun = SUN_LAG_1H_WEIGHT * s1 + SUN_LAG_3H_WEIGHT * s3;

  const cloudFraction = (cloudsPct ?? 0) / 100;
  const clouds = 1 - CLOUD_ATTENUATION * cloudFraction;

  return Math.round(airTempC + NIGHT_BASE_C + SOLAR_MAX_C * sun * clouds);
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
