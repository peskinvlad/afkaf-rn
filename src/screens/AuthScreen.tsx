import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
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

// TEMP (бета): любую заминку OAuth-входа показываем Alert'ом с текстом. Иначе
// флоу гасит ошибку в console.warn и на устройстве видно лишь «мигание» экрана
// без причины. Убрать, как только причина Google-входа подтвердится на билде.
function authAlert(stage: string, detail?: string): void {
  Alert.alert('Google sign-in failed', detail ? `${stage}\n\n${detail}` : stage);
}

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
      authAlert('Redirect без кода авторизации', url);
      setLoadingProvider(null);
      return;
    }

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.warn('[Auth] exchangeCodeForSession error:', error.message);
      authAlert('exchangeCodeForSession', error.message);
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
        authAlert('signInWithOAuth', error?.message ?? 'провайдер не вернул URL (data.url пуст)');
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
        // На iOS (бета-таргет) успешный редирект всегда приходит как 'success';
        // 'cancel'/'dismiss' здесь = браузер закрылся без редиректа. Показываем,
        // чтобы отличить это от «URL не вернулся». (Android-фолбэк через Linking
        // может позже сам довести флоу — тогда onAuthStateChange навигирует.)
        authAlert('WebBrowser', `браузер закрылся без редиректа (type: ${result.type})`);
        setLoadingProvider(null);
      }
    } catch (e: any) {
      console.warn('[Auth] signInWith exception:', e);
      authAlert('Исключение при входе', String(e?.message ?? e));
      oauthDeadlineRef.current = 0;
      setLoadingProvider(null);
    }
  }

  // ── Apple: нативный вход ──────────────────────────────────────────────────
  // Системный шит Sign in with Apple → identityToken → signInWithIdToken.
  // Никакого веб-редиректа и PKCE-обмена: провайдер валидирует токен напрямую.
  // Nonce не передаём осознанно — гайд Supabase для нативного Expo-потока его
  // не использует; expo-apple-authentication управляет nonce сам, а ручной
  // привёл бы к рассинхрону при верификации токена. onAuthStateChange навигирует
  // и сбросит loadingProvider на успехе (как и для веб-флоу).
  async function signInWithApple() {
    if (loadingProvider) return;
    setLoadingProvider('apple');
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) {
        console.warn('[Auth] Apple credential carried no identityToken');
        setLoadingProvider(null);
        return;
      }
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });
      if (error) {
        console.warn('[Auth] signInWithIdToken error:', error.message);
        setLoadingProvider(null);
        return;
      }

      // Имя. Apple кладёт его НЕ в identityToken, а в credential.fullName и
      // отдаёт ТОЛЬКО при первом входе (дальше — null). У Google имя приходит
      // в user_metadata и попадает в profiles.display_name через триггер
      // handle_new_user; для Apple метаданных с именем нет, поэтому триггер
      // пишет плейсхолдер 'User'. Здесь перекрываем его реальным именем —
      // ровно один раз. При повторном входе fullName == null → не трогаем
      // существующее имя. Кап 50 симв. повторяет left(...,50) в триггере.
      const fn = credential.fullName;
      const name = [fn?.givenName, fn?.familyName].filter(Boolean).join(' ').trim();
      const uid = data.user?.id;
      if (name && uid) {
        const { error: pErr } = await supabase
          .from('profiles')
          .update({ display_name: name.slice(0, 50) })
          .eq('id', uid);
        if (pErr) console.warn('[Auth] Apple name → profile update failed:', pErr.message);
      }
    } catch (e: any) {
      // Пользователь закрыл системный шит — это не ошибка, молча выходим.
      if (e?.code !== 'ERR_REQUEST_CANCELED') {
        console.warn('[Auth] Apple signIn exception:', e);
      }
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

        {/* Apple — нативная системная кнопка (требование App Review) */}
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={radii.lg}
          style={styles.btnApple}
          onPress={signInWithApple}
        />

        {/* Legal */}
        <Text style={styles.legal}>
          {t('auth.legalPrefix')}{' '}
          <Text style={styles.legalLink} onPress={() => Linking.openURL('https://afkaf.netlify.app/terms')}>
            {t('auth.terms')}
          </Text>
          {' '}{t('auth.legalAnd')}{' '}
          <Text style={styles.legalLink} onPress={() => Linking.openURL('https://afkaf.netlify.app/privacy')}>
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

  // Apple button (нативная AppleAuthenticationButton — только размер)
  btnApple: {
    height: 54,
    alignSelf: 'stretch',
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
