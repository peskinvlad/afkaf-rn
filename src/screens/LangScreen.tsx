import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../hooks/useApp';
import { LANGS, Lang } from '../i18n';
import { colors, radii, shadows, typography, spacing } from '../theme/tokens';

interface Props {
  navigation: any;
}

export function LangScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { setLang, t } = useApp();

  function selectLang(lang: Lang) {
    setLang(lang);
    navigation.replace('Onboarding');
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.logo}>
        <Text style={styles.logoText}>🐾</Text>
        <Text style={styles.logoName}>afkaf</Text>
      </View>

      <Text style={styles.tagline}>בחר שפה · Select language · Выберите язык</Text>

      <View style={styles.langList}>
        {LANGS.map((l) => (
          <TouchableOpacity
            key={l.code}
            style={[styles.langBtn, shadows.md]}
            onPress={() => selectLang(l.code)}
            activeOpacity={0.8}
          >
            <Text style={[styles.langLabel, l.rtl && styles.langLabelRTL]}>{l.label}</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  logo: {
    alignItems: 'center',
    marginBottom: 12,
  },
  logoText: {
    fontSize: 56,
  },
  logoName: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.8,
    marginTop: 4,
  },
  tagline: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 48,
    lineHeight: 20,
  },
  langList: {
    width: '100%',
    gap: 12,
  },
  langBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  langLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.3,
  },
  langLabelRTL: {
    writingDirection: 'rtl',
  },
  chevron: {
    fontSize: 20,
    color: colors.textMuted,
    fontWeight: '300',
  },
});
