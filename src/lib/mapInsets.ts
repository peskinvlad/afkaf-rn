// Static insets for MapKit's Apple logo (mapPadding) and the "Legal" link
// (legalLabelInsets, iOS) so they sit on ONE line directly above the asphalt-
// temperature chip, left-aligned to it.
//
// The values are derived from the same constants that position the chip on each
// screen (passed in as ChipAnchor), so editing the chip moves the attribution
// with it. They are DELIBERATELY not derived from onLayout — measuring the
// bottom panel is exactly what made the logo / Legal jitter on every relayout.
// Callers compute the result once at module scope (stable reference) so the
// native side never receives new insets on re-render.

// Height of the asphalt chip (heatCard): paddingVertical 8*2 + the two stacked
// lines (temp ~18 + label ~12). A constant on purpose.
const CHIP_HEIGHT = 52;
// Gap between the chip's top edge and the logo / Legal line.
const GAP = 8;

export interface ChipAnchor {
  left: number;   // chip's left edge, in the map's coordinate space
  bottom: number; // chip's bottom offset, in the map's coordinate space
}

export interface MapAttributionInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

// One line directly above the chip, left-aligned to it.
export function mapAttributionInsets(chip: ChipAnchor): MapAttributionInsets {
  return {
    top: 0,
    right: 0,
    bottom: chip.bottom + CHIP_HEIGHT + GAP,
    left: chip.left,
  };
}
