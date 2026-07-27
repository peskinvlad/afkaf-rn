import * as Location from 'expo-location';

export interface EnsureLocationPermissionResult {
  granted: boolean;
  blocked?: boolean;
}

// Checks current status first (no OS prompt) before deciding whether to
// actually request — so we don't blindly re-trigger a request the OS will
// silently no-op anyway once the user has already said no with
// canAskAgain=false (the "Don't Allow" case that never prompts again).
export async function ensureLocationPermission(): Promise<EnsureLocationPermissionResult> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.status === 'granted') {
    return { granted: true };
  }
  if (current.canAskAgain) {
    const requested = await Location.requestForegroundPermissionsAsync();
    return { granted: requested.status === 'granted' };
  }
  return { granted: false, blocked: true };
}
