import { HeatStatus } from './heat';

// ── Вердикт итогов прогулки ──────────────────────────────────────────────────
// Чистая функция: никаких чтений погоды, истории или порогов здесь нет —
// всё приходит уже посчитанным. Температурный статус берётся из единого
// источника (lib/heat.ts через useApp().heatData) и ФИКСИРУЕТСЯ в момент
// «Завершить прогулку»: если жара была во время прогулки, а к моменту
// открытия итогов асфальт остыл, вердикт всё равно про ту жару.
//
// Тон по возрастанию теплоты: shortNeutral < great < celebration.
// heatPraise стоит особняком — это не оценка результата, а поддержка
// правильного решения.

export type WalkVerdict =
  | 'celebration'  // новый бейдж или личный рекорд
  | 'heatPraise'   // короткая прогулка в жару — берёг собаку
  | 'shortNeutral' // короткая прогулка в нормальную погоду, без укора
  | 'great';       // засчитанная прогулка

export interface WalkVerdictInput {
  isValidWalk: boolean;
  hasNewBadge: boolean;
  isPersonalBest: boolean;
  // Статус на момент завершения прогулки, не на момент рендера итогов.
  heatStatus: HeatStatus;
}

// Приоритет сверху вниз, первое совпадение выигрывает.
export function pickWalkVerdict(input: WalkVerdictInput): WalkVerdict {
  if (input.hasNewBadge || input.isPersonalBest) return 'celebration';
  if (!input.isValidWalk && input.heatStatus === 'danger') return 'heatPraise';
  if (!input.isValidWalk) return 'shortNeutral';
  return 'great';
}

// Заголовок вердикта. Во всех строках {name} стоит в позиции подлежащего —
// иначе русская и ивритская грамматика ломаются о подстановку «Твой пёс».
export const VERDICT_TITLE_KEY: Record<WalkVerdict, string> = {
  celebration:  'walk.verdict.celebration',
  heatPraise:   'walk.verdict.heatPraise',
  shortNeutral: 'walk.verdict.shortNeutral',
  great:        'walk.verdict.great',
};
