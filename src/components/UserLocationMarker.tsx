import React, { useEffect, useRef } from 'react';
import { Animated, Platform, View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { MarkerAnimated, Circle as MapCircle, AnimatedRegion } from 'react-native-maps';
import { LatLng } from '../lib/geo';

interface Props {
  // Continuous heading in degrees from useHeading — drives the rotation on
  // the native thread; a compass tick never re-renders this component.
  headingAnim: Animated.Value;
  accuracy?: number; // metres — shown as ring when < 120
}

// Android: свой маркер отдельными PNG вместо SVG-детей (Fabric режет children
// bitmap — см. MapMarkerIcon). Стрелка-капля крутится нативно, лапа статична
// поверх, круг точности — через <Circle>. Смотрит строго вверх при rotation 0.
const ARROW_IMG = require('../../assets/markers/user-arrow.png');
const PAW_IMG = require('../../assets/markers/user-paw.png');
const RING_MAX_M = 120; // выше этой точности круг не рисуем (как в iOS-версии)

const SIZE = 48;
const CX = SIZE / 2;   // 24 — circle center X
const CY = SIZE / 2;   // 24 — circle center Y  (= GPS anchor point when anchor={0.5,0.5})
const R = 17;          // outer circle radius

// Combined shape: circle body + small triangular tip at top (12 o'clock = heading 0 = North)
// Base of triangle is on the circle edge at ≈±20° from top:
//   left  (18, 8): distance to (24,24) ≈ 17.09 ✓
//   right (30, 8): same by symmetry ✓
// Tip at (24, 2) — 6px above the circle edge.
// Arc from left-base to right-base covers the bottom 320° of the circle:
// >180° → large-arc-flag 1; the walk left-base → bottom → right-base is
// counterclockwise on screen (SVG y-down) → sweep-flag 0. Sweep 1 would make
// the renderer pick the mirrored arc centre above the marker and bulge the
// arc outwards past the tip.
const SHELL_PATH = `M ${CX} 2 L 18 8 A ${R} ${R} 0 1 0 30 8 Z`;

export function UserLocationMarker({ headingAnim, accuracy }: Props) {
  // Shortest-arc unwrapping happens in useHeading; here the continuous value
  // maps straight to degrees (default extrapolation covers many full turns).
  const rotate = headingAnim.interpolate({
    inputRange: [-720, 720],
    outputRange: ['-720deg', '720deg'],
  });

  // Ring diameter: clamped between marker size and 120px
  const ringSize = accuracy != null && accuracy < 120
    ? Math.max(SIZE, Math.min(accuracy, 120))
    : 0;

  const content = (
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

  // iOS: возвращаем ровно прежнее дерево — anti-jump-контейнер (overflow:hidden,
  // 48×48) не трогаем. Android: оборачиваем симметричным прозрачным полем и
  // collapsable={false}, чтобы bitmap маркера снимался с запасом и не резал
  // правый/нижний край панциря. Поле симметрично → центр (GPS-точка) и
  // anchor 0.5/0.5 не меняются.
  if (Platform.OS === 'android') {
    return (
      <View collapsable={false} style={styles.androidPad}>
        {content}
      </View>
    );
  }
  return content;
}

interface AndroidProps {
  // AnimatedRegion, как и у iOS-маркера — координата едет за фиксом (слайд).
  coordinate: AnimatedRegion;
  // Плоская последняя позиция для <Circle> (у круга центр — LatLng, не Animated).
  center: LatLng | null;
  headingAnim: Animated.Value;
  accuracy?: number;
}

// Android-версия своего маркера: три оверлея карты вместо SVG-детей одного
// маркера. iOS сюда не заходит (см. ветку Platform.OS в экранах) — та версия
// байт в байт прежняя.
export function UserLocationMarkerAndroid({ coordinate, center, headingAnim, accuracy }: AndroidProps) {
  // Логика сглаживания направления не меняется: headingAnim по-прежнему считает
  // useHeading (native driver). Здесь только зеркалим его в JS-value, которым
  // MarkerAnimated крутит нативный проп `rotation` (он не transform → его нельзя
  // гнать нативным драйвером напрямую). Значение непрерывное (может выходить за
  // 0-360) — Google Maps rotation принимает любой угол.
  const rotation = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const id = headingAnim.addListener(({ value }) => rotation.setValue(value));
    return () => headingAnim.removeListener(id);
  }, [headingAnim, rotation]);

  const showRing = center != null && accuracy != null && accuracy > 0 && accuracy <= RING_MAX_M;

  return (
    <>
      {showRing && (
        <MapCircle
          center={center}
          radius={accuracy}
          fillColor="rgba(44, 95, 37, 0.10)"
          strokeColor="rgba(44, 95, 37, 0.22)"
          strokeWidth={1}
        />
      )}
      {/* Стрелка-капля: нативное вращение по курсу, flat = лежит на карте,
          anchor по центру = точка GPS. PNG смотрит строго вверх (север). */}
      <MarkerAnimated
        coordinate={coordinate}
        anchor={{ x: 0.5, y: 0.5 }}
        flat
        rotation={rotation as unknown as number}
        image={ARROW_IMG}
        zIndex={3}
      />
      {/* Лапа: статична поверх стрелки, тот же центр. */}
      <MarkerAnimated
        coordinate={coordinate}
        anchor={{ x: 0.5, y: 0.5 }}
        flat
        image={PAW_IMG}
        zIndex={3}
      />
    </>
  );
}

const styles = StyleSheet.create({
  // Android-only: прозрачное поле вокруг 48×48 контейнера (запас под обрезку
  // bitmap). Центрирует единственного ребёнка → центр совпадает с GPS-точкой.
  androidPad: {
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    // The rotating shell's bounding box grows with the angle (~68pt at 45°).
    // With overflow visible, Fabric folds that into the marker's
    // overflowInset, so every heading commit changes the marker's layout
    // metrics — and the legacy-interop wrapper answers that by assigning
    // AIRMapMarker.frame directly, which throws away the centre MapKit
    // placed it at: the marker jumps across the map on every turn.
    // Hidden pins the metrics. Nothing is clipped: the drawing reaches at
    // most 23.25pt from the centre (tip + stroke), inside the 24pt half-size.
    overflow: 'hidden',
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
