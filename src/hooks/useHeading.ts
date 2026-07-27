import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import * as Location from 'expo-location';

// Ignore compass jitter below this — 2° keeps slow turns visible without
// spamming native animations (the old 5° dead zone read as "jerky").
const MIN_DELTA_DEG = 2;
const ROTATE_MS = 250;

// Compass heading as an Animated.Value in degrees — NOT React state, so a
// compass tick never re-renders the subscribing screen; the value drives the
// marker rotation on the native thread.
//
// The value is unwrapped/continuous: each tick adds the shortest-arc delta
// (359°→1° animates +2°, not -358°), so it can grow beyond 0-360. Consumers
// interpolate with default extrapolation, e.g. [-720, 720] → ['-720deg',
// '720deg'].
//
// enabled=false removes the subscription (used to pause the map's compass
// while a walk screen owns it); flipping back to true re-subscribes.
export function useHeading(enabled: boolean): Animated.Value {
  const headingAnim = useRef(new Animated.Value(0)).current;
  const unwrapped = useRef(0); // continuous target the animation is heading to
  const lastRaw = useRef<number | null>(null); // last raw 0-360 reading
  const subRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      if (subRef.current) return; // one watcher max
      try {
        const sub = await Location.watchHeadingAsync((h) => {
          // trueHeading is -1 when unavailable → magnetic; both invalid → skip
          const value = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
          if (value < 0) return;
          const prev = lastRaw.current;
          if (prev == null) {
            // First fix snaps without animating from north
            lastRaw.current = value;
            unwrapped.current = value;
            headingAnim.setValue(value);
            return;
          }
          // Shortest-arc delta across the 359°→0° wrap
          const delta = ((value - prev + 540) % 360) - 180;
          if (Math.abs(delta) < MIN_DELTA_DEG) return;
          lastRaw.current = value;
          unwrapped.current += delta;
          Animated.timing(headingAnim, {
            toValue: unwrapped.current,
            duration: ROTATE_MS,
            useNativeDriver: true,
          }).start();
        });
        // While we awaited, a concurrent effect run may have won or cleanup ran
        if (cancelled || subRef.current) {
          sub.remove();
          return;
        }
        subRef.current = sub;
      } catch (e) {
        // No compass / no permission — arrow just stays put, no crash
        console.warn('[useHeading] watchHeadingAsync failed:', e);
      }
    })();
    return () => {
      cancelled = true;
      subRef.current?.remove();
      subRef.current = null;
    };
  }, [enabled]);

  return headingAnim;
}
