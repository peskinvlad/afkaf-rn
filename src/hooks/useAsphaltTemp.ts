import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { LatLng } from '../lib/geo';
import { Lang } from '../i18n';
import { getDevAsphaltOverride, onDevSettingsChange } from '../constants/dev';
import { HeatStatus, statusFor, surfaceFromAir, getEffectiveAsphaltTemp } from '../lib/heat';

// App language → OpenWeatherMap `lang` code. OWM happens to use the same codes
// we do (he/en/ru), but map explicitly so a new app language can't silently
// fall back to English.
const OWM_LANG: Record<Lang, string> = { he: 'he', en: 'en', ru: 'ru' };

// Пороги и подмена оверрайдом живут в lib/heat.ts — здесь только ре-экспорт
// типа для существующих импортёров.
export type { HeatStatus };

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
const RETRY_DELAY_MS = 15 * 1000; // one retry per failed update, so a single network blip doesn't leave the widget stale for 30 min

interface AsphaltTempResult {
  surfaceTempC: number | null;
  airTempC: number | null;
  status: HeatStatus;
  loading: boolean;
  feelsLikeC: number | null;
  weatherDescription: string | null;
  weatherIcon: string | null;
  hourlyForecast: HourlyPoint[];
  isFallbackLocation: boolean;
  // Диагностика dev-оверрайда (DevPanel → Info). Для не-dev пользователей
  // overrideActive всегда false: гейт стоит в constants/dev.ts.
  overrideActive: boolean;
  realSurfaceTempC: number | null;
}

interface CurrentWeather {
  temp: number;
  feelsLike: number;
  description: string;
  icon: string;
}

async function fetchCurrentWeather(lat: number, lon: number, lang: Lang): Promise<CurrentWeather | null> {
  const key = process.env.EXPO_PUBLIC_OPENWEATHER_API_KEY;
  const res = await fetch(
    `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&lang=${OWM_LANG[lang]}&appid=${key}`
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

async function fetchForecast(lat: number, lon: number, lang: Lang): Promise<HourlyPoint[]> {
  const key = process.env.EXPO_PUBLIC_OPENWEATHER_API_KEY;
  const res = await fetch(
    `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&lang=${OWM_LANG[lang]}&appid=${key}`
  );
  if (!res.ok) return [];
  const data = await res.json();
  const list = (data.list ?? []).slice(0, 8);
  return list.map((entry: any) => {
    const airTempC = Math.round(entry.main.temp);
    const surfaceTempC = surfaceFromAir(airTempC);
    return {
      timeEpoch: entry.dt,
      airTempC,
      surfaceTempC,
      status: statusFor(surfaceTempC),
      icon: entry.weather?.[0]?.icon ?? '01d',
    };
  });
}

export function useAsphaltTemp(lang: Lang): AsphaltTempResult {
  const [surfaceTempC, setSurfaceTempC] = useState<number | null>(null);
  const [airTempC, setAirTempC] = useState<number | null>(null);
  const [feelsLikeC, setFeelsLikeC] = useState<number | null>(null);
  const [weatherDescription, setWeatherDescription] = useState<string | null>(null);
  const [weatherIcon, setWeatherIcon] = useState<string | null>(null);
  const [hourlyForecast, setHourlyForecast] = useState<HourlyPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFallbackLocation, setIsFallbackLocation] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Dev-only asphalt override (null for everyone outside DEV_USER_IDS — the
  // getter checks the list itself). OWM keeps fetching as usual; the override
  // only replaces the surface temperature on the way out, so the widget and
  // HeatWarning react to it as if it were real.
  const [devOverrideC, setDevOverrideC] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      getDevAsphaltOverride().then((v) => {
        if (!cancelled) setDevOverrideC(v);
      });
    };
    refresh();
    const unsubscribe = onDevSettingsChange(refresh);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    // Never throws — a failed update keeps the last successful data on screen
    // and reports success so the caller can schedule the single retry.
    async function update(): Promise<boolean> {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        let coords = FLORENTIN_FALLBACK;
        let usedFallback = true;
        if (status === 'granted') {
          // A failed fix (kCLErrorLocationUnknown — routine indoors) means the
          // Florentin fallback, same as a timeout. Letting it reject threw the
          // whole update, twice with the retry, and `loading` stayed true —
          // the heat chip hides while loading, so it vanished for 30 minutes.
          const locPromise = Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced, timeInterval: 3000 })
            .catch(() => null);
          const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000));
          const loc = await Promise.race([locPromise, timeoutPromise]);
          if (loc !== null) {
            coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
            usedFallback = false;
          }
        }
        if (cancelled) return true;
        setIsFallbackLocation(usedFallback);

        // Fire both requests in parallel, but unblock loading as soon as current weather arrives
        const currentPromise = fetchCurrentWeather(coords.latitude, coords.longitude, lang);
        const forecastPromise = fetchForecast(coords.latitude, coords.longitude, lang);

        const current = await currentPromise;
        if (cancelled) return true;
        if (current !== null) {
          setAirTempC(Math.round(current.temp));
          setSurfaceTempC(surfaceFromAir(current.temp));
          setFeelsLikeC(Math.round(current.feelsLike));
          setWeatherDescription(current.description);
          setWeatherIcon(current.icon);
        }
        setLoading(false);

        // Forecast arrives slightly later — update separately without blocking main UI
        const forecast = await forecastPromise;
        if (cancelled) return true;
        console.log('[useAsphaltTemp] hourlyForecast length:', forecast.length, 'first:', forecast[0]);
        setHourlyForecast(forecast);
        return true;
      } catch (e) {
        console.warn('[asphaltTemp] update failed:', e);
        return false;
      }
    }

    // One retry, RETRY_DELAY_MS later; the retry itself never re-schedules
    async function updateWithRetry() {
      const ok = await update();
      if (!ok && !cancelled) {
        if (retryTimer) clearTimeout(retryTimer);
        retryTimer = setTimeout(() => { update(); }, RETRY_DELAY_MS);
      }
    }

    updateWithRetry();
    timerRef.current = setInterval(updateWithRetry, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // lang is a dependency: switching language re-runs this effect, which fires
    // a fresh fetch right away, so the weather description is re-localized
    // immediately instead of waiting for the next 30-min refresh.
  }, [lang]);

  // Единая точка подмены — та же функция, что задаёт статус всем потребителям.
  const effective = getEffectiveAsphaltTemp(surfaceTempC, devOverrideC);

  return {
    surfaceTempC: effective.surfaceTempC,
    airTempC,
    status: effective.status,
    loading,
    feelsLikeC,
    weatherDescription,
    weatherIcon,
    hourlyForecast,
    isFallbackLocation,
    overrideActive: effective.overrideActive,
    realSurfaceTempC: effective.realSurfaceTempC,
  };
}
