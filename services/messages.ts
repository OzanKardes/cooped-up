import { supabase } from '../lib/supabase';
import { Message } from '../types';
import { showToast } from '../components/Toast';
import { readAsStringAsync, EncodingType } from 'expo-file-system/legacy';

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
  } catch (err: any) {
    console.error('messages.getDMs error:', err);
    showToast('Connection error — check your internet');
    return [];
  }
}

export async function getMessages(userId: string, friendId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*, sender:users!messages_sender_id_fkey(*)')
    .or(
      `and(sender_id.eq.${userId},receiver_id.eq.${friendId}),` +
      `and(sender_id.eq.${friendId},receiver_id.eq.${userId})`
    )
    .is('group_id', null)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('[getMessages] query failed:', error.message, error.details);
    return [];
  }
  return (data ?? []) as Message[];
}

export async function sendMessage(
  senderId: string,
  receiverId: string,
  content: string,
  type: 'text' | 'location' | 'image' = 'text',
): Promise<{ data: Message | null; error: any }> {
  const { data, error } = await supabase
    .from('messages')
    .insert({ sender_id: senderId, receiver_id: receiverId, content, type })
    .select('*, sender:users!messages_sender_id_fkey(*)')
    .single();
  if (error) {
    console.error('[sendMessage] insert failed:', error.message, '|', error.details, '|', error.hint, '| code:', error.code);
  }
  return { data: data as Message | null, error };
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
  } catch (err: any) {
    console.error('messages.getGroupMessages error:', err);
    return [];
  }
}

export async function sendGroupMessage(
  senderId: string,
  groupId: string,
  content: string,
  type: 'text' | 'location' | 'image' = 'text',
): Promise<{ data: Message | null; error: any }> {
  const { data, error } = await supabase
    .from('messages')
    .insert({ sender_id: senderId, group_id: groupId, content, type })
    .select('*, sender:users!messages_sender_id_fkey(*)')
    .single();
  if (error) {
    console.error('[sendGroupMessage] insert failed:', error.message, '|', error.details, '|', error.hint, '| code:', error.code);
  }
  return { data: data as Message | null, error };
}

// Badge-level subscription — separate channel so it coexists with ChatThread's subscription
export function subscribeToIncomingDMs(
  userId: string,
  callback: (message: Message) => void
): () => void {
  const channel = supabase
    .channel(`dm_badge_${userId}`)
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

// Returns an unsubscribe function — call it on component unmount.
// Subscribes to both receiver_id (incoming) and sender_id (outgoing confirmation)
// so all persisted messages for this user are covered.
export function subscribeToMessages(
  userId: string,
  callback: (message: Message) => void
): () => void {
  // Incoming: messages sent TO this user
  const chRecv = supabase
    .channel(`dm_recv_${userId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${userId}` },
      payload => callback(payload.new as Message)
    )
    .subscribe();

  // Outgoing confirmation: messages sent BY this user (confirms they persisted)
  const chSent = supabase
    .channel(`dm_sent_${userId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `sender_id=eq.${userId}` },
      payload => callback(payload.new as Message)
    )
    .subscribe();

  return () => {
    supabase.removeChannel(chRecv);
    supabase.removeChannel(chSent);
  };
}

export async function createChatGroup(
  name: string,
  creatorId: string,
  memberIds: string[],
  planId?: string,
  planEndTime?: string,
): Promise<string> {
  try {
    const insert: any = { name, created_by: creatorId };
    if (planId) insert.plan_id = planId;
    if (planEndTime) insert.plan_end_time = planEndTime;
    const { data, error } = await supabase
      .from('chat_groups')
      .insert(insert)
      .select()
      .single();
    if (error) throw error;
    const members = [creatorId, ...memberIds.filter(id => id !== creatorId)].map(uid => ({
      group_id: data.id,
      user_id: uid,
    }));
    await supabase.from('group_members').insert(members);
    return data.id as string;
  } catch (err: any) {
    console.error('messages.createChatGroup error:', err);
    throw err;
  }
}

export async function getGroupsForUser(userId: string): Promise<{
  id: string; name: string; lastMsg: string; lastTime: string;
  memberCount: number; memberInitials: string[];
  planId?: string | null; planCreatorId?: string | null;
}[]> {
  try {
    const { data: memberships, error: me } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', userId);
    if (me || !memberships?.length) return [];

    const groupIds = memberships.map((m: any) => m.group_id);

    const { data: groups, error: ge } = await supabase
      .from('chat_groups')
      .select('id, name, created_at, plan_id, plan_end_time, plan:plans!chat_groups_plan_id_fkey(creator_id)')
      .in('id', groupIds);
    if (ge) throw ge;

    const now = new Date();
    const activeGroups = (groups ?? []).filter((g: any) => {
      if (!g.plan_end_time) return true;
      return new Date(g.plan_end_time) > now;
    });

    const results = await Promise.all(activeGroups.map(async (g: any) => {
      const [{ data: msgs }, { data: members }] = await Promise.all([
        supabase.from('messages').select('content, created_at').eq('group_id', g.id).order('created_at', { ascending: false }).limit(1),
        supabase.from('group_members').select('user:users!group_members_user_id_fkey(avatar_initials, full_name)').eq('group_id', g.id).limit(4),
      ]);
      const initials = (members ?? []).map((m: any) => {
        const u = m.user;
        return u?.avatar_initials ??
          u?.full_name?.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() ?? '?';
      });
      return {
        id: g.id,
        name: g.name,
        lastMsg: msgs?.[0]?.content ?? 'No messages yet',
        lastTime: msgs?.[0]?.created_at ?? g.created_at,
        memberCount: members?.length ?? 0,
        memberInitials: initials,
        planId: g.plan_id ?? null,
        planCreatorId: (g as any).plan?.creator_id ?? null,
      };
    }));

    return results;
  } catch (err: any) {
    console.error('messages.getGroupsForUser error:', err);
    return [];
  }
}

export async function getGroupChatForPlan(planId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('chat_groups')
      .select('id')
      .eq('plan_id', planId)
      .limit(1)
      .single();
    if (error || !data) return null;
    return data.id as string;
  } catch {
    return null;
  }
}

export async function sendSystemMessage(groupId: string, senderId: string, content: string): Promise<void> {
  const { error } = await supabase.from('messages').insert({
    sender_id: senderId,
    group_id: groupId,
    content,
    type: 'text',
  });
  if (error) throw error;
}

export async function leaveGroup(groupId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId);
  if (error) {
    console.error('messages.leaveGroup error:', error);
    showToast('Connection error — check your internet');
    throw error;
  }
}

export async function addMembersToGroup(groupId: string, userIds: string[]): Promise<void> {
  if (!userIds.length) return;
  const { error } = await supabase.from('group_members').insert(
    userIds.map(uid => ({ group_id: groupId, user_id: uid }))
  );
  if (error && error.code !== '23505') {
    console.error('messages.addMembersToGroup error:', error);
    showToast('Connection error — check your internet');
    throw error;
  }
}

// Fires when the current user is added to any group — caller should refetch group list
export function subscribeToGroupMemberships(
  userId: string,
  callback: () => void
): () => void {
  const channel = supabase
    .channel(`group_memberships_${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'group_members',
        filter: `user_id=eq.${userId}`,
      },
      () => callback()
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

export async function getGroupMembers(groupId: string): Promise<{
  id: string; name: string; initials: string; avatarUrl?: string | null;
}[]> {
  try {
    const { data, error } = await supabase
      .from('group_members')
      .select('user:users!group_members_user_id_fkey(id, full_name, avatar_initials, avatar_url)')
      .eq('group_id', groupId);
    if (error || !data) return [];
    return (data as any[]).map(row => {
      const u = row.user;
      const initials = u?.avatar_initials ??
        u?.full_name?.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() ?? '??';
      return { id: u?.id ?? '', name: u?.full_name ?? 'Member', initials, avatarUrl: u?.avatar_url ?? null };
    });
  } catch (err: any) {
    console.error('messages.getGroupMembers error:', err);
    return [];
  }
}

export async function getMessagesCount(userId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);
    if (error) throw error;
    return count ?? 0;
  } catch (err: any) {
    console.error('messages.getMessagesCount error:', err);
    return 0;
  }
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

// ─── Reactions ────────────────────────────────────────────────────────────────

export async function addReaction(messageId: string, userId: string, emoji: string): Promise<void> {
  try {
    const { error } = await (supabase.from('message_reactions') as any)
      .upsert({ message_id: messageId, user_id: userId, emoji }, { onConflict: 'message_id,user_id,emoji', ignoreDuplicates: true });
    if (error) throw error;
  } catch (err: any) {
    console.error('messages.addReaction error:', err);
    throw err;
  }
}

export async function removeReaction(messageId: string, userId: string, emoji: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('message_reactions')
      .delete()
      .eq('message_id', messageId)
      .eq('user_id', userId)
      .eq('emoji', emoji);
    if (error) throw error;
  } catch (err: any) {
    console.error('messages.removeReaction error:', err);
    throw err;
  }
}

export async function getReactionsForMessages(messageIds: string[]): Promise<{
  messageId: string; emoji: string; count: number; userIds: string[];
}[]> {
  if (!messageIds.length) return [];
  try {
    const { data, error } = await supabase
      .from('message_reactions')
      .select('message_id, emoji, user_id')
      .in('message_id', messageIds);
    if (error) throw error;

    const grouped = new Map<string, { count: number; userIds: string[] }>();
    for (const row of (data ?? []) as any[]) {
      const key = `${row.message_id}::${row.emoji}`;
      const entry = grouped.get(key) ?? { count: 0, userIds: [] };
      entry.count++;
      entry.userIds.push(row.user_id);
      grouped.set(key, entry);
    }

    return [...grouped.entries()].map(([key, val]) => {
      const sep = key.indexOf('::');
      return { messageId: key.slice(0, sep), emoji: key.slice(sep + 2), count: val.count, userIds: val.userIds };
    });
  } catch (err: any) {
    console.error('messages.getReactionsForMessages error:', err);
    return [];
  }
}

export function subscribeToReactions(callback: () => void): () => void {
  const channel = supabase
    .channel('message_reactions_global')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_reactions' }, callback)
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'message_reactions' }, callback)
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

// ─── Image upload ─────────────────────────────────────────────────────────────

export async function uploadChatImage(threadId: string, uri: string): Promise<string> {
  const key = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const path = `${threadId}/${key}.jpg`;

  const base64 = await readAsStringAsync(uri, { encoding: EncodingType.Base64 });
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

  const { error } = await supabase.storage
    .from('chat-media')
    .upload(path, bytes, { upsert: false, contentType: 'image/jpeg' });
  if (error) {
    console.error('messages.uploadChatImage error:', error);
    throw error;
  }

  const { data } = supabase.storage.from('chat-media').getPublicUrl(path);
  return data.publicUrl;
}
