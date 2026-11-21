import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { initialWindowMetrics } from 'react-native-safe-area-context';
import { useApp } from '../hooks/useApp';
import { useTypography } from '../theme/fonts';
import { shadows } from '../theme/tokens';

// В приложении нет корневого SafeAreaProvider (инсеты даёт только
// NavigationContainer — внутри навигатора). ToastHost висит ВЫШЕ навигатора,
// поэтому useSafeAreaInsets() тут упал бы. initialWindowMetrics — статический
// снимок инсетов с нативного старта, доступен без провайдера; нижний инсет
// (home indicator) стабилен, снимка достаточно. Fallback 0 для старых Android.
const BOTTOM_INSET = initialWindowMetrics?.insets.bottom ?? 0;

// Лёгкий тост на чистом JS (Animated из ядра RN, без новых пакетов → уходит по OTA).
// Один инстанс на всё приложение: ToastProvider монтируется в RootNavigator ВЫШЕ
// NavigationContainer, поэтому плашка переживает navigation.reset() (смена экранов
// идёт внутри навигатора, а хост тоста — сосед навигатора и не размонтируется).
// Любой экран показывает тост через useToast().showToast('…').

const HOLD_MS = 2500;   // сколько плашка висит до авто-ухода
const IN_MS = 220;
const OUT_MS = 200;

const ToastContext = createContext<{ showToast: (message: string) => void }>({
  showToast: () => {},
});

export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  // id растёт на каждый вызов — хост так отличает новый показ (даже с тем же
  // текстом) и перезапускает анимацию.
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const idRef = useRef(0);

  const showToast = useCallback((message: string) => {
    if (!message) return;
    idRef.current += 1;
    setToast({ id: idRef.current, message });
  }, []);

  // Стабильная ссылка: без неё animateOut и эффект в ToastHost пересоздавались
  // бы на каждый ре-рендер провайдера и продлевали таймер авто-ухода.
  const handleDone = useCallback(() => setToast(null), []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastHost toast={toast} onDone={handleDone} />
    </ToastContext.Provider>
  );
}

function ToastHost({
  toast,
  onDone,
}: {
  toast: { id: number; message: string } | null;
  onDone: () => void;
}) {
  const { rtl } = useApp();
  const ty = useTypography();
  const styles = useMemo(() => makeStyles(ty), [ty]);

  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const animateOut = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: OUT_MS, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 12, duration: OUT_MS, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) onDone();
    });
  }, [opacity, translateY, onDone]);

  useEffect(() => {
    if (!toast) return;
    // Озвучка для скринридера: iOS — явный announce (на нём liveRegion не
    // срабатывает), Android — через accessibilityLiveRegion на самой плашке.
    if (Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibility(toast.message);
    }
    opacity.setValue(0);
    translateY.setValue(12);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: IN_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: IN_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();

    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(animateOut, HOLD_MS);

    return () => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }
    };
  }, [toast?.id, animateOut]);

  if (!toast) return null;

  return (
    <View
      style={[styles.wrap, { bottom: BOTTOM_INSET + 16 }]}
      pointerEvents="box-none"
    >
      <Animated.View style={{ opacity, transform: [{ translateY }] }}>
        <Pressable
          onPress={animateOut}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={styles.pill}
        >
          <Text
            style={[styles.text, { writingDirection: rtl ? 'rtl' : 'ltr' }]}
            numberOfLines={2}
          >
            {toast.message}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const makeStyles = (ty: ReturnType<typeof useTypography>) => StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 50,
  },
  pill: {
    maxWidth: '90%',
    backgroundColor: 'rgba(20, 20, 20, 0.92)',
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 12,
    ...shadows.md,
  },
  text: {
    ...ty.variants.sm,
    fontFamily: ty.font.bodyBold,
    color: '#fff',
    textAlign: 'center',
  },
});
