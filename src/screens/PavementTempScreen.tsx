import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  I18nManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../hooks/useApp';
import { useTypography } from '../theme/fonts';
import { pickBestWalkTime, effectiveChipSeason, weatherKind } from '../lib/heat';
import { pickDryWindow } from '../lib/winterWalk';
import { iconToLucide } from '../lib/weatherIcons';
import { colors, radii, shadows, spacing, typography, heatVis } from '../theme/tokens';

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(epoch: number): string {
  const d = new Date(epoch * 1000);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

// One size + one stroke for every weather icon. Icons that read optically
// smaller in the same bounding box get a size multiplier — never a stroke
// change. Keyed by OWM code (day/night pairs listed together). The icon is
// rendered inside a fixed WEATHER_ICON_SIZE box so multipliers don't shift
// the forecast card layout.
const WEATHER_ICON_SIZE = 32;
const WEATHER_ICON_STROKE = 1.5;
const WEATHER_ICON_OPTICAL: Record<string, number> = {
  '03d': 1.15, '03n': 1.15, // Cloud — squat single-cloud glyph
};

function weatherIconSize(icon: string): number {
  return Math.round(WEATHER_ICON_SIZE * (WEATHER_ICON_OPTICAL[icon] ?? 1));
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
  const { t, heatData, chipSeason, feelsLikeC, weatherDescription, weatherIcon, hourlyForecast, isFallbackLocation } = useApp();
  const ty = useTypography();
  const styles = useMemo(() => makeStyles(ty), [ty]);

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

  // Best walk window: shared with HeatWarningScreen, limited to waking hours,
  // and aware of today vs tomorrow. See pickBestWalkTime in lib/heat.
  const bestTime = useMemo(
    () => pickBestWalkTime(hourlyForecast, status, Date.now()),
    [hourlyForecast, status],
  );

  // Зимний вид — тот же источник правды, что у чипа на карте: chipSeason из
  // useApp (авто-логика + dev-оверрайд «Зима») через effectiveChipSeason, так что
  // caution/danger по асфальту всегда даёт летний экран. Без данных — летний.
  const isWinter = heatData.has_data && effectiveChipSeason(chipSeason, status) === 'winter';

  const nowKind = weatherKind(weatherIcon);
  const dryWindow = useMemo(
    () => pickDryWindow(hourlyForecast, Date.now(), nowKind === 'rain' || nowKind === 'storm'),
    [hourlyForecast, nowKind],
  );

  const sliderPct = scalePos(heatData.surface_est_c) * 100;
  const nowStr = fmtTime(Date.now() / 1000);

  if (isWinter) {
    const NowIcon = iconToLucide(weatherIcon ?? '');
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={[styles.header, rtl && styles.rowReverse]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.backArrow}>{rtl ? '→' : '←'}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('winter.screen.title')}</Text>
          <View style={styles.backBtn} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* ── 1. Погода сейчас ── */}
          <View style={[styles.statusCard, { backgroundColor: colors.winterBg }, shadows.md]}>
            <NowIcon size={44} color={colors.winter} strokeWidth={WEATHER_ICON_STROKE} />
            <Text style={[styles.tempValue, { color: colors.winter }]}>{heatData.air_temp_c}°</Text>
            <Text style={[styles.zoneName, { color: colors.winter }]}>{t(`weather.${nowKind}`)}</Text>
            {feelsLikeC != null && (
              <Text style={[styles.advice, { color: colors.winter }]}>
                {t('winter.feels_like', { n: feelsLikeC })}
              </Text>
            )}
          </View>

          {isFallbackLocation && (
            <Text style={styles.fallbackLocationCaption}>{t('heat.fallback_location.caption')}</Text>
          )}

          {/* ── 2. Ближайшие 24 часа: время, значок, воздух, вероятность дождя ── */}
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
                  const isCurrent = i === currentIdx;
                  const WeatherIcon = iconToLucide(pt.icon);
                  const popPct = Math.round(pt.pop * 100);
                  return (
                    <View
                      key={pt.timeEpoch}
                      style={[
                        styles.forecastCard,
                        isCurrent && { borderWidth: 2, borderColor: colors.winter },
                      ]}
                    >
                      <Text style={[styles.forecastTime, isCurrent && styles.forecastTimeBold]}>
                        {fmtTime(pt.timeEpoch)}
                      </Text>
                      <View style={styles.forecastIconBox}>
                        <WeatherIcon size={weatherIconSize(pt.icon)} color={colors.winter} strokeWidth={WEATHER_ICON_STROKE} />
                      </View>
                      <Text style={[styles.forecastSurface, { color: colors.ink }]}>{pt.airTempC}°</Text>
                      {/* Фиксированная высота строки: карточки без дождя не «прыгают». */}
                      <View style={styles.popRow}>
                        {popPct > 0 && <Text style={styles.popText}>{popPct}%</Text>}
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* ── 3. Лучшее время: когда сухо ── */}
          {dryWindow.kind !== 'none' && (
            <View style={[styles.bestTimeCard, { backgroundColor: colors.winterBg }, shadows.sm]}>
              <View style={[styles.rowReverse, { alignItems: 'center', gap: spacing.sm }]}>
                <Text style={styles.bestTimeIcon}>🕐</Text>
                <Text style={[styles.bestTimeTitle, { color: colors.winter }]}>
                  {t('heat.best_time.title')}
                </Text>
              </View>
              <Text style={styles.bestTimeBody}>
                {t(
                  `winter.window.${dryWindow.kind}`,
                  'timeEpoch' in dryWindow ? { time: fmtTime(dryWindow.timeEpoch) } : undefined,
                )}
              </Text>
            </View>
          )}

          {/* ── 4. Асфальт — одной мелкой строкой ── */}
          <Text style={styles.sunnySideNote}>{t('winter.asphalt_note', { temp: heatData.surface_est_c })}</Text>
        </ScrollView>
      </View>
    );
  }

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

        {/* Модель считает нагрев для открытого солнца — честно предупреждаем,
            что в тени прохладнее. Мелкий серый текст, дизайн карточки не трогаем. */}
        <Text style={styles.sunnySideNote}>{t('heat.sunny_side.note')}</Text>

        {/* Fallback-location caption — only when coords are FLORENTIN_FALLBACK,
            not compared here: useAsphaltTemp already tracks this itself. */}
        {isFallbackLocation && (
          <Text style={styles.fallbackLocationCaption}>{t('heat.fallback_location.caption')}</Text>
        )}

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
                    <View style={styles.forecastIconBox}>
                      <WeatherIcon size={weatherIconSize(pt.icon)} color="#888" strokeWidth={WEATHER_ICON_STROKE} />
                    </View>
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
            {bestTime.kind === 'now'
              ? t('heat.best_time.now')
              : bestTime.kind === 'none'
              ? t('heat.best_time.none')
              : t(`heat.best_time.${bestTime.kind}`, {
                  time: fmtTime(bestTime.timeEpoch),
                  temp: bestTime.surfaceTempC,
                })}
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

const makeStyles = (ty: ReturnType<typeof useTypography>) => StyleSheet.create({
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
    fontFamily: ty.font.body,
    color: colors.ink,
  },
  headerTitle: {
    ...ty.variants.h2,
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
  fallbackLocationCaption: {
    fontSize: 11,
    fontFamily: ty.font.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: -spacing.sm,
  },
  sunnySideNote: {
    fontSize: 11,
    fontFamily: ty.font.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: -spacing.xs,
  },
  statusIcon: {
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  tempValue: {
    fontSize: 64,
    fontFamily: ty.font.display,
    letterSpacing: -1,
    lineHeight: 70,
  },
  zoneName: {
    ...ty.variants.h2,
    marginTop: spacing.xs,
  },
  advice: {
    ...ty.variants.body,
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
    ...ty.variants.h3,
    color: colors.ink,
  },
  airSub: {
    ...ty.variants.sm,
    color: colors.textMuted,
  },
  airTime: {
    ...ty.variants.h3,
    color: colors.textMuted,
  },

  // C. Scale
  section: {
    gap: spacing.sm,
  },
  sectionLabel: {
    ...ty.variants.xs,
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
    ...ty.variants.xs,
    fontFamily: ty.font.bodyBold,
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
    ...ty.variants.xs,
    color: colors.textMuted,
  },
  forecastIconBox: {
    width: WEATHER_ICON_SIZE,
    height: WEATHER_ICON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  forecastTimeBold: {
    fontFamily: ty.font.heading,
    color: colors.ink,
  },
  forecastAir: {
    ...ty.variants.xs,
    color: colors.textMuted,
  },
  forecastSurface: {
    ...ty.variants.sm,
    fontFamily: ty.font.heading,
  },

  // Winter forecast: строка вероятности дождя
  popRow: {
    height: 16,
    justifyContent: 'center',
  },
  popText: {
    ...ty.variants.xs,
    fontFamily: ty.font.bodyBold,
    color: colors.winter,
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
    ...ty.variants.h3,
  },
  bestTimeBody: {
    ...ty.variants.body,
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
    ...ty.variants.h3,
    color: colors.ink,
  },
  rule7Body: {
    ...ty.variants.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },

  // G. Tips
  tipsTitle: {
    ...ty.variants.xs,
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
    ...ty.variants.body,
    color: colors.primary,
    lineHeight: 22,
  },
  tipText: {
    ...ty.variants.body,
    color: colors.ink,
    flex: 1,
    lineHeight: 22,
  },
});
