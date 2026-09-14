import AsyncStorage from '@react-native-async-storage/async-storage';
import { HOME_ZONE_KEYS } from './privacyZone';
import { PENDING_KEY } from './walkHistory';
import { DEV_ASPHALT_OVERRIDE_KEY, DEV_VOTE_OWN_KEY } from '../constants/dev';

// Local, per-user AsyncStorage state that must NOT survive logout or account
// deletion: the home privacy zone, the walk-visibility setting, any queued
// (unsynced) walk history, and the dev overrides. Session tokens are cleared by
// supabase.auth.signOut(); this wipes the rest so the next account on this
// device starts clean and one user's settings never leak to another.
export async function clearLocalUserData(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([
      ...HOME_ZONE_KEYS,
      'privacy_visibility', // walk visibility (SettingsScreen/WalkScreen/DevPanel)
      PENDING_KEY,
      DEV_ASPHALT_OVERRIDE_KEY,
      DEV_VOTE_OWN_KEY,
    ]);
  } catch (e) {
    console.warn('[localReset] clearLocalUserData failed:', e);
  }
}
