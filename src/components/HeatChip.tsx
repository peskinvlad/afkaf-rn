import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTypography, FontRole } from '../theme/fonts';
import { colors } from '../theme/tokens';
import { iconToLucide } from '../lib/weatherIcons';
import { ChipSeason, HeatStatus, weatherKind } from '../lib/heat';

// Внутренность чипа температуры (без обёртки TouchableOpacity/позиционирования —
// они живут в MapScreen/WalkScreen, у каждого свои ref/onLayout/расположение).
// Один источник для обоих экранов, чтобы летний и зимний вид не разъезжались.

export interface HeatChipData {
  status: HeatStatus;
  surface_est_c: number;
  air_temp_c: number;
  has_data: boolean;
}

interface Props {
  isLoading: boolean;
  season: ChipSeason;
  heatData: HeatChipData;
  weatherIcon: string | null;
  // Цвет летнего вида (heatVis по статусу опасности). Зимний вид игнорирует его
  // и красится спокойным синим.
  summerColor: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const WINTER_ICON_SIZE = 15;
const WINTER_ICON_STROKE = 1.8;

export function HeatChip({ isLoading, season, heatData, weatherIcon, summerColor, t }: Props) {
  const { font } = useTypography();
  const styles = useMemo(() => makeStyles(font), [font]);

  // Загрузка и «нет данных» — состояния без привязки к сезону (вид как раньше).
  if (isLoading) {
    return (
      <>
        <Text style={[styles.heatTemp, { color: summerColor }]}>—°</Text>
        <Text style={[styles.heatLabel, { color: summerColor }]}>⚠️ {t('map.heatLabel')}</Text>
      </>
    );
  }
  if (!heatData.has_data) {
    return <Text style={styles.heatUnavailable} numberOfLines={2}>{t('map.heatUnavailable')}</Text>;
  }

  if (season === 'winter') {
    // Погода СЕЙЧАС: значок + температура воздуха + подпись по типу погоды.
    const Icon = iconToLucide(weatherIcon ?? '');
    return (
      <>
        <Text style={[styles.heatTemp, { color: colors.winter }]}>{heatData.air_temp_c}°</Text>
        <View style={styles.winterRow}>
          <Icon size={WINTER_ICON_SIZE} color={colors.winter} strokeWidth={WINTER_ICON_STROKE} />
          <Text style={[styles.heatLabel, styles.winterLabel]}>{t(`weather.${weatherKind(weatherIcon)}`)}</Text>
        </View>
      </>
    );
  }

  // Лето: температура асфальта со статусным цветом (как было).
  return (
    <>
      <Text style={[styles.heatTemp, { color: summerColor }]}>{heatData.surface_est_c}°</Text>
      <Text style={[styles.heatLabel, { color: summerColor }]}>⚠️ {t('map.heatLabel')}</Text>
    </>
  );
}

// accessibilityLabel чипа. Летом возвращаем undefined — экранный диктор читает
// сами тексты (темп + «асфальт»). Зимой текст состоит из значка + подписи +
// числа, поэтому собираем явную подпись «{погода}, {t}°».
export function heatChipA11yLabel(
  isLoading: boolean,
  season: ChipSeason,
  heatData: HeatChipData,
  weatherIcon: string | null,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string | undefined {
  if (isLoading || !heatData.has_data || season !== 'winter') return undefined;
  return `${t(`weather.${weatherKind(weatherIcon)}`)}, ${heatData.air_temp_c}°`;
}

const makeStyles = (font: Record<FontRole, string>) => StyleSheet.create({
  heatUnavailable: { fontSize: 12, fontFamily: font.heading, color: colors.textSecondary },
  heatTemp: { fontSize: 18, fontFamily: font.heading, letterSpacing: -0.5 },
  heatLabel: { fontSize: 11, fontFamily: font.bodyBold, marginTop: 1 },
  winterRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 },
  winterLabel: { marginTop: 0, color: colors.winter },
});
