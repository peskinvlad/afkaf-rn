import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useApp, AutoFinishedNotice } from '../hooks/useApp';
import { supabase } from '../lib/supabase';
import { finalizeWalk, isValidWalk } from '../lib/walkFinalize';
import { formatClock } from '../lib/autoFinish';
import { colors, radii, shadows } from '../theme/tokens';

export function WalkRecoveryModal() {
  const { t, abandonedWalk, clearAbandonedWalk, confirmedCount, autoFinishedWalk, clearAutoFinishedWalk } = useApp();

  if (autoFinishedWalk) {
    return <AutoFinishedCard walk={autoFinishedWalk} t={t} onClose={clearAutoFinishedWalk} />;
  }
  if (!abandonedWalk) return null;

  const { distanceKm, startedAt, updatedAt } = abandonedWalk;
  const durationS = Math.max(
    0,
    Math.floor((new Date(updatedAt).getTime() - new Date(startedAt).getTime()) / 1000)
  );
  const durationMin = Math.floor(durationS / 60);
  const isValid = isValidWalk(distanceKm, durationS);

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
        await finalizeWalk({
          startedAt,
          // updatedAt is the last ping of the abandoned walk — the closest
          // real "end" we have. Steps/path weren't persisted → null.
          endedAt: updatedAt,
          durationS,
          distanceKm,
          steps: null,
          path: null,
          confirmedCount,
          checkPersonalBest: false,
        });
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

// Auto-finished walk found on a cold start (useApp already saved it, cut at T).
// Informational only: one button, nothing left to decide.
function AutoFinishedCard({
  walk,
  t,
  onClose,
}: {
  walk: AutoFinishedNotice;
  t: (key: string, vars?: Record<string, string | number>) => string;
  onClose: () => void;
}) {
  const time = formatClock(new Date(walk.endedAt).getTime());
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, shadows.lg]}>
          <Text style={styles.emoji}>🏠</Text>
          <Text style={styles.title}>{t('walkAuto.title')}</Text>
          <Text style={styles.message}>{t(`walk.summary.autoFinished.${walk.reason}`, { time })}</Text>

          <View style={styles.statsRow}>
            <View style={styles.statCol}>
              <Text style={styles.statValue}>{walk.distanceKm.toFixed(2)}</Text>
              <Text style={styles.statLabel}>{t('walk.active.km')}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={styles.statValue}>{Math.floor(walk.durationS / 60)}</Text>
              <Text style={styles.statLabel}>{t('walk.active.duration')}</Text>
            </View>
          </View>

          {!walk.isValidWalk && <Text style={styles.message}>{t('walkAuto.tooShort')}</Text>}

          <View style={styles.actions}>
            <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={onClose} activeOpacity={0.85}>
              <Text style={styles.btnPrimaryTxt}>{t('common.done')}</Text>
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
