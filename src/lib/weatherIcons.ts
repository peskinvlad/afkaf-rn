// Единый маппинг OpenWeatherMap-кодов иконок на lucide-иконки. Один источник
// для карточки прогноза (PavementTempScreen) и зимнего чипа температуры
// (HeatChip) — чтобы «ясно/облачно/дождь» выглядели одинаково везде.
// День/ночь различаем только для 01 (солнце/луна) и 02 (облако с солнцем/луной).
import React from 'react';
import {
  Sun, Moon, CloudSun, CloudMoon, Cloud, Cloudy,
  CloudDrizzle, CloudRain, CloudLightning, Snowflake, CloudFog,
} from 'lucide-react-native';

export type LucideIcon = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

export const OWM_ICON_MAP: Record<string, LucideIcon> = {
  '01d': Sun,    '01n': Moon,
  '02d': CloudSun, '02n': CloudMoon,
  '03d': Cloud,  '03n': Cloud,
  '04d': Cloudy, '04n': Cloudy,
  '09d': CloudDrizzle, '09n': CloudDrizzle,
  '10d': CloudRain, '10n': CloudRain,
  '11d': CloudLightning, '11n': CloudLightning,
  '13d': Snowflake, '13n': Snowflake,
  '50d': CloudFog, '50n': CloudFog,
};

export function iconToLucide(icon: string): LucideIcon {
  return OWM_ICON_MAP[icon] ?? Cloud;
}
