import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const STORAGE_KEY = 'has_completed_tour';

// Returns true if the tour has already been completed (check local first, then DB)
export async function checkTourCompleted(): Promise<boolean> {
  try {
    const local = await AsyncStorage.getItem(STORAGE_KEY);
    if (local === 'true') return true;
  } catch {}
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return true;
    const { data } = await supabase
      .from('users')
      .select('has_completed_tour')
      .eq('id', session.user.id)
      .single();
    return data?.has_completed_tour === true;
  } catch {
    return true; // On error, skip tour to avoid frustrating the user
  }
}

export async function markTourComplete(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, 'true');
    await supabase.from('users').update({ has_completed_tour: true }).eq('id', userId);
  } catch {}
}

export async function resetTourForUser(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
    await supabase.from('users').update({ has_completed_tour: false }).eq('id', userId);
  } catch {}
}
