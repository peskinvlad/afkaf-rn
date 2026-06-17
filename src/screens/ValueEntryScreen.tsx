import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ImageBackground } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../hooks/useApp';
import { colors, radii, shadows, typography } from '../theme/tokens';

interface Props {
  navigation: any;
}

export function ValueEntryScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { t, rtl, setIsGuest } = useApp();

  function exploreMap() {
    setIsGuest(true);
    navigation.replace('Main');
  }

  function createAccount() {
    navigation.navigate('Register');
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Preview card (simulates map) */}
      <View style={styles.preview}>
        <View style={styles.mapPlaceholder}>
          <Text style={styles.mapEmoji}>🗺️</Text>
          <Text style={styles.mapLocation}>{t('value.preview')}</Text>
        </View>
      </View>

      {/* Bottom sheet */}
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={[styles.title, rtl && { textAlign: 'right', writingDirection: 'rtl' }]}>
          {t('value.title')}
        </Text>
        <Text style={[styles.subtitle, rtl && { textAlign: 'right', writingDirection: 'rtl' }]}>
          {t('value.subtitle')}
        </Text>

        <TouchableOpacity
          style={[styles.btnPrimary, shadows.md]}
          onPress={createAccount}
          activeOpacity={0.85}
        >
          <Text style={styles.btnPrimaryTxt}>{t('value.createAccount')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.btnSecondary}
          onPress={exploreMap}
          activeOpacity={0.8}
        >
          <Text style={styles.btnSecondaryTxt}>{t('value.explore')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  preview: {
    flex: 1,
    backgroundColor: colors.primaryLight,
  },
  mapPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  mapEmoji: {
    fontSize: 64,
  },
  mapLocation: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: '600',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 4,
  },
  btnPrimary: {
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnPrimaryTxt: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.white,
    letterSpacing: -0.3,
  },
  btnSecondary: {
    backgroundColor: colors.primaryLight,
    borderRadius: radii.lg,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnSecondaryTxt: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: -0.2,
  },
});
