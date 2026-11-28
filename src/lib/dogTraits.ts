// Dog trait tags ("метки характера") — a multi-select list on the dog profile,
// stored in dogs.traits (text[]). Separate from `sociability`, which stays a
// single safety-relevant choice (friendly / neutral / reactive).
//
// The keys are the stored values: never rename one, only add. The DB CHECK
// (dogs_traits_check) holds the same list — adding a key here means a new
// migration first. Labels: i18n `dogProfile.trait.<key>`.
export const DOG_TRAITS = [
  'playful',
  'calm',
  'energetic',
  'cuddly',
  'shy',
  'loves_ball',
  'loves_water',
  'loves_running',
  'wary_big_dogs',
  'wary_small_dogs',
  'careful_kids',
  'puppy',
] as const;

export type DogTrait = (typeof DOG_TRAITS)[number];

export const MAX_DOG_TRAITS = 5;

const KNOWN = new Set<string>(DOG_TRAITS);

/** Keeps only known keys, in canonical order, without duplicates, capped. */
export function sanitizeDogTraits(raw: unknown): DogTrait[] {
  if (!Array.isArray(raw)) return [];
  const picked = new Set(raw.filter((x): x is string => typeof x === 'string' && KNOWN.has(x)));
  return DOG_TRAITS.filter((k) => picked.has(k)).slice(0, MAX_DOG_TRAITS);
}

/** Toggle with the cap: adding beyond MAX_DOG_TRAITS is a no-op. */
export function toggleDogTrait(current: DogTrait[], key: DogTrait): DogTrait[] {
  if (current.includes(key)) return current.filter((k) => k !== key);
  if (current.length >= MAX_DOG_TRAITS) return current;
  return sanitizeDogTraits([...current, key]);
}
