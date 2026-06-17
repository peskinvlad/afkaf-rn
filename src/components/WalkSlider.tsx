import React, { useRef, useState } from 'react';
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

const SCREEN_W = Dimensions.get('window').width;
const H_PADDING = 16;
const PILL_W = SCREEN_W - H_PADDING * 2;
const HANDLE_SIZE = 50;
const TRACK_W = PILL_W - HANDLE_SIZE - 8; // usable drag range (8 = inner padding)
const TRIGGER_RATIO = 0.85;

const PAW_SIZE = 20;
const PAW_SPACING = 36;
// Enough paws to fill the full pill width
const PAW_COUNT = Math.ceil(PILL_W / PAW_SPACING) + 1;

// Pastel pill bg
function bgColor(temp: number): string {
  if (temp > 45) return '#f5e0e0';
  if (temp >= 35) return '#f5eddb';
  return '#e8f0e6';
}

// Saturated fill color (progress bar + handle)
function fillColor(temp: number): string {
  if (temp > 45) return '#dc2626';
  if (temp >= 35) return '#d97706';
  return '#2c5f25';
}

// Text color (darker, readable on pastel bg)
function textColor(temp: number): string {
  if (temp > 45) return '#9b1c1c';
  if (temp >= 35) return '#92580a';
  return '#2c5f25';
}

interface Props {
  asphaltTemp: number;
  onWalkStart: () => void;
}

export function WalkSlider({ asphaltTemp, onWalkStart }: Props) {
  const { t } = useApp();
  const dragX = useRef(new Animated.Value(0)).current;
  const [triggered, setTriggered] = useState(false);

  const bg = bgColor(asphaltTemp);
  const fill = fillColor(asphaltTemp);
  const txt = textColor(asphaltTemp);

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
        if (ratio >= TRIGGER_RATIO && !triggered) {
          setTriggered(true);
          Animated.spring(dragX, {
            toValue: TRACK_W,
            useNativeDriver: false,
            bounciness: 0,
          }).start(() => {
            onWalkStart();
            setTimeout(() => {
              dragX.setValue(0);
              setTriggered(false);
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
    <View style={[styles.pill, { backgroundColor: bg }, shadows.md]}>

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
              source={require('../../assets/Images/Paw PNG.png')}
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

      {/* ── Drag handle ── */}
      <Animated.View
        style={[styles.handle, { backgroundColor: '#ffffff', transform: [{ translateX: dragX }] }]}
        {...panResponder.panHandlers}
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
