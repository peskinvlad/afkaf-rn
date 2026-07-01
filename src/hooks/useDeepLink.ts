import { useCallback, useEffect, useState } from 'react';
import * as Linking from 'expo-linking';

export interface UseDeepLinkResult {
  pendingFriendId: string | null;
  clearPendingFriend: () => void;
}

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
  return segments[idx + 1];
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
