// Insets for MapKit's attribution ornaments (mapPadding / layoutMargins): the
// Apple logo and the "Legal" link. They sit STRICTLY ABOVE the asphalt-
// temperature chip, hugging it — visually one plate with the chip.
//
// The bottom inset is NOT a constant estimate anymore. Each screen measures its
// chip (measureInWindow → screen-space top + left) and passes it here, so the
// ornaments track the chip's REAL rendered position instead of a guessed one.
// Callers keep the result in state and only update it when the measured chip
// actually moves, so the native side isn't re-inset on every render — and they
// measure the CHIP, not the (constantly relaying-out) bottom panel, which is
// what used to make the ornaments jitter.
//
// Two offsets are subtracted from the raw distance, or the ornaments float too
// high above the chip:
//   1. safeAreaBottom — MKMapView.insetsLayoutMarginsFromSafeArea defaults to
//      true, so MapKit silently ADDS the bottom safe-area inset (home indicator,
//      ~34pt) on top of the mapPadding.bottom we set. We subtract it back so the
//      compensation self-adjusts per device (0 on a non-notched phone).
//   2. MAPKIT_MARGIN — MapKit's own intrinsic ornament margin above the layout
//      margin. Empirical (~14pt); on a 34pt-inset device the two sum to ~48,
//      which is the ~40pt overshoot seen on-device plus the 8pt we already had.

// Desired VISUAL gap between the chip's top edge and the ornaments.
const DESIRED_GAP = 4;
// MapKit's intrinsic ornament margin above the layout margin (see note above).
// Empirically tuned on-device: lower value → ornaments sit higher.
const MAPKIT_MARGIN = 8;
// Nudge the ornaments 4pt left of the chip's left edge for exact visual align.
const LEFT_NUDGE = 4;

export interface ChipRect {
  top: number;  // chip's top edge, measured from the top of the screen (window)
  left: number; // chip's left edge, measured from the left of the screen
}

export interface MapAttributionInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

// One line directly above the chip, left-aligned to it. `screenHeight` is the
// window height (Dimensions), so screenHeight − chip.top is the distance from
// the screen bottom to the chip's top edge. `safeAreaBottom` is the bottom
// safe-area inset MapKit re-adds (see note above).
export function mapAttributionInsets(
  chip: ChipRect,
  screenHeight: number,
  safeAreaBottom: number,
): MapAttributionInsets {
  return {
    top: 0,
    right: 0,
    bottom: screenHeight - chip.top + DESIRED_GAP - MAPKIT_MARGIN - safeAreaBottom,
    left: chip.left - LEFT_NUDGE,
  };
}
