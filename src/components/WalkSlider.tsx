import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useApp } from '../hooks/useApp';
import { radii, shadows } from '../theme/tokens';
import { statusFor } from '../lib/heat';

const SCREEN_W = Dimensions.get('window').width;
const H_PADDING = 16;
const PILL_W = SCREEN_W - H_PADDING * 2;
const HANDLE_SIZE = 56;
const TRACK_W = PILL_W - HANDLE_SIZE - 8; // usable drag range (8 = inner padding)
const TRIGGER_RATIO = 0.85;

const PAW_SIZE = 20;
const PAW_SPACING = 36;
// Enough paws to fill the full pill width
const PAW_COUNT = Math.ceil(PILL_W / PAW_SPACING) + 1;

// Палитра пилюли по статусу. Раньше здесь были свои `> 45` / `>= 35` — вторая
// копия порогов, которая молча разъезжалась бы с lib/heat.ts. Цвета прежние,
// границы те же, источник статуса теперь один.
// bg — пастельный фон, fill — насыщенная заливка (прогресс + ручка),
// txt — тёмный текст, читаемый на пастели.
const PILL_COLORS = {
  ok:      { bg: '#e8f0e6', fill: '#2c5f25', txt: '#2c5f25' },
  caution: { bg: '#f5eddb', fill: '#d97706', txt: '#92580a' },
  danger:  { bg: '#f5e0e0', fill: '#dc2626', txt: '#9b1c1c' },
} as const;

interface Props {
  asphaltTemp: number;
  onWalkStart: () => void;
}

export function WalkSlider({ asphaltTemp, onWalkStart }: Props) {
  const { t } = useApp();
  const dragX = useRef(new Animated.Value(0)).current;

  const { bg, fill, txt } = PILL_COLORS[statusFor(asphaltTemp)];

  // The PanResponder below is created once, so a drag is never torn down
  // mid-gesture — which also means its handlers close over the FIRST render's
  // props and state, forever. MapScreen re-creates onWalkStart every render,
  // closing over that render's heatData, so the frozen copy was the one from
  // before the weather had loaded: it always saw status 'ok' and the >45°C
  // HeatWarning intercept could never fire, override or not. Both values the
  // handler needs are read through refs that stay current instead.
  const onWalkStartRef = useRef(onWalkStart);
  useEffect(() => {
    onWalkStartRef.current = onWalkStart;
  }, [onWalkStart]);

  // Same trap: `triggered` used to be state read from that frozen closure, so
  // it was permanently false and the re-entrancy guard did nothing. It never
  // took part in rendering, so a ref is both correct and one render cheaper.
  const triggeredRef = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderMove: (_, { dx }) => {
        const clamped = Math.max(0, Math.min(dx, TRACK_W));
        dragX.setValue(clamped);
      },

      onPanResponderRelease: (_, { dx }) => {
        const ratio = dx / TRACK_W;
        if (ratio >= TRIGGER_RATIO && !triggeredRef.current) {
          triggeredRef.current = true;
          Animated.spring(dragX, {
            toValue: TRACK_W,
            useNativeDriver: false,
            bounciness: 0,
          }).start(() => {
            onWalkStartRef.current();
            setTimeout(() => {
              dragX.setValue(0);
              triggeredRef.current = false;
            }, 400);
          });
        } else {
          Animated.spring(dragX, {
            toValue: 0,
            useNativeDriver: false,
            bounciness: 8,
            speed: 14,
          }).start();
        }
      },
    })
  ).current;

  // Progress width = center of handle + half handle + X_OFFSET
  // X_OFFSET = (PILL_H - HANDLE_SIZE) / 2 = 4
  // At dx=0: (4 + 0 + 25) + 25 + 4 = HANDLE_SIZE + 8 = PILL_H
  // At dx=TRACK_W: PILL_H + TRACK_W = PILL_W
  const PILL_H = HANDLE_SIZE + 8;
  const progressW = dragX.interpolate({
    inputRange: [0, TRACK_W],
    outputRange: [PILL_H, PILL_H + TRACK_W],
    extrapolate: 'clamp',
  });

  // Fade label out as handle moves
  const labelOpacity = dragX.interpolate({
    inputRange: [0, TRACK_W * 0.45],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <View
      style={[styles.pill, { backgroundColor: bg }, shadows.md]}
      {...panResponder.panHandlers}
    >

      {/* ── Progress fill — own overflow:hidden to clip paws ── */}
      <Animated.View
        style={[styles.progressFill, { width: progressW, backgroundColor: fill }]}
        pointerEvents="none"
      >
        {Array.from({ length: PAW_COUNT }).map((_, i) => {
          const isOdd = i % 2 === 1;
          const centerY = (HANDLE_SIZE + 8) / 2 - PAW_SIZE / 2;
          return (
            <Image
              key={i}
              source={require('../../assets/images/paw.png')}
              style={[
                styles.paw,
                {
                  left: PILL_H + i * PAW_SPACING,
                  top: isOdd ? centerY - 8 : centerY + 8,
                  transform: isOdd
                    ? [{ rotate: '90deg' }, { scaleX: -1 }]
                    : [{ rotate: '90deg' }],
                },
              ]}
            />
          );
        })}
      </Animated.View>

      {/* ── Label — color by temp ── */}
      <Animated.Text style={[styles.label, { opacity: labelOpacity, color: txt }]}>
        {t('map.swipeToStart')}
      </Animated.Text>

      {/* ── Drag handle — visual only now; the whole pill (above) owns the
          gesture, so touching anywhere along the track drags it. dragX is
          gesture.dx (delta from touch-down), so the handle always starts
          moving from its current position (0) rather than jumping to the
          finger. ── */}
      <Animated.View
        style={[styles.handle, { backgroundColor: '#ffffff', transform: [{ translateX: dragX }] }]}
      >
        <Text style={styles.handleEmoji}>🐶</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    width: PILL_W,
    height: HANDLE_SIZE + 8,
    borderRadius: radii.full,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: radii.full,
    overflow: 'hidden',
  },
  paw: {
    position: 'absolute',
    width: PAW_SIZE,
    height: PAW_SIZE,
    resizeMode: 'contain',
    opacity: 0.55,
  },
  label: {
    position: 'absolute',
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  handle: {
    position: 'absolute',
    left: 4,
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleEmoji: {
    fontSize: 24,
  },
});
