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
