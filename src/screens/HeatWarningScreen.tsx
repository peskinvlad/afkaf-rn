import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../hooks/useApp';
import { HourlyPoint } from '../hooks/useAsphaltTemp';
import { colors, radii, shadows } from '../theme/tokens';

interface Props {
  navigation: any;
}

// Full-screen safety intercept — shown every time a walk would start with
// surface temp > 45°C (heatData.status === 'danger'). No AsyncStorage flag:
// this is a warning, not a one-time tip. Advisory, not a hard block — "go
// anyway" always works.
export function HeatWarningScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { t, heatData, hourlyForecast, setIsWalking } = useApp();

  // Same "first future forecast point back in the safe zone" logic as
  // PavementTempScreen's best-time card, duplicated locally (out of scope
  // to extract a shared helper here).
  const bestPoint: HourlyPoint | undefined = useMemo(
    () => hourlyForecast.find((pt) => pt.timeEpoch * 1000 > Date.now() && pt.status === 'ok'),
    [hourlyForecast]
  );

  function postpone() {
    navigation.goBack();
  }

  function goAnyway() {
    setIsWalking(true);
    navigation.replace('WalkActive');
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.content}>
        <Text style={styles.emoji}>🔥</Text>
        <Text style={styles.temp}>{heatData.surface_est_c}°C</Text>
        <Text style={styles.title}>{t('heat.warning.title')}</Text>
        <Text style={styles.body}>{t('heat.warning.body')}</Text>

        {bestPoint && (
          <View style={[styles.bestTimeCard, shadows.sm]}>
            <Text style={styles.bestTimeIcon}>🕐</Text>
            <View style={styles.bestTimeTextWrap}>
              <Text style={styles.bestTimeTitle}>{t('heat.best_time.title')}</Text>
              <Text style={styles.bestTimeBody}>
                {t('heat.best_time.after', {
                  time: new Date(bestPoint.timeEpoch * 1000).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  }),
                  temp: bestPoint.surfaceTempC,
                })}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Bottom third — thumb zone, one-handed */}
      <View style={[styles.actions, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity style={[styles.btnPrimary, shadows.md]} onPress={postpone} activeOpacity={0.85}>
          <Text style={styles.btnPrimaryTxt}>{t('heat.warning.postpone')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnSecondary} onPress={goAnyway} activeOpacity={0.7}>
          <Text style={styles.btnSecondaryTxt}>{t('heat.warning.goAnyway')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f5e0e0',
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 8,
  },
  emoji: { fontSize: 64, marginBottom: 4 },
  temp: {
    fontSize: 48,
    fontWeight: '800',
    color: colors.danger,
    letterSpacing: -1,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.ink,
    textAlign: 'center',
    letterSpacing: -0.4,
    marginTop: 8,
  },
  body: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 4,
  },
  bestTimeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: 14,
    marginTop: 20,
    width: '100%',
  },
  bestTimeIcon: { fontSize: 22 },
  bestTimeTextWrap: { flex: 1, gap: 2 },
  bestTimeTitle: { fontSize: 12, fontWeight: '700', color: colors.primary },
  bestTimeBody: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },

  actions: {
    paddingHorizontal: 24,
    gap: 10,
  },
  btnPrimary: {
    minHeight: 56,
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  btnPrimaryTxt: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.white,
    letterSpacing: -0.2,
  },
  btnSecondary: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondaryTxt: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textMuted,
  },
});
