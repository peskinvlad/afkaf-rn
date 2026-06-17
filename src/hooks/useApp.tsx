import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Lang, t as translate, isRTL, loadSavedLang, saveLang, applyRTL } from '../i18n';
import { supabase } from '../lib/supabase';
import { LatLng } from '../lib/geo';
import { RadiusFilter } from '../components/MarkerFilterSheet';
import { useAsphaltTemp, HeatStatus } from './useAsphaltTemp';

export interface HeatData {
  status: HeatStatus;
  surface_est_c: number;
  air_temp_c: number;
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
}

const DEFAULT_CATEGORIES: Record<string, boolean> = {
  park: true, water: true, danger: true, hazard: true, aggressive_dog: true, forbidden: true,
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
    }
  }

  function refreshTrustStatus() {
    if (currentUserId.current) fetchTrustStatus(currentUserId.current);
  }

  // ── Live asphalt temperature (real OpenWeatherMap data, see useAsphaltTemp) ─
  const { surfaceTempC, airTempC, status: heatStatus, loading: isHeatLoading } = useAsphaltTemp();
  const heatData: HeatData = {
    status: heatStatus,
    surface_est_c: surfaceTempC ?? 0,
    air_temp_c: airTempC ?? 0,
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
      applyRTL(savedLang);
    });
  }, []);

  // ── Sync isGuest with Supabase session ────────────────────────────────────
  // Runs once on mount (getSession) and then reactively on every auth change.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsGuest(!session?.user);
      if (session?.user) {
        currentUserId.current = session.user.id;
        fetchTrustStatus(session.user.id);
      }
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsGuest(!session?.user);
      if (session?.user) {
        currentUserId.current = session.user.id;
        fetchTrustStatus(session.user.id);
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
    applyRTL(newLang);
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
