import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Marker } from 'react-native-maps';

const TOUCH_SIZE = 44; // ≥ the stock pin's tap target the markers had before
const DISC_SIZE = 38;

// Android режет bitmap маркера по рамке чуть меньше самой вьюхи (правый/нижний
// край диска обрезался). Симметричный запас вокруг центрированного диска даёт
// прозрачные поля, в которые уходит обрезка, — диск цел. Растём симметрично,
// поэтому центр (и anchor 0.5/0.5) не двигается. iOS: pad=0, геометрия та же.
const ANDROID_MARKER_PAD = 6;
const androidMarkerBox = Platform.OS === 'android'
  ? { width: TOUCH_SIZE + ANDROID_MARKER_PAD * 2, height: TOUCH_SIZE + ANDROID_MARKER_PAD * 2 }
  : null;

// Android: готовые PNG-пины по типу метки, отдаём их через проп <Marker image>
// вместо children-View. На New Architecture (Fabric) react-native-maps@1.20.1
// рисует children-маркеры в заниженный bitmap → пин обрезан (см.
// docs/ANDROID-TODO.md, вариант «г»). Статичный image этого не касается и не
// растеризуется. Тип без PNG (неизвестный) падает на общий View-путь (серый 📍).
// PNG сгенерированы scripts/gen-marker-pngs.ts из того же MARKER_CONFIG.
const ANDROID_MARKER_IMAGES: Record<string, any> = {
  park: require('../../assets/markers/marker-park.png'),
  dog_park: require('../../assets/markers/marker-dog_park.png'),
  water: require('../../assets/markers/marker-water.png'),
  danger: require('../../assets/markers/marker-danger.png'),
  hazard: require('../../assets/markers/marker-hazard.png'),
  aggressive_dog: require('../../assets/markers/marker-aggressive_dog.png'),
  forbidden: require('../../assets/markers/marker-forbidden.png'),
};

type Props = {
  coordinate: { latitude: number; longitude: number };
  emoji: string;
  color: string;
  onPress?: () => void;
  title?: string;
  description?: string;
  // Тип метки — нужен для выбора Android-PNG (ANDROID_MARKER_IMAGES). Не задан
  // или нет PNG → общий View-путь (как на iOS).
  type?: string;
  // Draw order vs other markers. Default 1 (base layer: hazards + water).
  // Friend pins sit above at 2, the user marker above that at 3 — set explicitly
  // so the stack can't reshuffle when a marker re-renders (e.g. a callout opens).
  zIndex?: number;
};

// Coloured disc + emoji replacing the stock pin. tracksViewChanges stays on
// only for the first moments: Android rasterises the marker view into a
// bitmap, and freezing before the emoji has actually drawn captures an empty
// frame — a short timeout is more reliable there than onLayout, which fires
// before the frame is committed. Then it's switched off so the map doesn't
// re-rasterise every marker on every frame. (Только для View-пути — iOS и
// Android-fallback; основной Android-путь ниже отдаёт статичный PNG.)
export function MapMarkerIcon({ coordinate, emoji, color, onPress, title, description, type, zIndex = 1 }: Props) {
  const [tracksViewChanges, setTracksViewChanges] = useState(true);

  useEffect(() => {
    const id = setTimeout(() => setTracksViewChanges(false), 500);
    return () => clearTimeout(id);
  }, []);

  // Android + известный тип → готовый PNG без детей (anchor по центру, как у
  // View-диска: 0.5/0.5). onPress и кастомный callout работают как прежде;
  // title/description (нативный callout воды) сохраняются.
  const androidImage = Platform.OS === 'android' && type ? ANDROID_MARKER_IMAGES[type] : undefined;
  if (androidImage) {
    return (
      <Marker
        coordinate={coordinate}
        anchor={{ x: 0.5, y: 0.5 }}
        image={androidImage}
        onPress={onPress}
        title={title}
        description={description}
        zIndex={zIndex}
      />
    );
  }

  return (
    <Marker
      coordinate={coordinate}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={tracksViewChanges}
      onPress={onPress}
      title={title}
      description={description}
      zIndex={zIndex}
    >
      {/* collapsable={false}: не даём Android «схлопнуть» wrapper-вью до снятия
          bitmap (схлопнутая/недомеренная вью и давала обрезку пина). */}
      <View collapsable={false} style={[styles.touchArea, androidMarkerBox]}>
        <View style={[styles.disc, { backgroundColor: color }]}>
          <Text style={styles.emoji}>{emoji}</Text>
        </View>
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  touchArea: {
    width: TOUCH_SIZE,
    height: TOUCH_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disc: {
    width: DISC_SIZE,
    height: DISC_SIZE,
    borderRadius: DISC_SIZE / 2,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 18,
    lineHeight: 20,
    textAlign: 'center',
    includeFontPadding: false, // Android: kill baseline padding that sinks emoji
  },
});
