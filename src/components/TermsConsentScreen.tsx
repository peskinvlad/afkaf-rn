import React, { useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { initialWindowMetrics } from 'react-native-safe-area-context';
import { useApp } from '../hooks/useApp';
import { useTypography } from '../theme/fonts';
import { LINKS } from '../constants/links';
import { colors, radii, shadows } from '../theme/tokens';

// Полноэкранный экран согласия с условиями (Apple Guideline 1.2). Только UI:
// показывает и логику держит TermsConsentProvider (hooks/useTermsConsent).
// Рисуется абсолютным слоем поверх навигатора, а не RN <Modal> — чтобы не
// конфликтовать на iOS с другими модалками (WalkRecoveryModal и т.п.).
// Пропуска нет: только «Принимаю» или «Выйти».

interface Props {
  busy: boolean;
  onAccept: () => void;
  onSignOut: () => void;
}

export function TermsConsentScreen({ busy, onAccept, onSignOut }: Props) {
  // Экран рисуется вне NavigationContainer, корневого SafeAreaProvider нет —
  // useSafeAreaInsets() бросил бы «No safe area value available» (краш на старте).
  // Как в Toast: статический снимок отступов с запуска (ориентация только портрет).
  const insets = initialWindowMetrics?.insets ?? { top: 0, bottom: 0, left: 0, right: 0 };
  const { t, rtl } = useApp();
  const ty = useTypography();
  const styles = useMemo(() => makeStyles(ty), [ty]);

  // Android: аппаратный «назад» не должен уводить навигацию под экраном.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  const textDir = rtl ? styles.rtlText : null;

  return (
    <View
      style={[styles.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 16 }]}
      accessibilityViewIsModal
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Декоративный: заголовок рядом. Явные width+height (490×549 → 64×72). */}
        <Image
          source={require('../../assets/images/logo.png')}
          style={styles.logo}
          resizeMode="contain"
          accessible={false}
        />
        <Text style={styles.title} accessibilityRole="header">
          {t('terms.title')}
        </Text>
        <Text style={[styles.body, textDir]}>{t('terms.body1')}</Text>
        <Text style={[styles.body, textDir]}>{t('terms.body2')}</Text>
        <Text style={[styles.body, textDir]}>{t('terms.body3')}</Text>

        <Text style={[styles.agree, textDir]}>
          {t('terms.agreePrefix')}
          <Text
            style={styles.link}
            accessibilityRole="link"
            onPress={() => Linking.openURL(LINKS.terms)}
          >
            {t('terms.termsLink')}
          </Text>
          {t('terms.and')}
          <Text
            style={styles.link}
            accessibilityRole="link"
            onPress={() => Linking.openURL(LINKS.privacy)}
          >
            {t('terms.privacyLink')}
          </Text>
          {t('terms.agreeSuffix')}
        </Text>
      </ScrollView>

      <View style={styles.buttons}>
        <TouchableOpacity
          style={[styles.acceptBtn, shadows.md, busy && styles.btnDisabled]}
          onPress={onAccept}
          disabled={busy}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          {busy ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.acceptTxt}>{t('terms.accept')}</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.signOutBtn}
          onPress={onSignOut}
          disabled={busy}
          activeOpacity={0.7}
          accessibilityRole="button"
        >
          <Text style={styles.signOutTxt}>{t('terms.signOut')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const makeStyles = ({ font, variants }: ReturnType<typeof useTypography>) =>
  StyleSheet.create({
    root: {
      ...StyleSheet.absoluteFill,
      zIndex: 1000,
      elevation: 1000,
      backgroundColor: colors.surface,
      paddingHorizontal: 24,
    },
    content: {
      flexGrow: 1,
      justifyContent: 'center',
      gap: 14,
      paddingBottom: 16,
    },
    logo: {
      width: 64,
      height: 72,
      alignSelf: 'center',
      marginBottom: 4,
    },
    title: {
      ...variants.h1,
      color: colors.ink,
      textAlign: 'center',
      marginBottom: 4,
    },
    body: {
      ...variants.body,
      color: colors.textSecondary,
      lineHeight: 22,
    },
    agree: {
      ...variants.sm,
      color: colors.textMuted,
      lineHeight: 19,
      marginTop: 6,
    },
    link: {
      fontFamily: font.bodyBold,
      color: colors.primary,
      textDecorationLine: 'underline',
    },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
    buttons: {
      gap: 8,
      paddingTop: 8,
    },
    acceptBtn: {
      height: 54,
      borderRadius: radii.lg,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnDisabled: { opacity: 0.7 },
    acceptTxt: {
      fontSize: 16,
      fontFamily: font.bodyBold,
      color: colors.white,
    },
    signOutBtn: {
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    signOutTxt: {
      fontSize: 15,
      fontFamily: font.bodyBold,
      color: colors.textMuted,
    },
  });
