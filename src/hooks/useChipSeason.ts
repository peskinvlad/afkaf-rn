import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ChipSeason,
  ChipSeasonPref,
  next24hMaxSurface,
  resolveSeason,
  isCalendarWinter,
} from '../lib/heat';
import { HourlyPoint } from './useAsphaltTemp';
import { getDevChipSeason, onDevSettingsChange } from '../constants/dev';

// Сохранённый авто-режим чипа. Нужен, чтобы в полосе гистерезиса (33…37 °C)
// после перезапуска держать прошлый режим, а не угадывать заново до прихода
// свежих данных.
const SEASON_KEY = 'chip_season_mode';

// Режим чипа температуры: 'winter' / 'summer'. Авто-логика по максимуму асфальта
// за 24 ч с гистерезисом (lib/heat); dev-оверрайд ('winter'/'summer') перебивает
// авто, но только для DEV_USER_IDS и без сохранения.
export function useChipSeason(
  surfaceTempC: number | null,
  hourlyForecast: HourlyPoint[],
): ChipSeason {
  // Коммиченный авто-режим. Ref — чтобы кормить гистерезис как prev, state —
  // чтобы вызывать перерисовку при смене.
  const prevRef = useRef<ChipSeason | null>(null);
  const [auto, setAuto] = useState<ChipSeason>('summer');
  const [hydrated, setHydrated] = useState(false);
  const [pref, setPref] = useState<ChipSeasonPref>('auto');

  // Разовая загрузка сохранённого режима. До её завершения авто-пересчёт не
  // запускаем, иначе первый тик (данных ещё нет) затёр бы сохранённое значение.
  useEffect(() => {
    AsyncStorage.getItem(SEASON_KEY)
      .then((raw) => {
        if (raw === 'winter' || raw === 'summer') {
          prevRef.current = raw;
          setAuto(raw);
        }
      })
      .catch(() => {
        // Нет доступа к хранилищу — просто стартуем с летнего вида по умолчанию.
      })
      .finally(() => setHydrated(true));
  }, []);

  // Dev-оверрайд режима (у обычного пользователя всегда 'auto').
  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      getDevChipSeason().then((v) => {
        if (!cancelled) setPref(v);
      });
    };
    refresh();
    const unsubscribe = onDevSettingsChange(refresh);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  // Пересчёт авто-режима при изменении данных (только после гидратации).
  useEffect(() => {
    if (!hydrated) return;
    const max = next24hMaxSurface(surfaceTempC, hourlyForecast, Date.now());
    const next = resolveSeason(max, prevRef.current);
    if (next !== prevRef.current) {
      prevRef.current = next;
      setAuto(next);
      AsyncStorage.setItem(SEASON_KEY, next).catch(() => {
        // Лучшее усилие: при сбое записи следующий холодный старт возьмёт
        // прошлое сохранённое значение — не критично.
      });
    }
  }, [hydrated, surfaceTempC, hourlyForecast]);

  // Dev-оверрайд перебивает всё. Иначе в декабре–феврале режим зимний по
  // календарю (lib/heat: isCalendarWinter); гистерезис при этом продолжает
  // считаться и сохраняться в фоне, чтобы 1 марта стартовать с актуального.
  if (pref !== 'auto') return pref;
  return isCalendarWinter(Date.now()) ? 'winter' : auto;
}
