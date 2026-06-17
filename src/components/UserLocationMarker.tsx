import React, { useEffect, useRef } from 'react';
import { Animated, View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';

interface Props {
  heading: number;   // degrees clockwise from north (0-360)
  accuracy?: number; // metres — shown as ring when < 120
}

const SIZE = 48;
const CX = SIZE / 2;   // 24 — circle center X
const CY = SIZE / 2;   // 24 — circle center Y  (= GPS anchor point when anchor={0.5,0.5})
const R = 17;          // outer circle radius

// Combined shape: circle body + small triangular tip at top (12 o'clock = heading 0 = North)
// Base of triangle is on the circle edge at ≈±20° from top:
//   left  (18, 8): distance to (24,24) ≈ 17.09 ✓
//   right (30, 8): same by symmetry ✓
// Tip at (24, 2) — 6px above the circle edge.
// Arc goes clockwise from left-base to right-base covering the bottom 320° of the circle.
const SHELL_PATH = `M ${CX} 2 L 18 8 A ${R} ${R} 0 1 1 30 8 Z`;

export function UserLocationMarker({ heading, accuracy }: Props) {
  const rotateAnim = useRef(new Animated.Value(heading)).current;
  const prevHeading = useRef(heading);

  useEffect(() => {
    // Shortest-arc rotation — avoids spinning the long way round 359° → 0°
    let delta = heading - (prevHeading.current % 360);
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    const target = prevHeading.current + delta;
    prevHeading.current = target;

    Animated.timing(rotateAnim, {
      toValue: target,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [heading]);

  const rotate = rotateAnim.interpolate({
    inputRange: [-720, 720],
    outputRange: ['-720deg', '720deg'],
  });

  // Ring diameter: clamped between marker size and 120px
  const ringSize = accuracy != null && accuracy < 120
    ? Math.max(SIZE, Math.min(accuracy, 120))
    : 0;

  return (
    <View style={styles.container}>
      {/* GPS accuracy ring — centred on the GPS anchor (container centre) */}
      {ringSize > 0 && (
        <View style={[
          styles.accuracyRing,
          {
            width: ringSize,
            height: ringSize,
            borderRadius: ringSize / 2,
            left: (SIZE - ringSize) / 2,
            top: (SIZE - ringSize) / 2,
          },
        ]} />
      )}

      {/* Rotating outer shell: green (circle + tip) + white inner disc */}
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate }] }]}>
        <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          {/* Green shell */}
          <Path
            d={SHELL_PATH}
            fill="#2c5f25"
            stroke="white"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          {/* White inner disc — rotation invisible on a circle */}
          <Circle cx={CX} cy={CY} r={13} fill="white" />
        </Svg>
      </Animated.View>

      {/* Static paw — always upright, centred on GPS anchor */}
      <Text style={styles.paw}>🐾</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accuracyRing: {
    position: 'absolute',
    backgroundColor: 'rgba(44, 95, 37, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(44, 95, 37, 0.22)',
  },
  paw: {
    fontSize: 14,
    lineHeight: 16,
    textAlign: 'center',
  },
});
