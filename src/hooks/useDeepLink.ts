import { useCallback, useEffect, useState } from 'react';
import * as Linking from 'expo-linking';

export interface UseDeepLinkResult {
  pendingFriendId: string | null;
  clearPendingFriend: () => void;
}

// Standard 8-4-4-4-12 hex UUID shape (any version). Validated before the id
// ever reaches a query so malformed/garbage deep links are dropped silently
// instead of hitting the database.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Handles both the standalone/dev-client form (afkaf://add-friend/USER_ID)
// and the Expo Go form (exp://host/--/add-friend/USER_ID) — expo-linking's
// parse() normalizes the "--/" redirect prefix for us either way.
function extractFriendId(url: string): string | null {
  const { hostname, path } = Linking.parse(url);
  const segments = [hostname, ...(path ? path.split('/') : [])].filter(
    (s): s is string => !!s
  );
  const idx = segments.indexOf('add-friend');
  if (idx === -1 || !segments[idx + 1]) return null;
  const candidate = segments[idx + 1];
  return UUID_RE.test(candidate) ? candidate : null;
}

export function useDeepLink(): UseDeepLinkResult {
  const [pendingFriendId, setPendingFriendId] = useState<string | null>(null);

  const handleUrl = useCallback((url: string | null) => {
    if (!url) return;
    const friendId = extractFriendId(url);
    if (friendId) setPendingFriendId(friendId);
  }, []);

  useEffect(() => {
    Linking.getInitialURL().then(handleUrl);
    const subscription = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => subscription.remove();
  }, [handleUrl]);

  const clearPendingFriend = useCallback(() => setPendingFriendId(null), []);

  return { pendingFriendId, clearPendingFriend };
}
