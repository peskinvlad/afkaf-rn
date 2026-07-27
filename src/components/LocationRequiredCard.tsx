import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { useApp } from '../hooks/useApp';
import { colors, radii, shadows } from '../theme/tokens';

interface Props {
  onDismiss: () => void;
}

// Fully controlled by the caller (no AsyncStorage flag) — unlike
// FirstWalkTipCard, this isn't a one-time tip, it's shown every time a
// location-dependent action can't proceed without permission.
export function LocationRequiredCard({ onDismiss }: Props) {
  const { t } = useApp();

  function openSettings() {
    onDismiss();
    Linking.openSettings();
  }

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={[styles.card, shadows.lg]}>
        <Text style={styles.emoji}>📍</Text>
        <Text style={styles.title}>{t('location.required.title')}</Text>
        <Text style={styles.body}>{t('location.required.body')}</Text>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.btnPrimary} onPress={openSettings} activeOpacity={0.85}>
            <Text style={styles.btnPrimaryTxt}>{t('location.required.openSettings')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnGhost} onPress={onDismiss} activeOpacity={0.7}>
            <Text style={styles.btnGhostTxt}>{t('location.required.notNow')}</Text>
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
    gap: 10,
  },
  emoji: { fontSize: 32 },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink,
  },
  body: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  actions: { gap: 10, marginTop: 4 },
  btnPrimary: {
    minHeight: 56,
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  btnPrimaryTxt: {
    fontSize: 16,
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
