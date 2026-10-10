import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '../hooks/useApp';
import { useTypography } from '../theme/fonts';
import { colors, radii, shadows } from '../theme/tokens';
import type { Visibility } from './SettingsScreen';

// Экран выбора видимости при первом входе (последний шаг онбординга, после
// слайдов). Выбор обязателен: кнопка «Продолжить» неактивна, пока вариант не
// выбран; «пропустить» нет. Пишет privacy_visibility в AsyncStorage (там же
// живёт настройка из Settings) и уходит на Main.
//
// Существующим пользователям ничего не меняется: если privacy_visibility уже
// задан (Settings или прошлый онбординг) — экран мгновенно заменяется на Main.
// А залогиненные в онбординг вообще не попадают (RootNavigator → Main по сессии).

interface Props {
  navigation: any;
}

const OPTIONS: { value: Visibility; emoji: string; recommended?: boolean }[] = [
  { value: 'everyone', emoji: '🌍', recommended: true },
  { value: 'friends', emoji: '🤝' },
  { value: 'nobody', emoji: '🔒' },
];

export function PrivacyChoiceScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { t, rtl } = useApp();
  const ty = useTypography();
  const styles = useMemo(() => makeStyles(ty), [ty]);
  const [choice, setChoice] = useState<Visibility | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem('privacy_visibility').then((v) => {
      if (cancelled) return;
      if (v) navigation.replace('Main'); // уже выбрано — экран не показываем
      else setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [navigation]);

  async function confirm() {
    if (!choice) return;
    await AsyncStorage.setItem('privacy_visibility', choice);
    navigation.replace('Main');
  }

  // Пока решаем, показывать ли экран — пустой фон (без мигания контентом).
  if (!ready) return <View style={styles.container} />;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24 }]}>
      <View style={styles.header}>
        <Text style={styles.emoji}>👁️</Text>
        <Text style={styles.title}>{t('onboarding.privacy.title')}</Text>
        <Text style={styles.subtitle}>{t('onboarding.privacy.subtitle')}</Text>
      </View>

      <View style={styles.cards}>
        {OPTIONS.map((o) => {
          const selected = choice === o.value;
          return (
            <TouchableOpacity
              key={o.value}
              activeOpacity={0.85}
              onPress={() => setChoice(o.value)}
              style={[
                styles.card,
                o.recommended && styles.cardRecommended,
                selected && styles.cardSelected,
              ]}
            >
              {o.recommended ? (
                <Text style={styles.recBadge}>{t('onboarding.privacy.recommended')}</Text>
              ) : null}
              <View style={styles.cardHead}>
                <View style={[styles.radio, selected && styles.radioOn]}>
                  {selected ? <View style={styles.radioDot} /> : null}
                </View>
                <Text style={[styles.cardTitle, rtl && styles.txtRight]} numberOfLines={1}>
                  {t(`onboarding.privacy.${o.value}`)}
                </Text>
                <Text style={styles.cardEmoji}>{o.emoji}</Text>
              </View>
              <Text style={[styles.cardDesc, rtl && styles.txtRight]}>
                {t(`onboarding.privacy.${o.value}_desc`)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 20 }]}>
        <TouchableOpacity
          style={[styles.cta, shadows.md, !choice && styles.ctaDisabled]}
          onPress={confirm}
          disabled={!choice}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaTxt}>{t('onboarding.privacy.cta')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const makeStyles = (ty: ReturnType<typeof useTypography>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.surface,
      paddingHorizontal: 24,
    },
    header: {
      alignItems: 'center',
      marginBottom: 28,
    },
    emoji: {
      fontSize: 56,
      marginBottom: 16,
    },
    title: {
      fontSize: 26,
      fontFamily: ty.font.display,
      color: colors.ink,
      textAlign: 'center',
      letterSpacing: -0.5,
      marginBottom: 8,
      lineHeight: 32,
    },
    subtitle: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      fontFamily: ty.font.body,
    },
    cards: {
      flex: 1,
      gap: 14,
      justifyContent: 'center',
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: radii.lg,
      borderWidth: 1.5,
      borderColor: colors.borderStrong,
      paddingVertical: 16,
      paddingHorizontal: 18,
      ...shadows.sm,
    },
    cardRecommended: {
      borderColor: colors.primaryMid,
      backgroundColor: colors.primaryTint,
    },
    cardSelected: {
      borderColor: colors.primary,
      borderWidth: 2,
    },
    recBadge: {
      position: 'absolute',
      top: -10,
      right: 16,
      backgroundColor: colors.primary,
      color: colors.white,
      fontSize: 11,
      fontFamily: ty.font.bodyBold,
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: radii.full,
      overflow: 'hidden',
    },
    cardHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 6,
    },
    radio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: colors.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioOn: {
      borderColor: colors.primary,
    },
    radioDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.primary,
    },
    cardTitle: {
      flex: 1,
      fontSize: 17,
      fontFamily: ty.font.heading,
      color: colors.ink,
      letterSpacing: -0.3,
    },
    cardEmoji: {
      fontSize: 20,
    },
    cardDesc: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.textSecondary,
      fontFamily: ty.font.body,
      marginLeft: 32,
    },
    txtRight: {
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    bottom: {
      paddingTop: 12,
    },
    cta: {
      backgroundColor: colors.primary,
      borderRadius: radii.lg,
      paddingVertical: 16,
      alignItems: 'center',
    },
    ctaDisabled: {
      opacity: 0.45,
    },
    ctaTxt: {
      fontSize: 17,
      fontFamily: ty.font.heading,
      color: colors.white,
      letterSpacing: -0.3,
    },
  });
