import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { LatLng } from '../lib/geo';

export type HeatStatus = 'ok' | 'caution' | 'danger';

export type HourlyPoint = {
  timeEpoch: number;
  airTempC: number;
  surfaceTempC: number;
  status: HeatStatus;
  icon: string;
};

// Florentin, Tel Aviv — used if location permission is denied/unavailable
const FLORENTIN_FALLBACK: LatLng = { latitude: 32.0559, longitude: 34.7722 };

const REFRESH_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes, same cadence as the PWA

interface AsphaltTempResult {
  surfaceTempC: number | null;
  airTempC: number | null;
  status: HeatStatus;
  loading: boolean;
  feelsLikeC: number | null;
  weatherDescription: string | null;
  weatherIcon: string | null;
  hourlyForecast: HourlyPoint[];
}

function statusFor(surfaceTempC: number): HeatStatus {
  if (surfaceTempC < 35) return 'ok';
  if (surfaceTempC <= 45) return 'caution';
  return 'danger';
}

interface CurrentWeather {
  temp: number;
  feelsLike: number;
  description: string;
  icon: string;
}

async function fetchCurrentWeather(lat: number, lon: number): Promise<CurrentWeather | null> {
  const key = process.env.EXPO_PUBLIC_OPENWEATHER_API_KEY;
  const res = await fetch(
    `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${key}`
  );
  if (!res.ok) return null;
  const data = await res.json();
  return {
    temp: data.main.temp as number,
    feelsLike: data.main.feels_like as number,
    description: data.weather?.[0]?.description ?? '',
    icon: data.weather?.[0]?.icon ?? '01d',
  };
}

async function fetchForecast(lat: number, lon: number): Promise<HourlyPoint[]> {
  const key = process.env.EXPO_PUBLIC_OPENWEATHER_API_KEY;
  const res = await fetch(
    `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${key}`
  );
  if (!res.ok) return [];
  const data = await res.json();
  const list = (data.list ?? []).slice(0, 8);
  return list.map((entry: any) => {
    const airTempC = Math.round(entry.main.temp);
    const surfaceTempC = Math.round(airTempC * 1.3 + 2);
    return {
      timeEpoch: entry.dt,
      airTempC,
      surfaceTempC,
      status: statusFor(surfaceTempC),
      icon: entry.weather?.[0]?.icon ?? '01d',
    };
  });
}

export function useAsphaltTemp(): AsphaltTempResult {
  const [surfaceTempC, setSurfaceTempC] = useState<number | null>(null);
  const [airTempC, setAirTempC] = useState<number | null>(null);
  const [feelsLikeC, setFeelsLikeC] = useState<number | null>(null);
  const [weatherDescription, setWeatherDescription] = useState<string | null>(null);
  const [weatherIcon, setWeatherIcon] = useState<string | null>(null);
  const [hourlyForecast, setHourlyForecast] = useState<HourlyPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function update() {
      const { status } = await Location.requestForegroundPermissionsAsync();
      let coords = FLORENTIN_FALLBACK;
      if (status === 'granted') {
        const locPromise = Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced, timeInterval: 3000 });
        const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000));
        const loc = await Promise.race([locPromise, timeoutPromise]);
        if (loc !== null) {
          coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        }
      }

      // Fire both requests in parallel, but unblock loading as soon as current weather arrives
      const currentPromise = fetchCurrentWeather(coords.latitude, coords.longitude);
      const forecastPromise = fetchForecast(coords.latitude, coords.longitude);

      const current = await currentPromise;
      if (cancelled) return;
      if (current !== null) {
        setAirTempC(Math.round(current.temp));
        setSurfaceTempC(Math.round(current.temp * 1.3 + 2));
        setFeelsLikeC(Math.round(current.feelsLike));
        setWeatherDescription(current.description);
        setWeatherIcon(current.icon);
      }
      setLoading(false);

      // Forecast arrives slightly later — update separately without blocking main UI
      const forecast = await forecastPromise;
      if (cancelled) return;
      console.log('[useAsphaltTemp] hourlyForecast length:', forecast.length, 'first:', forecast[0]);
      setHourlyForecast(forecast);
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
    feelsLikeC,
    weatherDescription,
    weatherIcon,
    hourlyForecast,
  };
}
