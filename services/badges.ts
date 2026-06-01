import { supabase } from '../lib/supabase';
import { notifyBadgeUnlocked } from '../lib/badgeQueue';

// ─── Types ────────────────────────────────────────────────────────────────────
export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface BadgeDef {
  id: string;
  name: string;
  desc: string;
  emoji: string;
  tier: BadgeTier;
  condition: string;
}

export interface UnlockedBadge {
  badgeId: string;
  unlockedAt: string;
}

// ─── Tier colours ─────────────────────────────────────────────────────────────
export const TIER_COLORS: Record<BadgeTier, { bg: string; text: string }> = {
  bronze:   { bg: '#CD7F32', text: '#FFFFFF' },
  silver:   { bg: '#C0C0C0', text: '#1B2A4A' },
  gold:     { bg: '#FFD700', text: '#1B2A4A' },
  platinum: { bg: '#E5E4E2', text: '#1B2A4A' },
};

export const TIER_LABELS: Record<BadgeTier, string> = {
  bronze:   'Bronze',
  silver:   'Silver',
  gold:     'Gold',
  platinum: 'Platinum',
};

// ─── 20 badge definitions ─────────────────────────────────────────────────────
export const ALL_BADGES: BadgeDef[] = [
  // Social (0–3)
  { id: 'first_friend',     name: 'First Steps',       emoji: '🤝', tier: 'bronze',   desc: 'Add your first friend',              condition: 'Add your first friend to unlock'      },
  { id: 'five_friends',     name: 'Social Butterfly',  emoji: '🦋', tier: 'silver',   desc: 'Add 5 friends',                      condition: 'Add 5 friends to unlock'              },
  { id: 'ten_friends',      name: 'Connected',          emoji: '🌐', tier: 'gold',     desc: 'Add 10 friends',                     condition: 'Add 10 friends to unlock'             },
  { id: 'twelve_friends',   name: 'Imperial Legend',   emoji: '👑', tier: 'platinum', desc: 'Add all 12 friends',                 condition: 'Add all 12 friends to unlock'         },
  // Plans (4–8)
  { id: 'first_plan',       name: 'Planner',            emoji: '📅', tier: 'bronze',   desc: 'Create your first plan',             condition: 'Create your first plan to unlock'     },
  { id: 'first_join',       name: 'Team Player',        emoji: '🤜', tier: 'bronze',   desc: 'Join your first plan',               condition: 'Join a plan to unlock'                },
  { id: 'five_plans',       name: 'Organiser',          emoji: '📋', tier: 'silver',   desc: 'Create 5 plans',                     condition: 'Create 5 plans to unlock'             },
  { id: 'ten_plans',        name: 'Social Director',    emoji: '🎬', tier: 'gold',     desc: 'Create 10 plans',                    condition: 'Create 10 plans to unlock'            },
  { id: 'architect',        name: 'The Architect',      emoji: '🏗️', tier: 'platinum', desc: 'Create 25 plans',                    condition: 'Create 25 plans to unlock'            },
  // Outdoors (9–12)
  { id: 'one_hour',         name: 'Fresh Air',          emoji: '🌱', tier: 'bronze',   desc: 'Log 1 hour outside',                 condition: 'Log 1 hour outside to unlock'         },
  { id: 'ten_hours',        name: 'Outdoorsy',          emoji: '🌿', tier: 'silver',   desc: 'Log 10 hours outside',               condition: 'Log 10 hours outside to unlock'       },
  { id: 'nature_lover',     name: 'Nature Lover',       emoji: '🍃', tier: 'gold',     desc: 'Log 25 hours outside',               condition: 'Log 25 hours outside to unlock'       },
  { id: 'cooped_no_more',   name: 'Cooped No More',     emoji: '🦅', tier: 'platinum', desc: 'Log 50 hours outside',               condition: 'Log 50 hours outside to unlock'       },
  // Streaks (13–16)
  { id: 'streak_3',         name: 'Showing Up',         emoji: '🔥', tier: 'bronze',   desc: 'Go outside 3 days in a row',        condition: 'Go outside 3 days in a row to unlock' },
  { id: 'streak_7',         name: 'On a Roll',          emoji: '⚡', tier: 'silver',   desc: 'Go outside 7 days in a row',        condition: 'Go outside 7 days in a row to unlock' },
  { id: 'streak_14',        name: 'Unstoppable',        emoji: '🚀', tier: 'gold',     desc: 'Go outside 14 days in a row',       condition: 'Go outside 14 days in a row to unlock'},
  { id: 'legendary_streak', name: 'Legendary Streak',  emoji: '💎', tier: 'platinum', desc: 'Go outside 30 days in a row',       condition: 'Go outside 30 days in a row to unlock'},
  // Special (17–19)
  { id: 'early_bird',       name: 'Early Bird',         emoji: '🐦', tier: 'bronze',   desc: 'First user to sign up',              condition: 'Be the first user to sign up'         },
  { id: 'night_owl',        name: 'Night Owl',          emoji: '🦉', tier: 'silver',   desc: 'Create a plan after 10pm',          condition: 'Create a plan after 10pm to unlock'   },
  { id: 'weather_warrior',  name: 'Weather Warrior',    emoji: '⛈️', tier: 'gold',     desc: 'Go outside when score is below 4',  condition: 'Go outside with weather score < 4'    },
];

// ─── DB helpers ───────────────────────────────────────────────────────────────
export async function getUserBadges(userId: string): Promise<UnlockedBadge[]> {
  try {
    const { data, error } = await supabase
      .from('badges')
      .select('badge_id, unlocked_at')
      .eq('user_id', userId);
    if (error) throw error;
    return (data ?? []).map((r: any) => ({
      badgeId: r.badge_id as string,
      unlockedAt: r.unlocked_at as string,
    }));
  } catch (err: any) {
    console.error('badges.getUserBadges error:', err);
    return [];
  }
}

export async function unlockBadge(userId: string, badgeId: string): Promise<void> {
  try {
    await (supabase.from('badges') as any).upsert(
      { user_id: userId, badge_id: badgeId, unlocked_at: new Date().toISOString() },
      { onConflict: 'user_id,badge_id', ignoreDuplicates: true }
    );
  } catch {
    // safe to ignore — unique constraint means already unlocked
  }
}

// ─── Check and unlock — fetches all stats from DB internally ──────────────────
// extras: event-specific context that can't be derived from DB (planHour for
// Night Owl, weatherScore for Weather Warrior, isFirstUser for Early Bird).
export async function checkAndUnlockBadges(
  userId: string,
  extras: { planHour?: number; weatherScore?: number; isFirstUser?: boolean } = {},
): Promise<BadgeDef[]> {
  try {
    // Fetch all stats in parallel
    const [outRes, incRes, plansRes, joinedRes, userRes] = await Promise.all([
      supabase.from('friendships').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'accepted'),
      supabase.from('friendships').select('id', { count: 'exact', head: true }).eq('friend_id', userId).eq('status', 'accepted'),
      supabase.from('plans').select('id', { count: 'exact', head: true }).eq('creator_id', userId),
      supabase.from('plan_attendees').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('users').select('hours_outside').eq('id', userId).single(),
    ]);

    const fc = Math.round(((outRes.count ?? 0) + (incRes.count ?? 0)) / 2);
    const pc = plansRes.count ?? 0;
    const pj = joinedRes.count ?? 0;
    const ho = (userRes.data as any)?.hours_outside ?? 0;
    const ph = extras.planHour ?? -1;
    const ws = extras.weatherScore;

    // Existing unlocked badge IDs — skip these entirely
    const existing = new Set((await getUserBadges(userId)).map(b => b.badgeId));
    const newlyUnlocked: BadgeDef[] = [];

    async function tryUnlock(badge: BadgeDef, met: boolean) {
      if (!met || existing.has(badge.id)) return;
      await unlockBadge(userId, badge.id);
      newlyUnlocked.push(badge);
      notifyBadgeUnlocked(badge);
    }

    // Social
    await tryUnlock(ALL_BADGES[0],  fc >= 1);
    await tryUnlock(ALL_BADGES[1],  fc >= 5);
    await tryUnlock(ALL_BADGES[2],  fc >= 10);
    await tryUnlock(ALL_BADGES[3],  fc >= 12);
    // Plans — created
    await tryUnlock(ALL_BADGES[4],  pc >= 1);
    await tryUnlock(ALL_BADGES[6],  pc >= 5);
    await tryUnlock(ALL_BADGES[7],  pc >= 10);
    await tryUnlock(ALL_BADGES[8],  pc >= 25);
    // Plans — joined (attendees includes creator row, so >= 1 means joined at least one)
    await tryUnlock(ALL_BADGES[5],  pj >= 1);
    // Outdoors
    await tryUnlock(ALL_BADGES[9],  ho >= 1);
    await tryUnlock(ALL_BADGES[10], ho >= 10);
    await tryUnlock(ALL_BADGES[11], ho >= 25);
    await tryUnlock(ALL_BADGES[12], ho >= 50);
    // Special
    await tryUnlock(ALL_BADGES[17], extras.isFirstUser === true);
    await tryUnlock(ALL_BADGES[18], ph >= 22);
    await tryUnlock(ALL_BADGES[19], ws !== undefined && ws < 4);

    return newlyUnlocked;
  } catch (err: any) {
    console.error('badges.checkAndUnlockBadges error:', err);
    return [];
  }
}
