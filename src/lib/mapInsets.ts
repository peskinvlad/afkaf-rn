import { mapDebug } from './mapDebug';

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

// Верхняя граница нижнего отступа — доля высоты окна: реальный bottom ~150–260,
// но битый замер может дать отрицательное/огромное значение.
const MAX_SANE_BOTTOM_FRACTION = 0.6;

// One line directly above the chip. `screenHeight` is the window height
// (Dimensions), so screenHeight − chip.top is the distance from the screen
// bottom to the chip's top edge. `safeAreaBottom` is the bottom safe-area inset
// MapKit re-adds (see note above).
//
// LEFT НИКОГДА не берётся из замера — только фолбэк-константа экрана. Причина:
// measureInWindow меряет чип в координатах окна, и во время slide-in перехода
// навигации (animation:'slide_from_right') входящий экран смещён на ширину окна
// вправо → x ≈ ширина+16 (наблюдали left=442 при окне 430) → layoutMargins
// съедают всю ширину → видимая область карты нулевая → longitudeDelta 0 →
// переворот долготы на 180° («океан») и пропавший логотип Apple. Горизонтальный
// отступ у нас маленький и постоянный, мерить его незачем.
//
// Из замера используется ТОЛЬКО y (для bottom). bottom-санитайзер (всегда, не
// под флагом): при мусорном/отрицательном/слишком большом значении — фолбэк.
// top и right — строго 0.
export function mapAttributionInsets(
  chip: ChipRect,
  screenHeight: number,
  safeAreaBottom: number,
  fallback: { left: number; bottom: number },
): MapAttributionInsets {
  const rawBottom = screenHeight - chip.top + DESIRED_GAP - MAPKIT_MARGIN - safeAreaBottom;

  const maxBottom = screenHeight * MAX_SANE_BOTTOM_FRACTION;
  const bottomOk = Number.isFinite(rawBottom) && rawBottom >= 0 && rawBottom <= maxBottom;
  const bottom = bottomOk ? rawBottom : fallback.bottom;
  if (!bottomOk) mapDebug.log(`PADFIX bottom=${rawBottom}→${bottom}`);

  return { top: 0, right: 0, bottom, left: fallback.left };
}
