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
