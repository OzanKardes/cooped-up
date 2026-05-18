import { supabase } from '../lib/supabase';
import { Plan } from '../types';
import { showToast } from '../components/Toast';

export async function getMyPlans(userId: string): Promise<Plan[]> {
  try {
    // Plans created by the user
    const { data: created, error: e1 } = await supabase
      .from('plans')
      .select('*, creator:users!plans_creator_id_fkey(*)')
      .eq('creator_id', userId)
      .order('time', { ascending: true });
    if (e1) throw e1;

    // Plans the user joined as attendee
    const { data: attended, error: e2 } = await supabase
      .from('plan_attendees')
      .select('plan_id')
      .eq('user_id', userId);
    if (e2) throw e2;

    const attendedIds = (attended ?? []).map((r: any) => r.plan_id);
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
  } catch {
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
  } catch {
    return [];
  }
}

export async function getPlansForToday(userId: string): Promise<Plan[]> {
  try {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();

    const { data, error } = await supabase
      .from('plans')
      .select('*, creator:users!plans_creator_id_fkey(*)')
      .eq('creator_id', userId)
      .gte('time', start)
      .lte('time', end)
      .order('time', { ascending: true });
    if (error) throw error;
    return (data ?? []) as Plan[];
  } catch {
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
  },
  inviteeIds: string[] = []
): Promise<Plan> {
  const { data, error } = await supabase
    .from('plans')
    .insert(planData)
    .select('*, creator:users!plans_creator_id_fkey(*)')
    .single();
  if (error) {
    showToast('Connection error — check your internet');
    throw error;
  }
  const plan = data as Plan;

  if (inviteeIds.length > 0) {
    await supabase.from('plan_invites').insert(
      inviteeIds.map(id => ({ plan_id: plan.id, invitee_id: id }))
    );
  }

  return plan;
}

export async function joinPlan(planId: string, userId: string) {
  try {
    const { error } = await supabase
      .from('plan_attendees')
      .insert({ plan_id: planId, user_id: userId });
    if (error) throw error;
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
  } catch (err: any) {
    showToast('Connection error — check your internet');
    throw err;
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
