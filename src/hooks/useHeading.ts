import { useCallback, useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import * as Location from 'expo-location';

// ── Angle smoothing ─────────────────────────────────────────────────────────
// Below this the change is treated as sensor noise and the marker doesn't move
// at all — a magnetometer wobbles a degree or two just from a swinging hand.
// The deadband is measured against the accumulated error, not the per-reading
// delta, so a slow real turn still gets through once it adds up.
const DEADBAND_DEG = 2;
// Past this, one reading is treated as suspect — a spike, or the compass
// re-calibrating — and it eases in over the longer time constant, so the
// marker leans into a big jump instead of snapping there and snapping back.
const JUMP_DEG = 5;
// Every change above the deadband is low-passed, jumps just get the slower
// constant. Weighting by elapsed time rather than per reading is what makes
// one pipeline serve both sources: the compass fires tens of times a second
// (heavy smoothing, the hand-wobble dies), GPS course arrives about once a
// second (light smoothing, the marker keeps up with a real turn).
const SMOOTH_TAU_MS = 250;
const JUMP_TAU_MS = 400;
const MAX_DT_MS = 2000; // a long gap shouldn't mean "apply the jump in full"
const ROTATE_MS = 250;

// ── Hybrid source ───────────────────────────────────────────────────────────
// A magnetometer reports where the phone points; at walking pace the GPS
// course reports where the walker actually goes, which is what the marker is
// meant to show. Two thresholds plus a dwell time keep the source from
// flapping when the walker hovers around the boundary: it takes sustained
// speed above MOVING_MPS to hand over to GPS, and sustained speed below
// STILL_MPS to hand back.
const MOVING_MPS = 1.2;
const STILL_MPS = 0.8;
const SWITCH_DWELL_MS = 2000;
// GPS mode with no fresh fix for this long falls back to the compass — the
// accuracy filter upstream can silence the position stream completely, and a
// frozen arrow is worse than a jittery one.
const GPS_STALE_MS = 5000;

export interface HeadingController {
  // Continuous, unwrapped heading in degrees. Not React state: a compass tick
  // never re-renders the subscribing screen, and the value drives the marker
  // rotation on the native thread. It grows past 0-360 (359° → 1° animates
  // +2°, not -358°), so consumers interpolate over a wide range, e.g.
  // [-720, 720] → ['-720deg', '720deg'].
  headingAnim: Animated.Value;
  // Called by whichever screen owns the location watcher, once per accepted
  // fix. Supplies the speed that picks the source and the course used while
  // moving. Stable identity — safe to call from inside a watcher closure.
  reportGpsFix: (coords: Location.LocationObjectCoords) => void;
}

// enabled=false removes the compass subscription (used to pause the map's
// compass while a walk screen owns it); flipping back to true re-subscribes.
export function useHeading(enabled: boolean): HeadingController {
  const headingAnim = useRef(new Animated.Value(0)).current;

  // rawUnwrapped follows the active source exactly; smoothed is what the
  // animation chases. Both are continuous and may run past 0-360.
  const rawUnwrapped = useRef(0);
  const smoothed = useRef(0);
  const lastRaw = useRef<number | null>(null); // last raw 0-360 reading
  const lastReadingAt = useRef(0);

  const source = useRef<'compass' | 'gps'>('compass');
  const switchPendingSince = useRef<number | null>(null);
  const lastGpsFixAt = useRef(0);

  // Mirror of `enabled` for reportGpsFix, which is called from a watcher
  // closure the owning screen created once and never re-creates.
  const enabledRef = useRef(enabled);
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);
  const subRef = useRef<Location.LocationSubscription | null>(null);

  // One absolute bearing (0-360) from whichever source currently owns the
  // marker, pushed through the shortest-arc + deadband + jump-easing pipeline.
  const applyBearing = useCallback(
    (value: number) => {
      const now = Date.now();
      if (lastRaw.current == null) {
        // First reading snaps — animating from north would spin the marker.
        lastRaw.current = value;
        rawUnwrapped.current = value;
        smoothed.current = value;
        lastReadingAt.current = now;
        headingAnim.setValue(value);
        return;
      }
      // Shortest arc across the 0/360 seam: 350° → 10° is +20°, not -340°.
      const delta = ((value - lastRaw.current + 540) % 360) - 180;
      lastRaw.current = value;
      rawUnwrapped.current += delta;

      const dt = Math.min(now - lastReadingAt.current, MAX_DT_MS);
      lastReadingAt.current = now;

      const err = rawUnwrapped.current - smoothed.current;
      if (Math.abs(err) < DEADBAND_DEG) return; // micro-jitter: hold still

      // Only a share of the error is applied per reading; the rest keeps being
      // applied on the ones after it. A real turn still lands (a sustained
      // error keeps feeding the filter) while a one-off spike decays before
      // the marker gets anywhere. A ±1.5° hand wobble settles on its midpoint
      // and then sits inside the deadband, which is what stops the twitching.
      const tau = Math.abs(err) > JUMP_DEG ? JUMP_TAU_MS : SMOOTH_TAU_MS;
      smoothed.current += err * (1 - Math.exp(-dt / tau));

      Animated.timing(headingAnim, {
        toValue: smoothed.current,
        duration: ROTATE_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    },
    [headingAnim]
  );

  const reportGpsFix = useCallback(
    (coords: Location.LocationObjectCoords) => {
      if (!enabledRef.current) return;
      const now = Date.now();
      lastGpsFixAt.current = now;

      // speed is null where unsupported and -1 on Android when unknown.
      const speed = coords.speed != null && coords.speed >= 0 ? coords.speed : null;
      if (speed != null) {
        const desired =
          source.current === 'compass'
            ? speed > MOVING_MPS ? 'gps' : 'compass'
            : speed < STILL_MPS ? 'compass' : 'gps';
        if (desired === source.current) {
          switchPendingSince.current = null; // back inside the current band
        } else if (switchPendingSince.current == null) {
          switchPendingSince.current = now;
        } else if (now - switchPendingSince.current >= SWITCH_DWELL_MS) {
          source.current = desired;
          switchPendingSince.current = null;
        }
      }

      if (source.current !== 'gps') return;
      // heading is the GPS course over ground: null where unsupported, -1
      // when the fix carries no usable course. Either way, leave the marker
      // where it is until the next fix.
      const course = coords.heading;
      if (course != null && course >= 0) applyBearing(course);
    },
    [applyBearing]
  );

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
          if (source.current === 'gps') {
            // GPS course owns the marker while the walker is moving — but only
            // while fixes actually keep arriving.
            if (Date.now() - lastGpsFixAt.current < GPS_STALE_MS) return;
            source.current = 'compass';
            switchPendingSince.current = null;
          }
          applyBearing(value);
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
  }, [enabled, applyBearing]);

  return { headingAnim, reportGpsFix };
}
