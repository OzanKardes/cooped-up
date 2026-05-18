// ─── Cooped Up — Supabase database types ──────────────────────────────────────

export interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_initials: string;
  hours_outside: number;
  is_online: boolean;
  created_at: string;
  degree?: string | null;
  year_of_study?: string | null;
}

export interface Friendship {
  id: string;
  user_id: string;
  friend_id: string;
  status: 'pending' | 'accepted';
  created_at: string;
  // joined
  friend?: User;
}

export interface Plan {
  id: string;
  creator_id: string;
  title: string;
  location: string;
  time: string; // ISO timestamptz
  visibility: 'public' | 'friends' | 'invite';
  weather_snapshot?: { emoji: string; temp: number; condition: string } | null;
  created_at: string;
  // joined
  creator?: User;
  attendees?: PlanAttendee[];
}

export interface PlanInvite {
  id: string;
  plan_id: string;
  invitee_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  // joined
  plan?: Plan;
}

export interface PlanAttendee {
  id: string;
  plan_id: string;
  user_id: string;
  joined_at: string;
  // joined
  user?: User;
}

export interface ChatGroup {
  id: string;
  name: string;
  created_by: string;
  plan_id?: string | null;
  created_at: string;
  // joined
  members?: GroupMember[];
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  joined_at: string;
  // joined
  user?: User;
}

export interface Message {
  id: string;
  sender_id: string;
  group_id?: string | null;
  receiver_id?: string | null;
  content: string;
  type: 'text' | 'plan' | 'location';
  created_at: string;
  // joined
  sender?: User;
}

// ─── UI helper types (not from DB) ────────────────────────────────────────────

export interface FriendWithStatus extends User {
  free: boolean;
  freeAt: string;
  planFrequency: number;
  initials: string;
  name: string;
}

export interface PlanForDisplay {
  id: string;
  title: string;
  location: string;
  time: string;
  weather: string;
  creator: string;
  visibility: string;
  attendeeInitials: string[];
  spots: number;
  isOwn: boolean;
}
