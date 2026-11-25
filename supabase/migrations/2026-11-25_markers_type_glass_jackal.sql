-- Applied to the live DB on 2026-11-25 (Supabase migration markers_type_glass_jackal).
-- Adds two user marker types: glass (стекло / мусор) and jackal (шакалы).
-- food (еда / кости) was already allowed since 2026-09-15. No rows changed.
-- TTL: markers_guard_insert falls through to the default 24 hours for all three.
ALTER TABLE public.markers
  DROP CONSTRAINT markers_type_check,
  ADD CONSTRAINT markers_type_check CHECK (type = ANY (ARRAY['park'::text, 'water'::text, 'danger'::text, 'hazard'::text, 'aggressive_dog'::text, 'forbidden'::text, 'dog_park'::text, 'food'::text, 'glass'::text, 'jackal'::text]));
