import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isMapboxAvailable, MAPBOX_TOKEN } from './mapbox';

// Какая карта рисует экраны: старая (react-native-maps / Apple Maps) или Mapbox.
// Переезд идёт экран за экраном (feat/mapbox): каждый экран спрашивает
// useMapEngine() и рендерит свою Mapbox-версию только при 'mapbox'.
//
// Три уровня, от слабого к сильному:
//   1. DEFAULT_MAP_ENGINE — зашит в JS. Это «рубильник» для отката по воздуху:
//      опубликовали OTA с 'apple' — все вернулись на старую карту без новой сборки.
//   2. Выбор из DevPanel (хранится на устройстве) — чтобы сравнивать карты на
//      одном телефоне, не пересобирая.
//   3. Жёсткое условие: Mapbox возможен только если в сборке есть его нативная
//      часть И задан токен. Иначе всегда 'apple', что бы ни было выбрано.
export type MapEngine = 'apple' | 'mapbox';

export const DEFAULT_MAP_ENGINE: MapEngine = 'apple';

const STORAGE_KEY = 'dev_map_engine';

export const canUseMapbox: boolean = isMapboxAvailable && MAPBOX_TOKEN.length > 0;

let override: MapEngine | null = null;
let hydrated = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

function hydrate(): void {
  if (hydrated) return;
  hydrated = true;
  AsyncStorage.getItem(STORAGE_KEY)
    .then((v) => {
      if (v === 'apple' || v === 'mapbox') {
        override = v;
        notify();
      }
    })
    .catch(() => {});
}

// Прочитать выбор из DevPanel заранее, при старте приложения (index.ts). Без
// этого первый за сессию экран с картой успевал отрисовать старую карту и только
// потом, дочитав хранилище, менял её на Mapbox — «мигание» карт. В сборке без
// Mapbox читать нечего: движок всегда 'apple'.
export function preloadMapEngine(): void {
  if (canUseMapbox) hydrate();
}

export function getMapEngine(): MapEngine {
  if (!canUseMapbox) return 'apple';
  return override ?? DEFAULT_MAP_ENGINE;
}

// Выбор, сделанный в DevPanel (null — «как в сборке по умолчанию»).
export function getMapEngineOverride(): MapEngine | null {
  return override;
}

export async function setMapEngineOverride(next: MapEngine | null): Promise<void> {
  override = next;
  notify();
  try {
    if (next) await AsyncStorage.setItem(STORAGE_KEY, next);
    else await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // не сохранилось — действует до перезапуска
  }
}

// Меняется сразу при переключении в DevPanel, без перезапуска приложения.
export function useMapEngine(): MapEngine {
  const [engine, setEngine] = useState<MapEngine>(getMapEngine());
  useEffect(() => {
    hydrate();
    const fn = () => setEngine(getMapEngine());
    listeners.add(fn);
    fn();
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return engine;
}
