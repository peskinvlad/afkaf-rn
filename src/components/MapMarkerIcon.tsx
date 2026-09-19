import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Marker } from 'react-native-maps';

const TOUCH_SIZE = 44; // ≥ the stock pin's tap target the markers had before
const DISC_SIZE = 38;

type Props = {
  coordinate: { latitude: number; longitude: number };
  emoji: string;
  color: string;
  onPress?: () => void;
  title?: string;
  description?: string;
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
// re-rasterise every marker on every frame.
export function MapMarkerIcon({ coordinate, emoji, color, onPress, title, description, zIndex = 1 }: Props) {
  const [tracksViewChanges, setTracksViewChanges] = useState(true);

  useEffect(() => {
    const id = setTimeout(() => setTracksViewChanges(false), 500);
    return () => clearTimeout(id);
  }, []);

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
      <View style={styles.touchArea}>
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
