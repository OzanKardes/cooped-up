import { supabase } from '../lib/supabase';
import { Friendship, User } from '../types';
import { showToast } from '../components/Toast';

export async function getFriends(userId: string): Promise<User[]> {
  try {
    // Fetch both directions: user → friend and friend → user
    const { data, error } = await supabase
      .from('friendships')
      .select('friend_id, friend:users!friendships_friend_id_fkey(*)')
      .eq('user_id', userId)
      .eq('status', 'accepted');
    if (error) throw error;
    return ((data ?? []) as any[]).map(r => r.friend).filter(Boolean) as User[];
  } catch {
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
  } catch {
    return [];
  }
}

export async function sendFriendRequest(userId: string, friendId: string) {
  try {
    const { error } = await supabase
      .from('friendships')
      .insert({ user_id: userId, friend_id: friendId, status: 'pending' });
    if (error) throw error;
  } catch (err: any) {
    showToast('Connection error — check your internet');
    throw err;
  }
}

export async function acceptFriendRequest(friendshipId: string) {
  try {
    const { error } = await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', friendshipId);
    if (error) throw error;
  } catch (err: any) {
    showToast('Connection error — check your internet');
    throw err;
  }
}

export async function searchUsers(query: string): Promise<User[]> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
      .limit(20);
    if (error) throw error;
    return (data ?? []) as User[];
  } catch {
    return [];
  }
}

export async function declineFriendRequest(friendshipId: string) {
  try {
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId);
    if (error) throw error;
  } catch {
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
  } catch {
    return [];
  }
}

export async function getOnlineFriends(userId: string): Promise<User[]> {
  try {
    const { data, error } = await supabase
      .from('friendships')
      .select('friend:users!friendships_friend_id_fkey(*)')
      .eq('user_id', userId)
      .eq('status', 'accepted');
    if (error) throw error;
    return ((data ?? []) as any[])
      .map(r => r.friend)
      .filter((f: User) => f?.is_online) as User[];
  } catch {
    return [];
  }
}
