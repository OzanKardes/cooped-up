import { supabase } from '../lib/supabase';
import { User, Badge, UserBadge } from '../types';
import { showToast } from '../components/Toast';
import { readAsStringAsync, EncodingType } from 'expo-file-system/legacy';

export async function getUserProfile(userId: string): Promise<User | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) throw error;
    return data as User;
  } catch {
    showToast('Connection error — check your internet');
    return null;
  }
}

export async function uploadAvatar(userId: string, uri: string): Promise<string> {
  // Always upload as JPEG — simpler path, works for both camera and library
  const path = `${userId}/avatar.jpg`;

  // expo-file-system/legacy handles both file:// and content:// URIs reliably across iOS/Android
  const base64 = await readAsStringAsync(uri, { encoding: EncodingType.Base64 });

  // Decode base64 → Uint8Array for Supabase Storage
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, bytes, { upsert: true, contentType: 'image/jpeg' });
  if (error) throw error;

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  // Timestamp busts React Native Image cache so the new photo is always shown
  const publicUrl = `${data.publicUrl}?t=${Date.now()}`;
  await supabase.from('users').update({ avatar_url: publicUrl }).eq('id', userId);
  return publicUrl;
}

export async function updateProfile(userId: string, updates: Partial<Pick<User, 'full_name' | 'avatar_initials' | 'hours_outside' | 'degree' | 'year_of_study' | 'avatar_url'>>) {
  try {
    const { error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId);
    if (error) throw error;
  } catch (err: any) {
    showToast('Connection error — check your internet');
    throw err;
  }
}

export async function setOnlineStatus(userId: string, isOnline: boolean) {
  try {
    await supabase
      .from('users')
      .update({ is_online: isOnline })
      .eq('id', userId);
  } catch (err: any) {
    console.error('users.setOnlineStatus error:', err);
  }
}

export async function updateHoursOutside(userId: string, hours: number) {
  try {
    await supabase
      .from('users')
      .update({ hours_outside: hours })
      .eq('id', userId);
  } catch (err: any) {
    console.error('users.updateHoursOutside error:', err);
  }
}

export async function getPlanCount(userId: string): Promise<number> {
  try {
    const { count } = await supabase
      .from('plans')
      .select('id', { count: 'exact', head: true })
      .eq('creator_id', userId);
    return count ?? 0;
  } catch (err: any) {
    console.error('users.getPlanCount error:', err);
    return 0;
  }
}

export async function getFriendCount(userId: string): Promise<number> {
  try {
    const [out, inc] = await Promise.all([
      supabase.from('friendships').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'accepted'),
      supabase.from('friendships').select('id', { count: 'exact', head: true }).eq('friend_id', userId).eq('status', 'accepted'),
    ]);
    // Each bidirectional friendship has two rows — avoid double-counting by summing then halving
    return Math.round(((out.count ?? 0) + (inc.count ?? 0)) / 2);
  } catch (err: any) {
    console.error('users.getFriendCount error:', err);
    return 0;
  }
}

// ─── Badges / awards ───────────────────────────────────────────────────────

export async function getAllBadges(): Promise<Badge[]> {
  try {
    const { data, error } = await supabase
      .from('badges')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []) as Badge[];
  } catch (err: any) {
    console.error('users.getAllBadges error:', err);
    return [];
  }
}

export async function getUserBadges(userId: string): Promise<UserBadge[]> {
  try {
    const { data, error } = await supabase
      .from('user_badges')
      .select('*, badge:badges(*)')
      .eq('user_id', userId);
    if (error) throw error;
    return (data ?? []) as UserBadge[];
  } catch (err: any) {
    console.error('users.getUserBadges error:', err);
    return [];
  }
}

// ─── Space / "I'm Here" location ──────────────────────────────────────────────

export async function setUserLocation(userId: string, spaceId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('users')
      .update({ current_location: spaceId, location_updated_at: new Date().toISOString() })
      .eq('id', userId);
    if (error) throw error;
  } catch (err: any) {
    console.error('users.setUserLocation error:', err);
    throw err;
  }
}

export async function clearUserLocation(userId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('users')
      .update({ current_location: null, location_updated_at: null })
      .eq('id', userId);
    if (error) throw error;
  } catch (err: any) {
    console.error('users.clearUserLocation error:', err);
    throw err;
  }
}

export function subscribeToUserLocationChanges(
  callback: (userId: string, location: string | null, updatedAt: string | null) => void,
): () => void {
  const channel = supabase
    .channel('user_location_changes')
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'users' },
      (payload) => {
        const row = payload.new as any;
        callback(row.id, row.current_location ?? null, row.location_updated_at ?? null);
      },
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

export async function awardBadge(userId: string, badgeId: string) {
  try {
    const { error } = await (supabase
      .from('user_badges')
      .insert({ user_id: userId, badge_id: badgeId }) as any)
      .onConflict(['user_id', 'badge_id']);
    if (error) throw error;
    showToast('Badge awarded!');
  } catch (err: any) {
    console.error('users.awardBadge error:', err);
  }
}
