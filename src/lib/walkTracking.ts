import * as Location from 'expo-location';
import { requireOptionalNativeModule } from 'expo';

// Walk route tracking that keeps running with the app in the background.
//
// watchPositionAsync can't do this: expo-location hard-codes
// allowsBackgroundLocationUpdates = NO for it, so iOS stops delivering fixes
// (and soon suspends the app) the moment the walker locks the phone. Location
// updates bound to a TaskManager task run on a manager with background updates
// allowed; together with UIBackgroundModes=location (app.json plugin) a walk
// started in the foreground keeps recording behind the blue status-bar pill.
// "While using" permission is enough for that — Always would only be needed to
// start tracking from the background, which a walk never does.

export const WALK_LOCATION_TASK = 'afkaf-walk-location';

// The native module exists only in builds made after expo-task-manager was
// added. An older dev client still loads this JS from Metro, and importing
// expo-task-manager there throws at module load and takes the whole app down
// — hence the check and the require below instead of a static import. Without
// it tracking falls back to the old foreground-only watcher.
export const isBackgroundTrackingAvailable =
  requireOptionalNativeModule('ExpoTaskManager') != null;

type Listener = (locations: Location.LocationObject[]) => void;

// One walk at a time, one consumer: the active walk screen. Fixes that arrive
// with nobody subscribed belong to no walk and are dropped.
let listener: Listener | null = null;

// Must run when the JS bundle loads — this module is imported from index.ts —
// so the task is defined before iOS delivers the first batch to it.
if (isBackgroundTrackingAvailable) {
  const TaskManager = require('expo-task-manager') as typeof import('expo-task-manager');
  TaskManager.defineTask<{ locations: Location.LocationObject[] }>(
    WALK_LOCATION_TASK,
    async ({ data, error }) => {
      if (error) {
        // Typically kCLErrorLocationUnknown indoors — the manager keeps trying.
        console.warn('[walkTracking] location task error:', error.message);
        return;
      }
      const locations = data?.locations ?? [];
      if (locations.length > 0) listener?.(locations);
    }
  );
}

let fallbackSub: Location.LocationSubscription | null = null;

// Subscribe before starting, so the first fix has somewhere to go.
export function subscribeWalkLocations(fn: Listener): () => void {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
}

export async function startWalkTracking(): Promise<void> {
  if (!isBackgroundTrackingAvailable) {
    fallbackSub?.remove();
    fallbackSub = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 5 },
      (loc) => listener?.([loc])
    );
    return;
  }
  await Location.startLocationUpdatesAsync(WALK_LOCATION_TASK, {
    accuracy: Location.Accuracy.BestForNavigation,
    distanceInterval: 5,
    activityType: Location.ActivityType.Fitness,
    // iOS default is to pause when the walker stands still (a dog sniffing a
    // lamppost). A paused session can't resume in the background without
    // Always permission — the rest of the walk would be lost.
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
  });
}

// Safe to call whether or not tracking is running — also used at startup to
// stop a session orphaned by a crash or a JS reload mid-walk.
export async function stopWalkTracking(): Promise<void> {
  fallbackSub?.remove();
  fallbackSub = null;
  if (!isBackgroundTrackingAvailable) return;
  try {
    if (await Location.hasStartedLocationUpdatesAsync(WALK_LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(WALK_LOCATION_TASK);
    }
  } catch (e) {
    console.warn('[walkTracking] stop failed:', e);
  }
}
