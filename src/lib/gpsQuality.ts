import { haversine, LatLng } from './geo';

// Field testing showed raw fixes drifting tens of metres while walking — one
// of them put the walker out in the sea. Every one of those came in with a
// horizontal accuracy far worse than the real spread, so a single accuracy
// gate is enough to throw them away before they reach the marker, the
// recorded track, or a marker the user is about to publish.
export const GPS_ACCURACY_MAX_M = 30;

// coords.accuracy is the horizontal radius in metres (68% confidence), or
// null on the rare device/platform that doesn't report it. A missing value
// can't be proven bad, and rejecting it would freeze the marker for good on
// such a device — so it passes, and only an explicit value is measured
// against the gate.
export function isAccurateFix(accuracy: number | null | undefined): boolean {
  return accuracy == null || accuracy <= GPS_ACCURACY_MAX_M;
}

// ── Plausibility gate ───────────────────────────────────────────────────
// The accuracy gate above only catches fixes that admit they are bad. Field
// testing in dense streets turned up the other kind: the position jumps tens
// of metres sideways, sits there for a second or two, then snaps back — and
// every one of those fixes reports a healthy accuracy, because the phone is
// confident about a signal that reached it off a building. Nothing in the fix
// itself gives it away; what gives it away is that no walker could have moved
// that far that fast.
//
// 8 m/s is ~29 km/h — far above a running dog or a sprinting owner, so a
// genuine walk never trips it, and still generous enough that a fix taken
// from a car or a bus is not thrown away.
export const MAX_PLAUSIBLE_SPEED_MPS = 8;

// Beyond this gap the speed check is meaningless: distance/dt over a long
// gap says nothing about how the walker got there (screen locked, tunnel,
// the accuracy gate above silencing the stream). Such a fix is taken as-is
// and becomes the new reference point.
export const GPS_MAX_STEP_GAP_MS = 30_000;

// Is `b` somewhere the walker could actually have reached from `a` in dtMs?
// An unusable dt — non-positive, or longer than the gap above — is not
// evidence of anything, so it never rejects.
function isPlausibleStep(a: LatLng, b: LatLng, dtMs: number): boolean {
  if (!(dtMs > 0) || dtMs > GPS_MAX_STEP_GAP_MS) return true;
  const metres = haversine(a, b) * 1000;
  return metres / (dtMs / 1000) <= MAX_PLAUSIBLE_SPEED_MPS;
}

// A reflection glitch does not always last a single fix — the field report
// has the position sitting in the wrong place for a couple of seconds, which
// at ~1 fix/s means two bad fixes in a row that agree with each other. So one
// fix corroborating another is not enough to call it a move; it takes this
// many fixes after the suspect one, all consistent with it, before the walker
// is believed to be over there.
export const GLITCH_CONFIRM_FIXES = 2;

export interface GlitchFilter<T extends LatLng> {
  // Returns the fixes that are cleared for use, in order — usually the one
  // passed in, sometimes none (it is being held), sometimes a whole held
  // run released at once by the fix that confirmed it.
  accept: (fix: T, timestampMs: number) => T[];
  // Forget the reference position — the next fix is treated as a first fix.
  // For when the stream stops belonging to this filter (watcher torn down).
  reset: () => void;
}

// Rejecting an implausible fix outright would be wrong: a real position can
// also arrive far from the last one (signal came back after a tunnel, the
// user was driven somewhere), and a filter that never lets those through
// leaves the marker stuck at a stale point for good.
//
// So a suspect fix is held, not dropped, and the fixes after it decide:
//   • the position returns to where the walker was → it was a reflection;
//     everything held is discarded, and none of it ever reached the marker,
//     the recorded track or the heading.
//   • GLITCH_CONFIRM_FIXES more fixes keep agreeing with it → the walker
//     really is over there; the whole run is released in order, so the track
//     stays continuous.
// Nothing can be held indefinitely: once the held-back stretch passes
// GPS_MAX_STEP_GAP_MS the next fix is exempt from the check and accepted.
//
// One filter per position stream — it carries the reference position.
export function createGlitchFilter<T extends LatLng>(): GlitchFilter<T> {
  let last: { fix: T; t: number } | null = null;
  // The suspect fix and everything corroborating it so far, oldest first.
  let held: { fix: T; t: number }[] = [];

  return {
    accept(fix: T, timestampMs: number): T[] {
      // First fix of the stream: no reference position, so no speed to check
      // it against. It becomes the reference.
      if (last == null) {
        last = { fix, t: timestampMs };
        held = [];
        return [fix];
      }

      if (isPlausibleStep(last.fix, fix, timestampMs - last.t)) {
        // Reachable from where the walker was. If anything was being held,
        // this is the "snapped back" case — the walker never left, and the
        // held run is dropped unused.
        last = { fix, t: timestampMs };
        held = [];
        return [fix];
      }

      const newest = held[held.length - 1];
      if (newest == null || !isPlausibleStep(newest.fix, fix, timestampMs - newest.t)) {
        // Suspect, and it does not continue the run being held either: fixes
        // that agree with neither the old position nor each other are noise.
        // The newest one is the better bet for what comes next, so it starts
        // the run over.
        held = [{ fix, t: timestampMs }];
        return [];
      }

      held.push({ fix, t: timestampMs });
      if (held.length <= GLITCH_CONFIRM_FIXES) return []; // not convinced yet

      // A suspect fix plus enough consistent ones after it: that is a move,
      // not a reflection. Release the run in the order it arrived.
      const released = held.map((h) => h.fix);
      last = { fix, t: timestampMs };
      held = [];
      return released;
    },
    reset() {
      last = null;
      held = [];
    },
  };
}
