import { supabase } from './supabase';

// profiles/dogs are owner-only under RLS, so a client can't read other users'
// display_name or dog for the friends list / nearby cards. get_user_previews
// is a SECURITY DEFINER RPC that returns previews ONLY for users the caller is
// already connected to (a friendships row in any status) or who has an
// active_walk visible to the caller. See supabase/functions/get_user_previews.sql.
export interface UserPreview {
  id: string;
  display_name: string | null;
  dog_name: string | null;
  dog_avatar: string | null;
}

// Batched lookup → map keyed by user id. Missing ids (not connected) are simply
// absent from the map; callers fall back to an anonymous label.
export async function fetchUserPreviews(ids: string[]): Promise<Record<string, UserPreview>> {
  if (ids.length === 0) return {};
  const { data, error } = await supabase.rpc('get_user_previews', { ids });
  if (error) {
    console.warn('[userPreviews] get_user_previews error:', error.message);
    return {};
  }
  const map: Record<string, UserPreview> = {};
  for (const row of (data ?? []) as UserPreview[]) map[row.id] = row;
  return map;
}
