import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useApp } from '../hooks/useApp';
import { supabase } from '../lib/supabase';
import { checkAndAwardBadges } from '../lib/badges';
import { saveWalkHistory } from '../lib/walkHistory';
import { colors, radii, shadows } from '../theme/tokens';

const MIN_VALID_DISTANCE_KM = 0.3;
const MIN_VALID_DURATION_MIN = 5;

export function WalkRecoveryModal() {
  const { t, abandonedWalk, clearAbandonedWalk, confirmedCount } = useApp();

  if (!abandonedWalk) return null;

  const { distanceKm, startedAt, updatedAt } = abandonedWalk;
  const durationMin = Math.max(
    0,
    Math.floor((new Date(updatedAt).getTime() - new Date(startedAt).getTime()) / 60000)
  );
  const isValid = distanceKm >= MIN_VALID_DISTANCE_KM && durationMin >= MIN_VALID_DURATION_MIN;

  async function discard() {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (userId) {
      await supabase.from('active_walks').delete().eq('user_id', userId);
    }
    clearAbandonedWalk();
  }

  async function finish() {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (userId) {
      if (isValid) {
        const { data: dog } = await supabase
          .from('dogs')
          .select('id')
          .eq('owner_id', userId)
          .limit(1)
          .maybeSingle();
        await saveWalkHistory({
          user_id: userId,
          distance_km: distanceKm,
          duration_min: durationMin,
          // updatedAt is the last ping of the abandoned walk — the closest
          // real "end" we have. Steps/path weren't persisted → null.
          duration_s: Math.max(
            0,
            Math.floor((new Date(updatedAt).getTime() - new Date(startedAt).getTime()) / 1000)
          ),
          started_at: startedAt,
          ended_at: updatedAt,
          steps: null,
          dog_id: dog?.id ?? null,
          path: null,
          is_valid: isValid,
        });
        await checkAndAwardBadges(confirmedCount);
      }
      await supabase.from('active_walks').delete().eq('user_id', userId);
    }
    clearAbandonedWalk();
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={discard}>
      <View style={styles.backdrop}>
        <View style={[styles.card, shadows.lg]}>
          <Text style={styles.emoji}>🐾</Text>
          <Text style={styles.title}>{t('walkRecovery.title')}</Text>
          <Text style={styles.message}>{t('walkRecovery.message')}</Text>

          <View style={styles.statsRow}>
            <View style={styles.statCol}>
              <Text style={styles.statValue}>{distanceKm.toFixed(2)}</Text>
              <Text style={styles.statLabel}>{t('walk.active.km')}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={styles.statValue}>{durationMin}</Text>
              <Text style={styles.statLabel}>{t('walk.active.duration')}</Text>
            </View>
          </View>

          <View style={styles.actions}>
            {isValid && (
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary]}
                onPress={finish}
                activeOpacity={0.85}
              >
                <Text style={styles.btnPrimaryTxt}>{t('walkRecovery.finish')}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.btn, styles.btnSecondary]}
              onPress={discard}
              activeOpacity={0.85}
            >
              <Text style={styles.btnSecondaryTxt}>{t('walkRecovery.discard')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  emoji: { fontSize: 40 },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  message: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  statCol: { alignItems: 'center', paddingHorizontal: 20, gap: 2 },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.ink, letterSpacing: -0.5 },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statDivider: { width: 1, height: 32, backgroundColor: colors.border },
  actions: { width: '100%', gap: 10, marginTop: 8 },
  btn: {
    width: '100%',
    borderRadius: radii.lg,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnPrimary: { backgroundColor: colors.primary },
  btnPrimaryTxt: { fontSize: 15, fontWeight: '700', color: colors.white },
  btnSecondary: { backgroundColor: colors.surface },
  btnSecondaryTxt: { fontSize: 15, fontWeight: '600', color: colors.textMuted },
});
