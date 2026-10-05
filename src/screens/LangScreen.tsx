import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../hooks/useApp';
import { LANGS, Lang } from '../i18n';
import { useTypography } from '../theme/fonts';
import { colors, radii, shadows, spacing } from '../theme/tokens';

interface Props {
  navigation: any;
}

export function LangScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { setLang, t } = useApp();
  const ty = useTypography();
  const styles = useMemo(() => makeStyles(ty), [ty]);

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

const makeStyles = (ty: ReturnType<typeof useTypography>) => StyleSheet.create({
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
    fontFamily: ty.font.display,
    color: colors.primary,
    letterSpacing: -0.8,
    marginTop: 4,
  },
  tagline: {
    fontSize: 13,
    fontFamily: ty.font.body,
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
    fontFamily: ty.font.heading,
    color: colors.ink,
    letterSpacing: -0.3,
  },
  langLabelRTL: {
    writingDirection: 'rtl',
  },
  chevron: {
    fontSize: 20,
    color: colors.textMuted,
    fontFamily: ty.font.body,
  },
});
