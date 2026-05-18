import { supabase } from '../lib/supabase';
import { Message } from '../types';
import { showToast } from '../components/Toast';

export async function getDMs(userId: string): Promise<Message[]> {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*, sender:users!messages_sender_id_fkey(*)')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .is('group_id', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as Message[];
  } catch {
    showToast('Connection error — check your internet');
    return [];
  }
}

export async function getMessages(userId: string, friendId: string): Promise<Message[]> {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*, sender:users!messages_sender_id_fkey(*)')
      .or(
        `and(sender_id.eq.${userId},receiver_id.eq.${friendId}),` +
        `and(sender_id.eq.${friendId},receiver_id.eq.${userId})`
      )
      .is('group_id', null)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []) as Message[];
  } catch {
    return [];
  }
}

export async function sendMessage(senderId: string, receiverId: string, content: string) {
  try {
    const { error } = await supabase.from('messages').insert({
      sender_id: senderId,
      receiver_id: receiverId,
      content,
      type: 'text',
    });
    if (error) throw error;
  } catch (err: any) {
    showToast('Connection error — check your internet');
    throw err;
  }
}

export async function getGroupMessages(groupId: string): Promise<Message[]> {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*, sender:users!messages_sender_id_fkey(*)')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []) as Message[];
  } catch {
    return [];
  }
}

export async function sendGroupMessage(senderId: string, groupId: string, content: string) {
  try {
    const { error } = await supabase.from('messages').insert({
      sender_id: senderId,
      group_id: groupId,
      content,
      type: 'text',
    });
    if (error) throw error;
  } catch (err: any) {
    showToast('Connection error — check your internet');
    throw err;
  }
}

// Returns an unsubscribe function — call it on component unmount
export function subscribeToMessages(
  userId: string,
  callback: (message: Message) => void
): () => void {
  const channel = supabase
    .channel(`dm_inbox_${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `receiver_id=eq.${userId}`,
      },
      payload => callback(payload.new as Message)
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}

export function subscribeToGroupMessages(
  groupId: string,
  callback: (message: Message) => void
): () => void {
  const channel = supabase
    .channel(`group_${groupId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `group_id=eq.${groupId}`,
      },
      payload => callback(payload.new as Message)
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}
