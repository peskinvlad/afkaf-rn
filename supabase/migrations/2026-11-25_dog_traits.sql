-- 2026-11-25 — dog trait tags (multi-select "метки характера")
-- STATUS: APPLIED 2026-11-25 (Supabase MCP, после «Применяй» Влада). Проверено: 18 собак,
-- у всех traits = '{}', ограничение dogs_traits_check на месте. Снимок — supabase/tables.sql.

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
