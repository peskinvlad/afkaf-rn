// Placement maths for the marker callout, kept free of React and of
// react-native so the edge cases can be reasoned about — and exercised — on
// their own.

export interface ScreenPoint {
  x: number;
  y: number;
}

// ── Geometry ────────────────────────────────────────────────────────────────
export const MAX_WIDTH = 300;
export const MIN_WIDTH = 210;
export const PIN_HALF = 19; // MapMarkerIcon draws a 38pt disc anchored at its centre
export const TAIL_W = 18;
export const TAIL_H = 9;
export const EDGE_MARGIN = 12; // the bubble never comes closer than this to an edge
const TAIL_GAP = 4;     // breathing room between the pin and the tail tip
const CORNER_SAFE = 18; // keeps the tail off the bubble's rounded corners

export interface CalloutLayout {
  left: number;
  top: number;
  tailLeft: number;
  below: boolean;
}

// Pure placement: given where the pin is and how big the bubble measured,
// decide where the bubble sits and where its tail meets it.
//
// `left`/`top` are physical edges in Yoga — unlike `start`/`end` they are not
// mirrored when I18nManager.isRTL is on — so one set of numbers is correct in
// Hebrew as well, and the tail cannot drift to the wrong side of the bubble.
export function computeCalloutLayout(input: {
  anchor: ScreenPoint;
  bubble: { width: number; height: number };
  container: { width: number; height: number };
  topInset: number;
}): CalloutLayout {
  const { anchor, bubble, container, topInset } = input;
  const blockH = bubble.height + TAIL_H;

  const minTop = topInset + EDGE_MARGIN;
  const aboveTop = anchor.y - PIN_HALF - TAIL_GAP - blockH;
  const belowTop = anchor.y + PIN_HALF + TAIL_GAP;

  // Above by default. A pin near the top of the map leaves no room there, so
  // the bubble flips under it and the tail moves to its roof. Vertically the
  // bubble is never nudged after that: the tail has to touch the pin, and a
  // bubble shifted to dodge something is a bubble pointing at nothing. An
  // above-placed bubble ends where the pin is, so it cannot reach the bottom
  // of the map anyway, and a below-placed one only happens for pins near the
  // top — the clamp below is a backstop, not a working part.
  const below = aboveTop < minTop;
  const maxTop = Math.max(minTop, container.height - EDGE_MARGIN - blockH);
  const top = Math.max(minTop, Math.min(below ? belowTop : aboveTop, maxTop));

  // Centred on the pin, then pulled back inside both edges.
  const maxLeft = Math.max(EDGE_MARGIN, container.width - EDGE_MARGIN - bubble.width);
  const left = Math.max(EDGE_MARGIN, Math.min(anchor.x - bubble.width / 2, maxLeft));

  // The tail stays on the pin while the bubble slides sideways, right up to
  // the point where it would climb onto a corner radius.
  const tailIdeal = anchor.x - left - TAIL_W / 2;
  const tailMax = Math.max(CORNER_SAFE, bubble.width - CORNER_SAFE - TAIL_W);
  const tailLeft = Math.max(CORNER_SAFE, Math.min(tailIdeal, tailMax));

  return { left, top, tailLeft, below };
}
