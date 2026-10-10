import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../hooks/useApp';
import { useTypography } from '../theme/fonts';
import { colors, radii, shadows, spacing } from '../theme/tokens';
import type { Visibility } from '../screens/SettingsScreen';

// Шторка выбора видимости при старте прогулки. Показывается MapScreen только
// залогиненному и только пока в AsyncStorage нет privacy_visibility (гостям —
// никогда, существующим — один раз). ПЕРЕД системным запросом геолокации.
//
// Предвыбор — 'friends' (фактический текущий дефолт всех, кто не выбирал), чтобы
// существующим ничего не менялось. 'everyone' визуально помечен «рекомендуем».
// Выбор обязателен: закрытие по фону = onClose (прогулка не стартует); тап
// «Продолжить» = onChoose(выбор) → сохранение и продолжение старта без лишних
// нажатий (логика в MapScreen).

interface Props {
  visible: boolean;
  onChoose: (v: Visibility) => void;
  onClose: () => void;
}

const OPTIONS: { value: Visibility; emoji: string; recommended?: boolean }[] = [
  { value: 'everyone', emoji: '🌍', recommended: true },
  { value: 'friends', emoji: '🤝' },
  { value: 'nobody', emoji: '🔒' },
];

export function PrivacyChoiceSheet({ visible, onChoose, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { t, rtl } = useApp();
  const ty = useTypography();
  const styles = useMemo(() => makeStyles(ty), [ty]);
  const translateY = useRef(new Animated.Value(400)).current;
  // Предвыбор «только друзья» — текущее фактическое значение (см. шапку).
  const [choice, setChoice] = useState<Visibility>('friends');

  useEffect(() => {
    if (visible) setChoice('friends'); // сбрасываем на дефолт при каждом открытии
    Animated.spring(translateY, {
      toValue: visible ? 0 : 400,
      useNativeDriver: true,
      bounciness: 0,
      speed: 16,
    }).start();
  }, [visible, translateY]);

  if (!visible) return null;

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg, transform: [{ translateY }] }]}
      >
        <View style={styles.grabber} />
        <Text style={styles.title}>{t('walk.privacy.sheetTitle')}</Text>
        <Text style={styles.subtitle}>{t('onboarding.privacy.subtitle')}</Text>

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

        <TouchableOpacity
          style={[styles.cta, shadows.md]}
          onPress={() => onChoose(choice)}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaTxt}>{t('onboarding.privacy.cta')}</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const makeStyles = (ty: ReturnType<typeof useTypography>) =>
  StyleSheet.create({
    overlay: { ...StyleSheet.absoluteFillObject, zIndex: 30, justifyContent: 'flex-end' },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
    sheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: radii.xl,
      borderTopRightRadius: radii.xl,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
      gap: 12,
      ...shadows.lg,
    },
    grabber: {
      alignSelf: 'center',
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.borderStrong,
      marginBottom: 6,
    },
    title: {
      fontSize: 22,
      fontFamily: ty.font.display,
      color: colors.ink,
      textAlign: 'center',
      letterSpacing: -0.4,
      lineHeight: 28,
    },
    subtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      fontFamily: ty.font.body,
      marginBottom: 2,
    },
    cards: { gap: 12 },
    card: {
      backgroundColor: colors.card,
      borderRadius: radii.lg,
      borderWidth: 1.5,
      borderColor: colors.borderStrong,
      paddingVertical: 14,
      paddingHorizontal: 16,
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
      right: 14,
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
      marginBottom: 4,
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
    radioOn: { borderColor: colors.primary },
    radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
    cardTitle: {
      flex: 1,
      fontSize: 17,
      fontFamily: ty.font.heading,
      color: colors.ink,
      letterSpacing: -0.3,
    },
    cardEmoji: { fontSize: 20 },
    cardDesc: {
      fontSize: 13.5,
      lineHeight: 19,
      color: colors.textSecondary,
      fontFamily: ty.font.body,
      marginLeft: 32,
    },
    txtRight: { textAlign: 'right', writingDirection: 'rtl' },
    cta: {
      backgroundColor: colors.primary,
      borderRadius: radii.lg,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 2,
    },
    ctaTxt: {
      fontSize: 17,
      fontFamily: ty.font.heading,
      color: colors.white,
      letterSpacing: -0.3,
    },
  });
