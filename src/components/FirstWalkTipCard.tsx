import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '../hooks/useApp';
import { colors, radii, shadows } from '../theme/tokens';

const FLAG_KEY = 'first_walk_tip_shown';

interface Props {
  onSetupPrivacy: () => void;
}

// Shown once, ever, the first time a walk actually starts (mounted from
// WalkScreen — a step deliberately separate from the active_walks GPS/start
// logic, so it doesn't collide with the upcoming pre-start asphalt-temp
// safety intercept, which will gate the swipe itself, before navigation).
export function FirstWalkTipCard({ onSetupPrivacy }: Props) {
  const { t } = useApp();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(FLAG_KEY).then((v) => {
      if (v !== 'true') setVisible(true);
    });
  }, []);

  async function dismiss() {
    setVisible(false);
    await AsyncStorage.setItem(FLAG_KEY, 'true');
  }

  function handleSetupPrivacy() {
    dismiss();
    onSetupPrivacy();
  }

  if (!visible) return null;

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={[styles.card, shadows.lg]}>
        <Text style={styles.emoji}>🏠</Text>
        <Text style={styles.body}>{t('walk.firstTip.body')}</Text>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.btnPrimary} onPress={handleSetupPrivacy} activeOpacity={0.85}>
            <Text style={styles.btnPrimaryTxt}>{t('walk.firstTip.setupPrivacy')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnGhost} onPress={dismiss} activeOpacity={0.7}>
            <Text style={styles.btnGhostTxt}>{t('walk.firstTip.gotIt')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 60,
  },
  card: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    gap: 14,
  },
  emoji: { fontSize: 32 },
  body: {
    fontSize: 15,
    color: colors.ink,
    lineHeight: 21,
  },
  actions: { gap: 10 },
  btnPrimary: {
    minHeight: 48,
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  btnPrimaryTxt: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.white,
  },
  btnGhost: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhostTxt: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textMuted,
  },
});
