import { supabase } from './supabase';

// Friendship request actions shared by FriendsScreen and NotificationsScreen.
// Each returns an error message, or null on success — callers decide how loud
// to be about failures.

// RLS: only the addressee may update status (friendships_update policy).
export async function acceptRequest(friendshipId: string): Promise<string | null> {
  const { error } = await supabase
    .from('friendships')
    .update({ status: 'accepted' })
    .eq('id', friendshipId);
  return error?.message ?? null;
}

// Decline DELETEs the row instead of setting status='declined': a declined
// row lives forever, and UNIQUE(requester_id, addressee_id) would then block
// the requester from ever asking again. Deleting returns that right.
// RLS: friendships_delete allows either side to delete.
export async function declineRequest(friendshipId: string): Promise<string | null> {
  const { error } = await supabase
    .from('friendships')
    .delete()
    .eq('id', friendshipId);
  return error?.message ?? null;
}

// Removing an accepted friend / revoking an outgoing request is the same
// row delete as declining.
export const removeFriendship = declineRequest;

// Send a fresh request to a user we discovered elsewhere (e.g. the nearby
// list) — same insert AddFriendSheet does, but keyed by an addressee we
// already hold. RLS friendships_insert requires requester_id = auth.uid().
// Returns an error message, or null on success.
export async function sendFriendRequest(addresseeId: string): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 'not_authenticated';
  const { error } = await supabase
    .from('friendships')
    .insert({ requester_id: user.id, addressee_id: addresseeId, status: 'pending' });
  return error?.message ?? null;
}
