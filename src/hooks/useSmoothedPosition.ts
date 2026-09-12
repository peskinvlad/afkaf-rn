import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';
import { AnimatedRegion } from 'react-native-maps';
import { LatLng } from '../lib/geo';

// A fix lands roughly once a second. Sliding the marker over most of that
// window reads as walking; anything much shorter still reads as a teleport,
// and anything longer leaves the marker visibly behind the walker.
export const MOVE_MS = 400;

export interface SmoothedPosition {
  // Feed straight into <Marker.Animated coordinate={...} /> — the marker
  // position is driven by the Animated graph, so a fix does not re-render
  // the map screen through this hook.
  coord: AnimatedRegion;
  // False until the first fix, so the caller can keep the marker unmounted
  // rather than parking it at 0,0 off the coast of Africa.
  hasFix: boolean;
  moveTo: (pt: LatLng) => void;
}

// Animates the user marker from its current position to each new fix instead
// of snapping it there. Animated API only — this project has reanimated
// disabled on purpose.
export function useSmoothedPosition(durationMs: number = MOVE_MS): SmoothedPosition {
  const coord = useRef(
    new AnimatedRegion({ latitude: 0, longitude: 0, latitudeDelta: 0, longitudeDelta: 0 })
  ).current;
  const [hasFix, setHasFix] = useState(false);
  const hasFixRef = useRef(false); // read inside moveTo without re-creating it
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  const moveTo = useCallback(
    (pt: LatLng) => {
      // First fix snaps: there is no "previous position" to travel from, and
      // animating would drag the marker across the world from 0,0.
      if (!hasFixRef.current) {
        hasFixRef.current = true;
        coord.setValue({ ...pt, latitudeDelta: 0, longitudeDelta: 0 });
        setHasFix(true);
        return;
      }
      // A fix arriving mid-animation retargets from wherever the marker
      // currently is, so the path stays continuous.
      animRef.current?.stop();
      animRef.current = coord.timing({
        latitude: pt.latitude,
        longitude: pt.longitude,
        // The deltas belong to AnimatedRegion's Region shape, not to a
        // marker — held at 0 so they animate 0 → 0 and change nothing.
        latitudeDelta: 0,
        longitudeDelta: 0,
        duration: durationMs,
        // Constant velocity: a chain of eased hops reads as stop-start,
        // linear reads as someone walking.
        easing: Easing.linear,
        // lat/lng are not transform props — no native driver for them.
        useNativeDriver: false,
        // Required by the typings; AnimatedRegion derives the real target
        // per coordinate from the fields above and ignores this.
        toValue: 0,
      });
      animRef.current.start();
    },
    [coord, durationMs]
  );

  useEffect(() => () => animRef.current?.stop(), []);

  return { coord, hasFix, moveTo };
}
