import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  I18nManager,
} from 'react-native';
import {
  Sun, Moon, CloudSun, CloudMoon, Cloud, Cloudy,
  CloudDrizzle, CloudRain, CloudLightning, Snowflake, CloudFog,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../hooks/useApp';
import { HourlyPoint } from '../hooks/useAsphaltTemp';
import { colors, radii, shadows, spacing, typography, heatVis } from '../theme/tokens';

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(epoch: number): string {
  const d = new Date(epoch * 1000);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

type LucideIcon = React.ComponentType<{ size?: number; color?: string }>;

const OWM_ICON_MAP: Record<string, LucideIcon> = {
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

function iconToLucide(icon: string): LucideIcon {
  return OWM_ICON_MAP[icon] ?? Cloud;
}

// Temperature scale: maps 0–55°C range to a 0–1 position, clamped
const SCALE_MAX = 55;
function scalePos(tempC: number): number {
  return Math.min(Math.max(tempC / SCALE_MAX, 0), 1);
}

const STATUS_ICON: Record<string, string> = {
  ok: '✅',
  caution: '⚠️',
  danger: '🔥',
};

const ZONE_COLORS = {
  ok:      { bg: colors.safeBg,     text: colors.safe },
  caution: { bg: colors.cautionBg,  text: colors.caution },
  danger:  { bg: colors.dangerBg,   text: colors.danger },
} as const;

const TIPS_KEYS = ['heat.tips.0', 'heat.tips.1', 'heat.tips.2'] as const;

// ── Component ─────────────────────────────────────────────────────────────────

export function PavementTempScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { t, heatData, feelsLikeC, weatherDescription, weatherIcon, hourlyForecast } = useApp();

  const status = heatData.status;
  const vis = heatVis[status];
  const zoneColor = ZONE_COLORS[status];
  const rtl = I18nManager.isRTL;

  const nowEpoch = Date.now() / 1000;

  // Index of the forecast card closest to now
  const currentIdx = useMemo(() => {
    if (!hourlyForecast.length) return 0;
    return hourlyForecast.reduce((best, pt, i) =>
      Math.abs(pt.timeEpoch - nowEpoch) < Math.abs(hourlyForecast[best].timeEpoch - nowEpoch)
        ? i : best,
      0,
    );
  }, [hourlyForecast, nowEpoch]);

  // First future point with status 'ok' — timeEpoch is unix seconds, Date.now() is ms
  const bestPoint: HourlyPoint | undefined = useMemo(
    () => hourlyForecast.find(pt => pt.timeEpoch * 1000 > Date.now() && pt.status === 'ok'),
    [hourlyForecast],
  );

  const sliderPct = scalePos(heatData.surface_est_c) * 100;
  const nowStr = fmtTime(Date.now() / 1000);

  console.log('[PavementTemp] hourlyForecast in render:', hourlyForecast?.length);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <View style={[styles.header, rtl && styles.rowReverse]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backArrow}>{rtl ? '→' : '←'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('heat.screen.title')}</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── A. Main status card ── */}
        <View style={[styles.statusCard, { backgroundColor: zoneColor.bg }, shadows.md]}>
          <Text style={styles.statusIcon}>{STATUS_ICON[status]}</Text>
          <Text style={[styles.tempValue, { color: zoneColor.text }]}>
            {heatData.surface_est_c}°C
          </Text>
          <Text style={[styles.zoneName, { color: zoneColor.text }]}>
            {t(`heat.zone.${status === 'ok' ? 'safe' : status}`)}
          </Text>
          <Text style={[styles.advice, { color: zoneColor.text }]}>
            {t(`heat.advice.${status}`)}
          </Text>
        </View>

        {/* ── B. Air card ── */}
        <View style={[styles.airCard, shadows.sm]}>
          <View style={styles.airLeft}>
            <View style={styles.airMainRow}>
              {/* emoji in plain Text — custom fontFamily blocks system emoji rendering */}
              <Text style={styles.airEmoji}>🌡️</Text>
              <Text style={styles.airMain}>
                {heatData.air_temp_c}°{weatherDescription ? ` · ${weatherDescription}` : ''}
              </Text>
            </View>
            <Text style={styles.airSub}>{t('heat.warn.air')}</Text>
          </View>
          <Text style={styles.airTime}>{nowStr}</Text>
        </View>

        {/* ── C. Temperature scale ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('heat.scale.title')}</Text>

          {/* gradient bar (3-zone approximation, no LinearGradient dependency) */}
          <View style={styles.scaleOuter}>
            <View style={styles.scaleBar}>
              <View style={[styles.scaleSegment, { flex: 35, backgroundColor: colors.safe }]} />
              <View style={[styles.scaleSegment, { flex: 10, backgroundColor: colors.sun }]} />
              <View style={[styles.scaleSegment, { flex: 10, backgroundColor: colors.danger }]} />
            </View>
            {/* slider */}
            <View style={[styles.sliderKnob, { left: `${sliderPct}%` as any }]} />
          </View>

          {/* scale labels */}
          <View style={styles.scaleLabels}>
            <Text style={[styles.scaleLabel, { color: colors.safe }]}>{t('heat.scale.cool')}</Text>
            <Text style={[styles.scaleLabel, { color: colors.caution }]}>{t('heat.scale.caution')}</Text>
            <Text style={[styles.scaleLabel, { color: colors.danger }]}>{t('heat.scale.danger')}</Text>
          </View>
        </View>

        {/* ── D. Hourly forecast ── */}
        {hourlyForecast.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('heat.forecast.title')}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.forecastRow}
              nestedScrollEnabled
              style={styles.forecastScroll}
            >
              {hourlyForecast.map((pt, i) => {
                console.log('[PavementTemp] rendering forecast card', i, pt.timeEpoch);
                const ptVis = heatVis[pt.status];
                const isCurrent = i === currentIdx;
                const WeatherIcon = iconToLucide(pt.icon);
                return (
                  <View
                    key={pt.timeEpoch}
                    style={[
                      styles.forecastCard,
                      isCurrent && { borderWidth: 2, borderColor: vis.color },
                    ]}
                  >
                    <Text style={[styles.forecastTime, isCurrent && styles.forecastTimeBold]}>
                      {fmtTime(pt.timeEpoch)}
                    </Text>
                    <WeatherIcon size={32} color="#888" strokeWidth={1.5} />
                    <Text style={styles.forecastAir}>{pt.airTempC}°</Text>
                    <Text style={[styles.forecastSurface, { color: ptVis.color }]}>
                      {pt.surfaceTempC}°
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ── E. Best time card ── */}
        <View style={[styles.bestTimeCard, shadows.sm]}>
          <View style={[styles.rowReverse, { alignItems: 'center', gap: spacing.sm }]}>
            <Text style={styles.bestTimeIcon}>🕐</Text>
            <Text style={[styles.bestTimeTitle, { color: colors.primary }]}>
              {t('heat.best_time.title')}
            </Text>
          </View>
          <Text style={styles.bestTimeBody}>
            {bestPoint
              ? t('heat.best_time.after', {
                  time: fmtTime(bestPoint.timeEpoch),
                  temp: bestPoint.surfaceTempC,
                })
              : t('heat.best_time.none')}
          </Text>
        </View>

        {/* ── F. 7-second rule ── */}
        <View style={[styles.rule7Card, shadows.sm]}>
          <Text style={styles.rule7Header}>✋  {t('heat.rule7.title')}</Text>
          <Text style={styles.rule7Body}>{t('heat.rule7.body')}</Text>
        </View>

        {/* ── G. Tips ── */}
        <Text style={styles.tipsTitle}>{t('heat.screen.tips_title')}</Text>
        <View style={[styles.tipsCard, shadows.sm]}>
          {TIPS_KEYS.map((key, i) => (
            <View key={key} style={[styles.tipRow, i > 0 && styles.tipDivider]}>
              <Text style={styles.tipBullet}>•</Text>
              <Text style={styles.tipText}>{t(key)}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface,
  },

  // header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  rowReverse: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
  },
  backBtn: {
    width: 36,
    alignItems: 'center',
  },
  backArrow: {
    fontSize: 20,
    color: colors.ink,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.ink,
    flex: 1,
    textAlign: 'center',
  },

  // scroll container
  scroll: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },

  // A. Status card
  statusCard: {
    borderRadius: radii.lg,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xxl,
    alignItems: 'center',
    gap: spacing.xs,
  },
  statusIcon: {
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  tempValue: {
    fontSize: 64,
    fontFamily: 'Nunito_800ExtraBold',
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: 70,
  },
  zoneName: {
    ...typography.h2,
    marginTop: spacing.xs,
  },
  advice: {
    ...typography.body,
    textAlign: 'center',
    marginTop: spacing.xs,
    opacity: 0.85,
  },

  // B. Air card
  airCard: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  airLeft: {
    flex: 1,
    gap: 2,
  },
  airMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  airEmoji: {
    fontSize: 18,
  },
  airMain: {
    ...typography.h3,
    color: colors.ink,
  },
  airSub: {
    ...typography.sm,
    color: colors.textMuted,
  },
  airTime: {
    ...typography.h3,
    color: colors.textMuted,
  },

  // C. Scale
  section: {
    gap: spacing.sm,
  },
  sectionLabel: {
    ...typography.xs,
    color: colors.textMuted,
    letterSpacing: 0.8,
    marginLeft: spacing.xs,
  },
  scaleOuter: {
    position: 'relative',
    height: 24,
    justifyContent: 'center',
  },
  scaleBar: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
  },
  scaleSegment: {
    height: 12,
  },
  sliderKnob: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    top: 2,
    marginLeft: -10,
    ...shadows.sm,
  },
  scaleLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  scaleLabel: {
    ...typography.xs,
    fontFamily: 'Nunito_600SemiBold',
    fontWeight: '600',
  },

  // D. Forecast
  forecastScroll: {
    height: 128,
  },
  forecastRow: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    alignItems: 'center',
  },
  forecastCard: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    gap: 2,
    minWidth: 68,
    ...shadows.sm,
  },
  forecastTime: {
    ...typography.xs,
    color: colors.textMuted,
  },
  forecastTimeBold: {
    fontFamily: 'Nunito_700Bold',
    fontWeight: '700',
    color: colors.ink,
  },
  forecastAir: {
    ...typography.xs,
    color: colors.textMuted,
  },
  forecastSurface: {
    ...typography.sm,
    fontFamily: 'Nunito_700Bold',
    fontWeight: '700',
  },

  // E. Best time
  bestTimeCard: {
    backgroundColor: '#e8f0e6',
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  bestTimeIcon: {
    fontSize: 18,
  },
  bestTimeTitle: {
    ...typography.h3,
  },
  bestTimeBody: {
    ...typography.body,
    color: colors.ink,
  },

  // F. 7-second rule
  rule7Card: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  rule7Header: {
    ...typography.h3,
    color: colors.ink,
  },
  rule7Body: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },

  // G. Tips
  tipsTitle: {
    ...typography.xs,
    color: colors.textMuted,
    letterSpacing: 0.8,
    marginLeft: spacing.xs,
  },
  tipsCard: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  tipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    alignItems: 'flex-start',
  },
  tipDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tipBullet: {
    ...typography.body,
    color: colors.primary,
    lineHeight: 22,
  },
  tipText: {
    ...typography.body,
    color: colors.ink,
    flex: 1,
    lineHeight: 22,
  },
});
