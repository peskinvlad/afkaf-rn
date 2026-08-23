import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { useApp } from '../hooks/useApp';
import { supabase } from '../lib/supabase';
import { colors, radii, shadows } from '../theme/tokens';

// Tells expo-web-browser to close itself when the auth session completes
WebBrowser.maybeCompleteAuthSession();

// The custom scheme registered in app.json + Supabase Redirect URLs
const REDIRECT_URI = 'afkaf://auth/callback';

// Как долго после нажатия «войти» мы вообще готовы рассматривать входящий
// auth-редирект. Окно нужно для Android-случая, когда Custom Tab закрылась,
// а ссылку доставила ОС мимо промиса openAuthSessionAsync. Двух минут хватает
// на ввод пароля и 2FA; вне окна любой afkaf://auth/callback игнорируется.
const OAUTH_ACCEPT_MS = 120_000;

// Detect "new user" — created within last 60 seconds
function isNewUser(createdAt: string | undefined): boolean {
  if (!createdAt) return true;
  return Date.now() - new Date(createdAt).getTime() < 60_000;
}

interface Props {
  navigation: any;
}

export function AuthScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { t, setIsGuest } = useApp();

  const [loadingProvider, setLoadingProvider] = useState<'google' | 'apple' | null>(null);

  // ── Session established → navigate ────────────────────────────────────────
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setIsGuest(false);
        setLoadingProvider(null);
        if (isNewUser(session.user.created_at)) {
          navigation.replace('DogProfile');
        } else {
          navigation.goBack();
        }
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // Момент, до которого принимается auth-редирект. Ноль = флоу не запускался
  // или уже завершён, и тогда любой входящий afkaf://auth/callback — чужой.
  const oauthDeadlineRef = useRef(0);

  // ── Redirect → сессия ─────────────────────────────────────────────────────
  // Принимается РОВНО ОДНА вещь: одноразовый PKCE-code из query. Он бесполезен
  // без code_verifier, который supabase-js сгенерировал при signInWithOAuth и
  // держит в локальном storage, — подсунутый снаружи code не обменяется.
  //
  // Ветка implicit-флоу (токены во фрагменте → setSession) удалена намеренно и
  // не должна возвращаться: она принимала готовую пару токенов из любой
  // ссылки, то есть логинила пользователя в аккаунт того, кто эту ссылку
  // прислал. Клиент прибит к flowType:'pkce' (lib/supabase.ts), так что
  // фрагмент с токенами в легитимном флоу не появляется в принципе.
  async function completeOAuthRedirect(url: string) {
    if (!url.startsWith(REDIRECT_URI)) return;

    const query = url.includes('?') ? url.split('?')[1].split('#')[0] : '';
    const code = new URLSearchParams(query).get('code');
    if (!code) {
      console.warn('[Auth] redirect URL carried no authorization code');
      setLoadingProvider(null);
      return;
    }

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.warn('[Auth] exchangeCodeForSession error:', error.message);
      setLoadingProvider(null);
      return;
    }
    // Успех: onAuthStateChange навигирует. Окно закрываем сразу — второй
    // редирект по этому же флоу нам уже не нужен.
    oauthDeadlineRef.current = 0;
  }

  // ── Linking-фолбэк, только внутри своего флоу ─────────────────────────────
  // Нужен для Android: Custom Tab иногда закрывается, а ссылку доставляет ОС
  // мимо промиса openAuthSessionAsync. Слушатель ЖИВ только пока идёт флоу,
  // начатый в этом приложении, и умеет лишь обменять code — setSession отсюда
  // недостижим. getInitialURL сознательно не используется: холодный старт по
  // ссылке никогда не бывает продолжением нашего флоу.
  useEffect(() => {
    const sub = Linking.addEventListener('url', ({ url }) => {
      if (Date.now() > oauthDeadlineRef.current) return; // чужой вызов схемы
      completeOAuthRedirect(url);
    });
    return () => sub.remove();
  }, []);

  // ── OAuth helper ────────────────────────────────────────────────────────────
  async function signInWith(provider: 'google' | 'apple') {
    if (loadingProvider) return;
    setLoadingProvider(provider);
    // Окно открывается только здесь — из обработчика нажатия.
    oauthDeadlineRef.current = Date.now() + OAUTH_ACCEPT_MS;
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: REDIRECT_URI,
          skipBrowserRedirect: true,
        },
      });
      if (error || !data.url) {
        console.warn('[Auth] signInWithOAuth error:', error?.message);
        oauthDeadlineRef.current = 0;
        setLoadingProvider(null);
        return;
      }

      // ASWebAuthenticationSession (iOS) / Chrome Custom Tabs (Android).
      // Closes automatically when it detects a redirect to REDIRECT_URI.
      const result = await WebBrowser.openAuthSessionAsync(data.url, REDIRECT_URI);

      if (result.type === 'success') {
        await completeOAuthRedirect(result.url);
      } else {
        // type === 'cancel' or 'dismiss' — Linking listener may still fire if OS handled the deep link
        console.warn('[Auth] WebBrowser did not return success — waiting for Linking listener');
        setLoadingProvider(null);
      }
    } catch (e) {
      console.warn('[Auth] signInWith exception:', e);
      oauthDeadlineRef.current = 0;
      setLoadingProvider(null);
    }
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* ── Close — a guest should always have a way out ── */}
      <TouchableOpacity
        style={[styles.closeBtn, { top: insets.top + 8 }]}
        onPress={() => navigation.goBack()}
        hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
      >
        <X size={22} color={colors.textMuted} />
      </TouchableOpacity>

      {/* ── Logo + branding ── */}
      <View style={styles.hero}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoEmoji}>🐾</Text>
        </View>
        <Text style={styles.appName}>afkaf</Text>
        <Text style={styles.subtitle}>{t('auth.subtitle')}</Text>
      </View>

      {/* ── Buttons ── */}
      <View style={styles.buttons}>

        {/* Google */}
        <TouchableOpacity
          style={[styles.btnGoogle, shadows.sm]}
          onPress={() => signInWith('google')}
          activeOpacity={0.85}
          disabled={!!loadingProvider}
        >
          {loadingProvider === 'google' ? (
            <ActivityIndicator color={colors.ink} />
          ) : (
            <>
              <Text style={styles.googleIcon}>G</Text>
              <Text style={styles.btnGoogleTxt}>{t('auth.continueGoogle')}</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Apple */}
        <TouchableOpacity
          style={[styles.btnApple, shadows.sm]}
          onPress={() => signInWith('apple')}
          activeOpacity={0.85}
          disabled={!!loadingProvider}
        >
          {loadingProvider === 'apple' ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <Text style={styles.appleIcon}></Text>
              <Text style={styles.btnAppleTxt}>{t('auth.continueApple')}</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Legal */}
        <Text style={styles.legal}>
          {t('auth.legalPrefix')}{' '}
          <Text style={styles.legalLink} onPress={() => Linking.openURL('https://afkaf.app/terms')}>
            {t('auth.terms')}
          </Text>
          {' '}{t('auth.legalAnd')}{' '}
          <Text style={styles.legalLink} onPress={() => Linking.openURL('https://afkaf.app/privacy')}>
            {t('auth.privacy')}
          </Text>
        </Text>
      </View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.white,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },

  closeBtn: {
    position: 'absolute',
    right: 20,
    zIndex: 10,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Hero
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  logoCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#e8f0e6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  logoEmoji: { fontSize: 40 },
  appName: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.8,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Buttons
  buttons: {
    gap: 12,
    paddingBottom: 8,
  },

  // Google button
  btnGoogle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 54,
    borderRadius: radii.lg,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
  },
  googleIcon: {
    fontSize: 17,
    fontWeight: '700',
    color: '#4285F4',
    fontFamily: 'Nunito_700Bold',
  },
  btnGoogleTxt: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.ink,
  },

  // Apple button
  btnApple: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 54,
    borderRadius: radii.lg,
    backgroundColor: '#000000',
  },
  appleIcon: {
    fontSize: 20,
    color: colors.white,
    lineHeight: 24,
    marginTop: -2,
  },
  btnAppleTxt: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },

  // Legal
  legal: {
    fontSize: 12,
    color: colors.textSoft,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 4,
  },
  legalLink: {
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
});
