import { supabase } from '../lib/supabase';
import { User } from '../types';
import { showToast } from '../components/Toast';

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

export async function updateProfile(userId: string, updates: Partial<Pick<User, 'full_name' | 'avatar_initials' | 'hours_outside' | 'degree' | 'year_of_study'>>) {
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
  } catch {
    // Silent — presence is best-effort
  }
}

export async function updateHoursOutside(userId: string, hours: number) {
  try {
    await supabase
      .from('users')
      .update({ hours_outside: hours })
      .eq('id', userId);
  } catch {
    // Silent
  }
}

export async function getPlanCount(userId: string): Promise<number> {
  try {
    const { count } = await supabase
      .from('plans')
      .select('id', { count: 'exact', head: true })
      .eq('creator_id', userId);
    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function getFriendCount(userId: string): Promise<number> {
  try {
    const { count } = await supabase
      .from('friendships')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'accepted');
    return count ?? 0;
  } catch {
    return 0;
  }
}
