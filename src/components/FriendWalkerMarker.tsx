import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Marker } from 'react-native-maps';

// Freshness of a friend's last position ping (ms epoch → age):
//   ≤ STALE_MS   — solid pin
//   STALE…HIDE   — half-transparent (position is getting old)
//   > HIDE_MS    — caller drops the pin entirely (card in the sheet stays)
export const FRIEND_PIN_STALE_MS = 5 * 60 * 1000;
export const FRIEND_PIN_HIDE_MS = 10 * 60 * 1000;

const RING_COLOR = '#2c5f25'; // brand green — distinct from hazard/water discs and own marker
const TOUCH_SIZE = 44;
const DISC_SIZE = 38;

type Props = {
  coordinate: { latitude: number; longitude: number };
  avatar: string;   // dog emoji
  ageMs: number;    // now − updatedAt, decides opacity
  onPress?: () => void;
};

// A friend who is walking right now. White disc + dog emoji inside a thick green
// ring, so it reads apart from the coloured hazard/water discs and the blue
// user-location marker. tracksViewChanges follows MapMarkerIcon: on briefly so
// Android rasterises the emoji, then off so the map doesn't re-render every pin
// each frame (map rules, CLAUDE.md).
export function FriendWalkerMarker({ coordinate, avatar, ageMs, onPress }: Props) {
  const [tracksViewChanges, setTracksViewChanges] = useState(true);

  // Re-arm the one-shot freeze whenever opacity flips (stale threshold crossed),
  // so the bitmap is recaptured at the new transparency instead of staying solid.
  const stale = ageMs > FRIEND_PIN_STALE_MS;
  useEffect(() => {
    setTracksViewChanges(true);
    const id = setTimeout(() => setTracksViewChanges(false), 500);
    return () => clearTimeout(id);
  }, [stale]);

  return (
    <Marker
      coordinate={coordinate}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={tracksViewChanges}
      onPress={onPress}
      // Always above hazard/water markers (zIndex 1), whether or not the callout
      // is open — otherwise the native stack reshuffles on re-render and a
      // co-located hazard pin can cover the dog. Stays below the user marker (3).
      zIndex={2}
    >
      <View style={[styles.touchArea, stale && styles.stale]}>
        <View style={styles.disc}>
          <Text style={styles.emoji}>{avatar}</Text>
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
  stale: { opacity: 0.5 },
  disc: {
    width: DISC_SIZE,
    height: DISC_SIZE,
    borderRadius: DISC_SIZE / 2,
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: RING_COLOR,
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
