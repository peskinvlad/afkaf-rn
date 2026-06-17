import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { MapMarker, WaterSource } from '../lib/markerConfig';

export function useMapMarkers() {
  // ── Load markers from Supabase ─────────────────────────────────────────────
  const [markers, setMarkers] = useState<MapMarker[]>([]);

  useEffect(() => {
    async function loadMarkers() {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('markers')
        .select('id, type, lat, lng, description, user_id')
        .or(`expires_at.is.null,expires_at.gt."${now}"`);
      if (error) {
        console.warn('[useMapMarkers] markers fetch error:', error.message, error.code);
      } else if (data) {
        setMarkers(data as MapMarker[]);
      }
    }
    loadMarkers();
  }, []);

  // ── Load water sources from Supabase (static OSM seed data, no TTL) ────────
  const [waterSources, setWaterSources] = useState<WaterSource[]>([]);

  useEffect(() => {
    async function loadWaterSources() {
      const { data, error } = await supabase
        .from('water_sources')
        .select('id, lat, lng, amenity, dog_bowl');
      if (error) {
        console.warn('[useMapMarkers] water_sources fetch error:', error.message, error.code);
      } else if (data) {
        setWaterSources(data as WaterSource[]);
      }
    }
    loadWaterSources();
  }, []);

  return { markers, waterSources };
}
