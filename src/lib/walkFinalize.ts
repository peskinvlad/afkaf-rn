import { supabase } from './supabase';
import { checkAndAwardBadges } from './badges';
import { saveWalkHistory, getPreviousBestDistanceKm, WalkPathPoint } from './walkHistory';

// A walk only "counts" (walk_history + badges) past a minimum bar, so an
// accidental swipe doesn't pollute streaks/totals. Single source for every
// path that ends a walk (Finish button, recovery card).
export const MIN_VALID_DISTANCE_KM = 0.3;
export const MIN_VALID_DURATION_SEC = 300;

export function isValidWalk(distanceKm: number, durationS: number): boolean {
  return distanceKm >= MIN_VALID_DISTANCE_KM && durationS >= MIN_VALID_DURATION_SEC;
}

export interface FinalizeWalkInput {
  startedAt: string;
  // Omitted → "now", taken at the moment of the insert.
  endedAt?: string;
  durationS: number;
  distanceKm: number;
  steps: number | null;
  path: WalkPathPoint[] | null;
  // undefined → looked up (first dog of the user); null → walk without a dog.
  dogId?: string | null;
  confirmedCount: number;
  // «Личный рекорд» в итогах. Считается строго до вставки текущей прогулки.
  checkPersonalBest: boolean;
}

export interface FinalizeWalkResult {
  isValidWalk: boolean;
  newBadgeIds: string[];
  isPersonalBest: boolean;
}

// Saves a finished walk (only when it counts and there is a signed-in user),
// then awards any newly earned badges. Never throws on a failed insert —
// saveWalkHistory parks the walk for a later flush.
export async function finalizeWalk(input: FinalizeWalkInput): Promise<FinalizeWalkResult> {
  const valid = isValidWalk(input.distanceKm, input.durationS);
  const result: FinalizeWalkResult = { isValidWalk: valid, newBadgeIds: [], isPersonalBest: false };
  if (!valid) return result;

  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) return result;

  let dogId = input.dogId;
  if (dogId === undefined) {
    const { data: dog } = await supabase
      .from('dogs')
      .select('id')
      .eq('owner_id', userId)
      .limit(1)
      .maybeSingle();
    dogId = dog?.id ?? null;
  }

  if (input.checkPersonalBest) {
    // Строго до вставки текущей прогулки — иначе она побьёт сама себя.
    const prevBest = await getPreviousBestDistanceKm(userId);
    result.isPersonalBest = prevBest.ok
      ? prevBest.bestKm == null || input.distanceKm > prevBest.bestKm
      : false;
  }

  await saveWalkHistory({
    user_id: userId,
    distance_km: input.distanceKm,
    duration_min: Math.floor(input.durationS / 60),
    duration_s: input.durationS,
    started_at: input.startedAt,
    ended_at: input.endedAt ?? new Date().toISOString(),
    steps: input.steps,
    dog_id: dogId,
    path: input.path,
    is_valid: valid,
  });

  const newBadges = await checkAndAwardBadges(input.confirmedCount);
  result.newBadgeIds = newBadges.map((b) => b.id);
  return result;
}
