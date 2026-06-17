import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { LatLng } from '../lib/geo';

export type HeatStatus = 'ok' | 'caution' | 'danger';

// Florentin, Tel Aviv — used if location permission is denied/unavailable
const FLORENTIN_FALLBACK: LatLng = { latitude: 32.0559, longitude: 34.7722 };

const REFRESH_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes, same cadence as the PWA

interface AsphaltTempResult {
  surfaceTempC: number | null;
  airTempC: number | null;
  status: HeatStatus;
  loading: boolean;
}

function statusFor(surfaceTempC: number): HeatStatus {
  if (surfaceTempC < 35) return 'ok';
  if (surfaceTempC <= 45) return 'caution';
  return 'danger';
}

async function fetchAirTemp(lat: number, lon: number): Promise<number | null> {
  const key = process.env.EXPO_PUBLIC_OPENWEATHER_API_KEY;
  const res = await fetch(
    `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${key}`
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.main.temp as number;
}

export function useAsphaltTemp(): AsphaltTempResult {
  const [surfaceTempC, setSurfaceTempC] = useState<number | null>(null);
  const [airTempC, setAirTempC] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function update() {
      const { status } = await Location.requestForegroundPermissionsAsync();
      let coords = FLORENTIN_FALLBACK;
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      }

      const air = await fetchAirTemp(coords.latitude, coords.longitude);
      if (cancelled) return;
      if (air !== null) {
        setAirTempC(air);
        setSurfaceTempC(Math.round(air * 1.3 + 2));
      }
      setLoading(false);
    }

    update();
    timerRef.current = setInterval(update, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return {
    surfaceTempC,
    airTempC,
    status: surfaceTempC !== null ? statusFor(surfaceTempC) : 'ok',
    loading,
  };
}
