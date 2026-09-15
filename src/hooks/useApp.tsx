import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Lang, t as translate, isRTL, loadSavedLang, saveLang } from '../i18n';
import { supabase } from '../lib/supabase';
import { LatLng } from '../lib/geo';
import { RadiusFilter } from '../components/MarkerFilterSheet';
import { useAsphaltTemp, HeatStatus, HourlyPoint } from './useAsphaltTemp';
import { checkAndAwardBadges } from '../lib/badges';
import { flushPendingWalkHistory } from '../lib/walkHistory';
import { emitDevSettingsChange } from '../constants/dev';

export interface HeatData {
  status: HeatStatus;
  surface_est_c: number;
  air_temp_c: number;
  // false when the weather source returned nothing (surfaceTempC null) — lets
  // the chip show "no data" instead of a misleading 0°.
  has_data: boolean;
}

export interface AbandonedWalk {
  distanceKm: number;
  startedAt: string;
  updatedAt: string;
}

export interface AppState {
  lang: Lang;
  rtl: boolean;
  setLang: (lang: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  heatData: HeatData;
  isHeatLoading: boolean;
  isWalking: boolean;
  setIsWalking: (v: boolean) => void;
  isGuest: boolean;
  setIsGuest: (v: boolean) => void;
  isTrusted: boolean;
  confirmedCount: number;
  refreshTrustStatus: () => void;
  radius: RadiusFilter;
  setRadius: (r: RadiusFilter) => void;
  activeCategories: Record<string, boolean>;
  toggleCategory: (key: string) => void;
  userLocation: LatLng | null;
  setUserLocation: (loc: LatLng) => void;
  abandonedWalk: AbandonedWalk | null;
  clearAbandonedWalk: () => void;
  feelsLikeC: number | null;
  weatherDescription: string | null;
  weatherIcon: string | null;
  hourlyForecast: HourlyPoint[];
  isFallbackLocation: boolean;
  // Диагностика dev-оверрайда температуры (читает только DevPanel).
  heatOverrideActive: boolean;
  realSurfaceTempC: number | null;
}

const DEFAULT_CATEGORIES: Record<string, boolean> = {
  park: true, dog_park: true, water: true, danger: true, hazard: true, aggressive_dog: true, forbidden: true,
};

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('he');
  const [isWalking, setIsWalking] = useState(false);
  const [isGuest, setIsGuest]     = useState(true);
  const [isTrusted, setIsTrusted]         = useState(false);
  const [confirmedCount, setConfirmedCount] = useState(0);
  const currentUserId = useRef<string | null>(null);

  async function fetchTrustStatus(userId: string) {
    const { data } = await supabase.rpc('get_trust_status', { p_user_id: userId });
    if (data?.[0]) {
      setIsTrusted(data[0].is_trusted);
      setConfirmedCount(data[0].confirmed_count);
      // Marker-count badges (marker_1/3/5/10/25) can only change here —
      // confirmed_count is the only place this app learns a marker got
      // confirmed by someone else. Fire-and-forget: no UI to show a new
      // badge from this trigger, ProfileScreen just reflects it next open.
      checkAndAwardBadges(data[0].confirmed_count);
    }
  }

  function refreshTrustStatus() {
    if (currentUserId.current) fetchTrustStatus(currentUserId.current);
  }

  // ── Forgotten-walk recovery ──────────────────────────────────────────────
  // Checked once per app session, right after a session becomes available.
  // Any leftover active_walks row (stale or fresh — full walk resume isn't
  // implemented, see WalkRecoveryModal) surfaces the recovery card.
  const [abandonedWalk, setAbandonedWalk] = useState<AbandonedWalk | null>(null);
  const hasCheckedAbandonedWalk = useRef(false);
  // Walks that failed to insert on finish (see saveWalkHistory) are delivered
  // once per app session, as soon as an authenticated session is available.
  const hasFlushedPendingWalks = useRef(false);

  function flushPendingWalksOnce() {
    if (hasFlushedPendingWalks.current) return;
    hasFlushedPendingWalks.current = true;
    flushPendingWalkHistory();
  }

  async function checkAbandonedWalk(userId: string) {
    if (hasCheckedAbandonedWalk.current) return;
    hasCheckedAbandonedWalk.current = true;
    const { data } = await supabase
      .from('active_walks')
      .select('distance_km, started_at, updated_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (data) {
      setAbandonedWalk({
        distanceKm: data.distance_km ?? 0,
        startedAt: data.started_at,
        updatedAt: data.updated_at,
      });
    }
  }

  function clearAbandonedWalk() {
    setAbandonedWalk(null);
  }

  // ── Live asphalt temperature (real OpenWeatherMap data, see useAsphaltTemp) ─
  const {
    surfaceTempC, airTempC, status: heatStatus, loading: isHeatLoading,
    feelsLikeC, weatherDescription, weatherIcon, hourlyForecast, isFallbackLocation,
    overrideActive: heatOverrideActive, realSurfaceTempC,
  } = useAsphaltTemp();
  const heatData: HeatData = {
    status: heatStatus,
    surface_est_c: surfaceTempC ?? 0,
    air_temp_c: airTempC ?? 0,
    has_data: surfaceTempC != null,
  };

  // ── Marker filter (shared between MapScreen and WalkScreen) ────────────────
  const [radius, setRadius] = useState<RadiusFilter>('all');
  const [activeCategories, setActiveCategories] = useState<Record<string, boolean>>(DEFAULT_CATEGORIES);
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);

  const toggleCategory = useCallback((key: string) => {
    setActiveCategories((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  useEffect(() => {
    loadSavedLang().then((savedLang) => {
      setLangState(savedLang);
    });
  }, []);

  // ── Sync isGuest with Supabase session ────────────────────────────────────
  // Runs once on mount (getSession) and then reactively on every auth change.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsGuest(!session?.user);
      // Dev-геттеры гейтятся по isDevUser и читаются один раз при монтировании
      // AppProvider — то есть до того, как сессия восстановлена. Без этого
      // пинка оверрайд оставался выключенным до следующего открытия DevPanel.
      emitDevSettingsChange();
      if (session?.user) {
        currentUserId.current = session.user.id;
        fetchTrustStatus(session.user.id);
        checkAbandonedWalk(session.user.id);
        flushPendingWalksOnce();
      }
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsGuest(!session?.user);
      // Логин/логаут меняет вердикт isDevUser — перечитать оверрайды.
      emitDevSettingsChange();
      if (session?.user) {
        currentUserId.current = session.user.id;
        fetchTrustStatus(session.user.id);
        checkAbandonedWalk(session.user.id);
        flushPendingWalksOnce();
      } else {
        currentUserId.current = null;
        setIsTrusted(false);
        setConfirmedCount(0);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const setLang = useCallback((newLang: Lang) => {
    setLangState(newLang);
    saveLang(newLang);
  }, []);

  const tFn = useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(key, lang, vars),
    [lang]
  );

  return (
    <AppContext.Provider
      value={{
        lang,
        rtl: isRTL(lang),
        setLang,
        t: tFn,
        heatData,
        isHeatLoading,
        isWalking,
        setIsWalking,
        isGuest,
        setIsGuest,
        isTrusted,
        confirmedCount,
        refreshTrustStatus,
        radius,
        setRadius,
        activeCategories,
        toggleCategory,
        userLocation,
        setUserLocation,
        abandonedWalk,
        clearAbandonedWalk,
        feelsLikeC,
        weatherDescription,
        weatherIcon,
        hourlyForecast,
        isFallbackLocation,
        heatOverrideActive,
        realSurfaceTempC,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
