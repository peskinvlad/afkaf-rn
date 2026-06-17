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
import { useApp } from '../hooks/useApp';
import { supabase } from '../lib/supabase';
import { colors, radii, shadows } from '../theme/tokens';

// Tells expo-web-browser to close itself when the auth session completes
WebBrowser.maybeCompleteAuthSession();

// The custom scheme registered in app.json + Supabase Redirect URLs
const REDIRECT_URI = 'afkaf://auth/callback';

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

  // ── Parse redirect URL → establish Supabase session ───────────────────────
  // supabase-js v2 defaults to PKCE flow in React Native:
  //   redirect = afkaf://auth/callback?code=XXXX          ← PKCE (default)
  // Implicit flow (if configured in Supabase dashboard):
  //   redirect = afkaf://auth/callback#access_token=...   ← Implicit
  // We handle both so the code works regardless of dashboard setting.
  async function handleRedirectUrl(url: string) {
    if (!url.startsWith('afkaf://auth/callback')) return;

    // ── PKCE: code in query string ──
    const query = url.includes('?') ? url.split('?')[1].split('#')[0] : '';
    const code  = new URLSearchParams(query).get('code');
    if (code) {
      console.log('[Auth] PKCE code received, exchanging…');
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        console.warn('[Auth] exchangeCodeForSession error:', error.message);
        setLoadingProvider(null);
      }
      // onAuthStateChange fires on success → navigation handled there
      return;
    }

    // ── Implicit: tokens in hash fragment ──
    const hash         = url.includes('#') ? url.split('#')[1] : '';
    const hashParams   = new URLSearchParams(hash);
    const accessToken  = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');
    if (accessToken && refreshToken) {
      console.log('[Auth] Implicit tokens received, setting session…');
      await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      return;
    }

    console.warn('[Auth] redirect URL contained neither code nor tokens:', url);
    setLoadingProvider(null);
  }

  // ── Linking fallback (Android / browser escaping the session) ─────────────
  useEffect(() => {
    const sub = Linking.addEventListener('url', ({ url }) => {
      console.log('[Auth] Linking.addEventListener fired:', url.slice(0, 200));
      handleRedirectUrl(url);
    });
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log('[Auth] getInitialURL:', url.slice(0, 200));
        handleRedirectUrl(url);
      }
    });
    return () => sub.remove();
  }, []);

  // ── OAuth helper ────────────────────────────────────────────────────────────
  async function signInWith(provider: 'google' | 'apple') {
    if (loadingProvider) return;
    setLoadingProvider(provider);
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
        setLoadingProvider(null);
        return;
      }

      console.log('[Auth] redirectTo:', REDIRECT_URI);
      console.log('[Auth] OAuth URL:', data.url.slice(0, 120), '…');

      // ASWebAuthenticationSession (iOS) / Chrome Custom Tabs (Android).
      // Closes automatically when it detects a redirect to REDIRECT_URI.
      const result = await WebBrowser.openAuthSessionAsync(data.url, REDIRECT_URI);

      console.log('[Auth] WebBrowser result type:', result.type);
      console.log('[Auth] WebBrowser result full:', JSON.stringify(result));
      if (result.type === 'success') {
        console.log('[Auth] redirect URL:', result.url.slice(0, 200));
        await handleRedirectUrl(result.url);
      } else {
        // type === 'cancel' or 'dismiss' — Linking listener may still fire if OS handled the deep link
        console.warn('[Auth] WebBrowser did not return success — waiting for Linking listener');
        setLoadingProvider(null);
      }
    } catch (e) {
      console.warn('[Auth] signInWith exception:', e);
      setLoadingProvider(null);
    }
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>

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
