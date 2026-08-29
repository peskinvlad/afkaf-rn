import { useCallback, useEffect, useRef, useState } from 'react';
import type MapView from 'react-native-maps';
import { LatLng } from '../lib/geo';
import { ScreenPoint } from '../lib/calloutLayout';

export type { ScreenPoint };

// Where a coordinate currently sits inside the MapView, in the map view's own
// coordinate space. Both platforms report density-independent points here:
// iOS works in points natively and the Android bridge divides the projected
// pixel by display density before resolving, so the value drops straight into
// a style without a PixelRatio conversion.
//
// This is the reliable way to place something over a specific pin. The
// alternative — rendering the popup as a child of <Marker> — is anchored for
// free but rasterised into a bitmap on Android, where the vote buttons inside
// it would stop receiving touches.
export function useCalloutAnchor(
  mapRef: React.RefObject<MapView | null>,
  coord: LatLng | null
): { point: ScreenPoint | null; refresh: () => void } {
  const [point, setPoint] = useState<ScreenPoint | null>(null);
  // The bridge call is a promise, and refresh() is wired to onRegionChange,
  // which fires every frame of a pan. One request at a time: dropped frames
  // during the gesture cost nothing, because onRegionChangeComplete asks
  // again once the map settles.
  const inFlight = useRef(false);
  const coordRef = useRef(coord);
  coordRef.current = coord;

  const refresh = useCallback(() => {
    const target = coordRef.current;
    const map = mapRef.current;
    if (!target || !map || inFlight.current) return;
    inFlight.current = true;
    map
      .pointForCoordinate(target)
      .then((p) => {
        // The user may have tapped another pin while this was in flight —
        // that answer belongs to the old one.
        const now = coordRef.current;
        if (now && now.latitude === target.latitude && now.longitude === target.longitude) {
          setPoint(p);
        }
      })
      // Map not laid out yet, or torn down mid-call: no point to show, and
      // the next region change asks again.
      .catch(() => {})
      .then(() => {
        inFlight.current = false;
      });
  }, [mapRef]);

  useEffect(() => {
    if (!coord) {
      setPoint(null);
      return;
    }
    refresh();
  }, [coord?.latitude, coord?.longitude, refresh]);

  return { point, refresh };
}
