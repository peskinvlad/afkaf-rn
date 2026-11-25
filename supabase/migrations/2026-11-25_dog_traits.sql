-- 2026-11-25 — dog trait tags (multi-select "метки характера")
-- STATUS: NOT APPLIED YET — waits for Vlad's «ок». Additive only: one new column
-- with a default, so builds that don't know about it keep inserting/updating fine.
-- The client on feat/dog-traits selects and writes dogs.traits, so this must be
-- applied BEFORE that branch reaches main / OTA.
-- After applying: add the column + constraint to supabase/tables.sql (dogs).

ALTER TABLE public.dogs
  ADD COLUMN traits text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.dogs
  ADD CONSTRAINT dogs_traits_check CHECK (
    cardinality(traits) <= 5
    AND traits <@ ARRAY[
      'playful','calm','energetic','cuddly','shy',
      'loves_ball','loves_water','loves_running',
      'wary_big_dogs','wary_small_dogs','careful_kids','puppy'
    ]::text[]
  );

-- Check after applying:
--   SELECT count(*) AS dogs, count(*) FILTER (WHERE traits = '{}') AS empty FROM public.dogs;
