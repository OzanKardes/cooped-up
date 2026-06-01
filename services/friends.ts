import { supabase } from '../lib/supabase';
import { Friendship, User } from '../types';
import { showToast } from '../components/Toast';
import { checkAndUnlockBadges } from './badges';

export async function getFriends(userId: string): Promise<User[]> {
  try {
    // Query both directions so old single-row friendships are included
    const [outgoing, incoming] = await Promise.all([
      supabase
        .from('friendships')
        .select('friend:users!friendships_friend_id_fkey(*)')
        .eq('user_id', userId)
        .eq('status', 'accepted'),
      supabase
        .from('friendships')
        .select('user:users!friendships_user_id_fkey(*)')
        .eq('friend_id', userId)
        .eq('status', 'accepted'),
    ]);

    const seen = new Set<string>();
    const friends: User[] = [];
    for (const r of (outgoing.data ?? []) as any[]) {
      if (r.friend && !seen.has(r.friend.id)) { seen.add(r.friend.id); friends.push(r.friend); }
    }
    for (const r of (incoming.data ?? []) as any[]) {
      if (r.user && !seen.has(r.user.id)) { seen.add(r.user.id); friends.push(r.user); }
    }
    return friends;
  } catch (err: any) {
    console.error('friends.getFriends error:', err);
    showToast('Connection error — check your internet');
    return [];
  }
}

export async function getFriendRequests(userId: string): Promise<Friendship[]> {
  try {
    const { data, error } = await supabase
      .from('friendships')
      .select('*, friend:users!friendships_user_id_fkey(*)')
      .eq('friend_id', userId)
      .eq('status', 'pending');
    if (error) throw error;
    return (data ?? []) as Friendship[];
  } catch (err: any) {
    console.error('friends.getFriendRequests error:', err);
    return [];
  }
}

export async function sendFriendRequest(userId: string, friendId: string) {
  // Check for any existing friendship in either direction before inserting
  const { data: existing } = await supabase
    .from('friendships')
    .select('id, status')
    .or(
      `and(user_id.eq.${userId},friend_id.eq.${friendId}),` +
      `and(user_id.eq.${friendId},friend_id.eq.${userId})`
    )
    .limit(1)
    .maybeSingle();

  if (existing) {
    if (existing.status === 'accepted') {
      showToast('You\'re already friends!');
      return;
    }
    if (existing.status === 'pending') {
      showToast('Friend request already sent');
      return;
    }
  }

  const { error } = await supabase
    .from('friendships')
    .insert({ user_id: userId, friend_id: friendId, status: 'pending' });
  if (error) {
    console.error('[sendFriendRequest] insert failed:', error.message, error.code);
    showToast('Connection error — check your internet');
    throw error;
  }
}

export async function acceptFriendRequest(friendshipId: string) {
  try {
    // Fetch the row first so we know both user IDs
    const { data: row, error: fetchErr } = await supabase
      .from('friendships')
      .select('user_id, friend_id')
      .eq('id', friendshipId)
      .single();
    if (fetchErr) throw fetchErr;

    // Mark the original request accepted
    const { error } = await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', friendshipId);
    if (error) throw error;

    // Insert the reverse so the accepter also sees the friend in their list
    await supabase.from('friendships').insert({
      user_id:   row.friend_id,
      friend_id: row.user_id,
      status:    'accepted',
    });
    // Ignore duplicate-key errors — reverse may already exist

    // Check social badges for both sides (fire-and-forget — never blocks the accept)
    Promise.all([
      checkAndUnlockBadges(row.user_id),
      checkAndUnlockBadges(row.friend_id),
    ]).catch(() => {});
  } catch (err: any) {
    console.error('friends.acceptFriendRequest error:', err);
    showToast('Connection error — check your internet');
    throw err;
  }
}

export async function searchUsers(query: string, currentUserId?: string): Promise<User[]> {
  let q = supabase
    .from('users')
    .select('*')
    .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
    .limit(20);

  // Exclude the searcher from results at the DB level
  if (currentUserId) {
    q = q.neq('id', currentUserId);
  }

  const { data, error } = await q;
  if (error) {
    console.error('[searchUsers] query failed:', error.message, error.code);
    return [];
  }
  return (data ?? []) as User[];
}

export async function declineFriendRequest(friendshipId: string) {
  try {
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId);
    if (error) throw error;
  } catch (err: any) {
    console.error('friends.declineFriendRequest error:', err);
    // Silent — optimistic removal already done in UI
  }
}

export async function getSentFriendRequests(userId: string): Promise<Friendship[]> {
  try {
    const { data, error } = await supabase
      .from('friendships')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pending');
    if (error) throw error;
    return (data ?? []) as Friendship[];
  } catch (err: any) {
    console.error('friends.getSentFriendRequests error:', err);
    return [];
  }
}

export async function getOnlineFriends(userId: string): Promise<User[]> {
  try {
    const friends = await getFriends(userId);
    return friends.filter(f => f.is_online);
  } catch (err: any) {
    console.error('friends.getOnlineFriends error:', err);
    return [];
  }
}

// Realtime subscription — fires whenever a new friend request arrives for this user.
// Requires: alter publication supabase_realtime add table friendships;
export function subscribeToFriendRequests(
  userId: string,
  callback: (request: Friendship) => void
): () => void {
  const channel = supabase
    .channel(`friend_requests_${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'friendships',
        filter: `friend_id=eq.${userId}`,
      },
      async (payload) => {
        const row = payload.new as Friendship;
        if (row.status !== 'pending') return;
        // Fetch full sender profile so the UI can show name/initials
        const { data: sender } = await supabase
          .from('users')
          .select('*')
          .eq('id', row.user_id)
          .single();
        callback({ ...row, friend: sender as User } as Friendship);
      }
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
