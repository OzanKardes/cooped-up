import { supabase } from '../lib/supabase';
import { Plan, PendingInviteDisplay } from '../types';
import { showToast } from '../components/Toast';
import { checkAndUnlockBadges } from './badges';

export async function getMyPlans(userId: string): Promise<Plan[]> {
  try {
    // Plans created by the user
    const { data: created, error: e1 } = await supabase
      .from('plans')
      .select('*, creator:users!plans_creator_id_fkey(*)')
      .eq('creator_id', userId)
      .order('time', { ascending: true });
    if (e1) throw e1;

    // Only include attendee rows that correspond to an accepted invite (or a direct join
    // of a public plan). We cross-check by excluding plan IDs where the user still has
    // a pending invite — plan_attendees should only ever contain accepted users, but this
    // guard catches any edge case where that invariant was broken.
    const [attendedRes, pendingInviteRes] = await Promise.all([
      supabase.from('plan_attendees').select('plan_id').eq('user_id', userId),
      supabase.from('plan_invites').select('plan_id').eq('invitee_id', userId).eq('status', 'pending'),
    ]);
    if (attendedRes.error) throw attendedRes.error;

    const pendingPlanIds = new Set((pendingInviteRes.data ?? []).map((r: any) => r.plan_id));
    const attendedIds = (attendedRes.data ?? [])
      .map((r: any) => r.plan_id)
      .filter((id: string) => !pendingPlanIds.has(id));

    let joinedPlans: Plan[] = [];
    if (attendedIds.length > 0) {
      const { data: jp, error: e3 } = await supabase
        .from('plans')
        .select('*, creator:users!plans_creator_id_fkey(*)')
        .in('id', attendedIds)
        .order('time', { ascending: true });
      if (e3) throw e3;
      joinedPlans = (jp ?? []) as Plan[];
    }

    // Merge and deduplicate
    const all = [...(created ?? []), ...joinedPlans] as Plan[];
    const seen = new Set<string>();
    return all.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });
  } catch (err: any) {
    console.error('plans.getMyPlans error:', err);
    showToast('Connection error — check your internet');
    return [];
  }
}

export async function getPublicPlans(): Promise<Plan[]> {
  try {
    const { data, error } = await supabase
      .from('plans')
      .select('*, creator:users!plans_creator_id_fkey(*)')
      .eq('visibility', 'public')
      .order('time', { ascending: true });
    if (error) throw error;
    return (data ?? []) as Plan[];
  } catch (err: any) {
    console.error('plans.getPublicPlans error:', err);
    return [];
  }
}

export async function getPlansForToday(userId: string): Promise<Plan[]> {
  try {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();

    const { data: created, error: e1 } = await supabase
      .from('plans')
      .select('*, creator:users!plans_creator_id_fkey(*)')
      .eq('creator_id', userId)
      .gte('time', start)
      .lte('time', end)
      .order('time', { ascending: true });
    if (e1) throw e1;

    // Only include attendee rows for accepted invites — exclude any plan where the
    // user still has a pending invite (belt-and-suspenders guard).
    const [attendedRes, pendingInviteRes] = await Promise.all([
      supabase.from('plan_attendees').select('plan_id').eq('user_id', userId),
      supabase.from('plan_invites').select('plan_id').eq('invitee_id', userId).eq('status', 'pending'),
    ]);
    if (attendedRes.error) throw attendedRes.error;

    const pendingPlanIds = new Set((pendingInviteRes.data ?? []).map((r: any) => r.plan_id));
    const attendedIds = (attendedRes.data ?? [])
      .map((r: any) => r.plan_id)
      .filter((id: string) => !pendingPlanIds.has(id));

    let joinedPlans: Plan[] = [];
    if (attendedIds.length > 0) {
      const { data: jp, error: e3 } = await supabase
        .from('plans')
        .select('*, creator:users!plans_creator_id_fkey(*)')
        .in('id', attendedIds)
        .gte('time', start)
        .lte('time', end)
        .order('time', { ascending: true });
      if (e3) throw e3;
      joinedPlans = (jp ?? []) as Plan[];
    }

    const all = [...(created ?? []), ...joinedPlans] as Plan[];
    const seen = new Set<string>();
    return all.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });
  } catch (err: any) {
    console.error('plans.getPlansForToday error:', err);
    return [];
  }
}

export async function createPlan(
  planData: {
    creator_id: string;
    title: string;
    location: string;
    time: string;
    visibility: 'public' | 'friends' | 'invite';
    weather_snapshot?: object;
    groupEndTime?: string; // when the linked group chat should auto-expire
  },
  inviteeIds: string[] = []
): Promise<{ plan: Plan; groupId: string }> {
  // Strip UI-only field before inserting into plans table
  const { groupEndTime, ...planInsert } = planData;

  const { data, error } = await supabase
    .from('plans')
    .insert(planInsert)
    .select('*, creator:users!plans_creator_id_fkey(*)')
    .single();
  if (error) {
    showToast('Connection error — check your internet');
    throw error;
  }
  const plan = data as Plan;

  // Add creator as first attendee
  try { await supabase.from('plan_attendees').insert({ plan_id: plan.id, user_id: planData.creator_id }); } catch { /* ignore duplicate */ }

  // Send invites
  if (inviteeIds.length > 0) {
    await supabase.from('plan_invites').insert(
      inviteeIds.map(id => ({ plan_id: plan.id, invitee_id: id }))
    );
  }

  // Create group chat — everyone (creator + invitees) is in it immediately
  let groupId = '';
  try {
    const groupInsert: Record<string, any> = {
      name: plan.title,
      plan_id: plan.id,
      created_by: planData.creator_id,
    };
    if (groupEndTime) groupInsert.plan_end_time = groupEndTime;

    const { data: groupData, error: ge } = await supabase
      .from('chat_groups')
      .insert(groupInsert)
      .select('id')
      .single();
    if (ge) throw ge;

    groupId = groupData.id as string;

    const allMemberIds = [...new Set([planData.creator_id, ...inviteeIds])];
    const { error: mme } = await supabase.from('group_members').insert(
      allMemberIds.map(uid => ({ group_id: groupId, user_id: uid }))
    );
    if (mme) console.warn('[createPlan] group_members insert:', mme.message);
  } catch (e: any) {
    console.warn('[createPlan] group chat creation failed:', e?.message ?? e);
  }

  // Badge check (fire-and-forget)
  const planHour = new Date(planData.time).getHours();
  checkAndUnlockBadges(planData.creator_id, { planHour }).catch(() => {});

  return { plan, groupId };
}

export async function joinPlan(planId: string, userId: string) {
  try {
    const { error } = await supabase
      .from('plan_attendees')
      .insert({ plan_id: planId, user_id: userId });
    if (error) throw error;
    checkAndUnlockBadges(userId).catch(() => {});
  } catch (err: any) {
    showToast('Connection error — check your internet');
    throw err;
  }
}

export async function leavePlan(planId: string, userId: string) {
  try {
    const { error } = await supabase
      .from('plan_attendees')
      .delete()
      .eq('plan_id', planId)
      .eq('user_id', userId);
    if (error) throw error;

    // Remove user from the plan's group chat
    const { data: groupRow } = await supabase
      .from('chat_groups')
      .select('id')
      .eq('plan_id', planId)
      .limit(1)
      .maybeSingle();
    if (groupRow?.id) {
      const { error: gme } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupRow.id)
        .eq('user_id', userId);
      if (gme) console.error('plans.leavePlan group_members removal error:', gme);
    }
  } catch (err: any) {
    console.error('plans.leavePlan error:', err);
    showToast('Connection error — check your internet');
    throw err;
  }
}

export async function getPendingInvites(userId: string): Promise<PendingInviteDisplay[]> {
  try {
    const { data, error } = await supabase
      .from('plan_invites')
      .select('id, plan_id, plan:plans!plan_invites_plan_id_fkey(*, creator:users!plans_creator_id_fkey(*))')
      .eq('invitee_id', userId)
      .eq('status', 'pending');
    if (error) throw error;
    return (data ?? []).map((row: any) => ({
      inviteId: row.id,
      planId: row.plan_id,
      title: row.plan?.title ?? '',
      location: row.plan?.location ?? '',
      time: row.plan?.time ?? '',
      weather: row.plan?.weather_snapshot ?? null,
      creatorName: row.plan?.creator?.full_name ?? 'Someone',
    }));
  } catch (err: any) {
    console.error('plans.getPendingInvites error:', err);
    showToast('Connection error — check your internet');
    return [];
  }
}

export function subscribeToPlanInvites(
  userId: string,
  callback: (invite: PendingInviteDisplay) => void
): () => void {
  const channel = supabase
    .channel(`plan_invites_${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'plan_invites',
        filter: `invitee_id=eq.${userId}`,
      },
      async (payload) => {
        const row = payload.new as { id: string; plan_id: string; invitee_id: string; status: string };
        const { data: planData } = await supabase
          .from('plans')
          .select('*, creator:users!plans_creator_id_fkey(*)')
          .eq('id', row.plan_id)
          .single();
        if (!planData) return;
        callback({
          inviteId: row.id,
          planId: row.plan_id,
          title: (planData as any).title,
          location: (planData as any).location,
          time: (planData as any).time,
          weather: (planData as any).weather_snapshot ?? null,
          creatorName: (planData as any).creator?.full_name ?? 'Someone',
        });
      }
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

export async function acceptPlanInvite(inviteId: string, planId: string, userId: string): Promise<void> {
  try {
    // 1. Mark invite accepted
    const { error: e1 } = await supabase
      .from('plan_invites')
      .update({ status: 'accepted' })
      .eq('id', inviteId);
    if (e1) throw e1;

    // 2. Add to plan attendees
    const { error: e2 } = await supabase
      .from('plan_attendees')
      .insert({ plan_id: planId, user_id: userId });
    if (e2 && e2.code !== '23505') throw e2;

    // 3 & 4. Find the plan's group chat and ensure user is a member
    const { data: groupRow } = await supabase
      .from('chat_groups')
      .select('id')
      .eq('plan_id', planId)
      .limit(1)
      .single();
    if (groupRow?.id) {
      const { error: gme } = await supabase
        .from('group_members')
        .insert({ group_id: groupRow.id, user_id: userId });
      if (gme && gme.code !== '23505') throw gme;
    }

    showToast('Plan accepted! 🎉');
    checkAndUnlockBadges(userId).catch(() => {});
  } catch (err: any) {
    console.error('plans.acceptPlanInvite error:', err);
    showToast('Connection error — check your internet');
    throw new Error('Accept failed');
  }
}

export async function declinePlanInvite(inviteId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('plan_invites')
      .update({ status: 'declined' })
      .eq('id', inviteId);
    if (error) throw error;
    showToast('Invite declined');
  } catch (err: any) {
    console.error('plans.declinePlanInvite error:', err);
    showToast('Connection error — check your internet');
    throw new Error('Decline failed');
  }
}

export async function updatePlan(
  planId: string,
  updates: { title?: string; location?: string; time?: string; custom_title?: string }
): Promise<void> {
  const { error } = await supabase.from('plans').update(updates).eq('id', planId);
  if (error) {
    console.error('plans.updatePlan error:', error);
    showToast('Connection error — check your internet');
    throw error;
  }
  // Keep the linked group chat name in sync when the plan title changes
  if (updates.title) {
    const { error: ge } = await supabase
      .from('chat_groups')
      .update({ name: updates.title })
      .eq('plan_id', planId);
    if (ge) console.error('plans.updatePlan group name sync error:', ge);
  }
}

export async function deletePlan(planId: string): Promise<void> {
  // Delete cascade order: group_members → chat_groups → plan_invites → plan_attendees → plan
  // If FK cascades are set up in DB these manual deletes are redundant but safe
  try {
    const { data: groups } = await supabase
      .from('chat_groups')
      .select('id')
      .eq('plan_id', planId);

    if (groups?.length) {
      const groupId = groups[0].id;
      await supabase.from('group_members').delete().eq('group_id', groupId);
      await supabase.from('messages').delete().eq('group_id', groupId);
      await supabase.from('chat_groups').delete().eq('id', groupId);
    }

    await supabase.from('plan_invites').delete().eq('plan_id', planId);
    await supabase.from('plan_attendees').delete().eq('plan_id', planId);

    const { error } = await supabase.from('plans').delete().eq('id', planId);
    if (error) {
      console.error('plans.deletePlan error:', error);
      showToast('Connection error — check your internet');
      throw error;
    }
  } catch (err: any) {
    console.error('plans.deletePlan error:', err);
    showToast('Connection error — check your internet');
    throw err;
  }
}

export async function cancelPlan(planId: string): Promise<void> {
  const { error } = await supabase.from('plans').update({ status: 'cancelled' }).eq('id', planId);
  if (error) {
    console.error('plans.cancelPlan error:', error);
    showToast('Connection error — check your internet');
    throw error;
  }
}

// Fires callback when the current user is added to any plan (as attendee) or creates a plan.
// Returns an unsubscribe function.
export function subscribeToTodayPlans(
  userId: string,
  callback: () => void
): () => void {
  const ch1 = supabase
    .channel(`plan_attendees_user_${userId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'plan_attendees', filter: `user_id=eq.${userId}` },
      () => callback()
    )
    .subscribe();

  const ch2 = supabase
    .channel(`plans_creator_${userId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'plans', filter: `creator_id=eq.${userId}` },
      () => callback()
    )
    .subscribe();

  return () => {
    supabase.removeChannel(ch1);
    supabase.removeChannel(ch2);
  };
}

export async function getPlanById(planId: string): Promise<Plan | null> {
  try {
    const { data, error } = await supabase
      .from('plans')
      .select('*, creator:users!plans_creator_id_fkey(*)')
      .eq('id', planId)
      .single();
    if (error || !data) return null;
    return data as Plan;
  } catch (err: any) {
    console.error('plans.getPlanById error:', err);
    return null;
  }
}

export async function inviteMoreToPlan(planId: string, inviteeIds: string[]): Promise<void> {
  if (!inviteeIds.length) return;
  const { error } = await supabase.from('plan_invites').insert(
    inviteeIds.map(id => ({ plan_id: planId, invitee_id: id }))
  );
  if (error && error.code !== '23505') {
    console.error('plans.inviteMoreToPlan error:', error);
    showToast('Connection error — check your internet');
    throw error;
  }
}

// Helper: format a Plan from DB into display-friendly shape
export function formatPlanTime(isoTime: string): string {
  const d = new Date(isoTime);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();

  const timeStr = d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true });
  if (isToday)    return `Today, ${timeStr}`;
  if (isTomorrow) return `Tomorrow, ${timeStr}`;
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) + `, ${timeStr}`;
}
