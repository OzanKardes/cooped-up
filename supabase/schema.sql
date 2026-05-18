-- ─── Cooped Up — Supabase Schema ─────────────────────────────────────────────
-- Run this entire file in the Supabase dashboard SQL editor (one paste).

-- ─── Users (extends Supabase auth.users) ─────────────────────────────────────
create table public.users (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  full_name text not null,
  avatar_initials text not null,
  hours_outside float default 0,
  is_online boolean default false,
  degree text,
  year_of_study text,
  created_at timestamp with time zone default now()
);

-- ─── Friendships ──────────────────────────────────────────────────────────────
create table public.friendships (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  friend_id uuid references public.users(id) on delete cascade not null,
  status text default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamp with time zone default now(),
  unique(user_id, friend_id)
);

-- ─── Plans ────────────────────────────────────────────────────────────────────
create table public.plans (
  id uuid default gen_random_uuid() primary key,
  creator_id uuid references public.users(id) on delete cascade not null,
  title text not null,
  location text not null,
  time timestamptz not null,
  visibility text default 'friends' check (visibility in ('public', 'friends', 'invite')),
  weather_snapshot jsonb,
  created_at timestamp with time zone default now()
);

-- ─── Plan invites ─────────────────────────────────────────────────────────────
create table public.plan_invites (
  id uuid default gen_random_uuid() primary key,
  plan_id uuid references public.plans(id) on delete cascade not null,
  invitee_id uuid references public.users(id) on delete cascade not null,
  status text default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamp with time zone default now(),
  unique(plan_id, invitee_id)
);

-- ─── Plan attendees ───────────────────────────────────────────────────────────
create table public.plan_attendees (
  id uuid default gen_random_uuid() primary key,
  plan_id uuid references public.plans(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  joined_at timestamp with time zone default now(),
  unique(plan_id, user_id)
);

-- ─── Chat groups ──────────────────────────────────────────────────────────────
create table public.chat_groups (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  created_by uuid references public.users(id) on delete set null,
  plan_id uuid references public.plans(id) on delete set null,
  created_at timestamp with time zone default now()
);

-- ─── Group members ────────────────────────────────────────────────────────────
create table public.group_members (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references public.chat_groups(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  joined_at timestamp with time zone default now(),
  unique(group_id, user_id)
);

-- ─── Messages ─────────────────────────────────────────────────────────────────
create table public.messages (
  id uuid default gen_random_uuid() primary key,
  sender_id uuid references public.users(id) on delete cascade not null,
  group_id uuid references public.chat_groups(id) on delete cascade,
  receiver_id uuid references public.users(id) on delete cascade,
  content text not null,
  type text default 'text' check (type in ('text', 'plan', 'location')),
  created_at timestamp with time zone default now(),
  -- Either group_id or receiver_id must be set, not both
  check (
    (group_id is not null and receiver_id is null) or
    (group_id is null and receiver_id is not null)
  )
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
create index messages_receiver_id_idx on public.messages(receiver_id);
create index messages_group_id_idx on public.messages(group_id);
create index messages_sender_id_idx on public.messages(sender_id);
create index messages_created_at_idx on public.messages(created_at desc);
create index plans_creator_id_idx on public.plans(creator_id);
create index plans_time_idx on public.plans(time);
create index friendships_user_id_idx on public.friendships(user_id);
create index friendships_friend_id_idx on public.friendships(friend_id);

-- ─── Row Level Security ───────────────────────────────────────────────────────
alter table public.users enable row level security;
alter table public.friendships enable row level security;
alter table public.plans enable row level security;
alter table public.plan_invites enable row level security;
alter table public.plan_attendees enable row level security;
alter table public.messages enable row level security;
alter table public.chat_groups enable row level security;
alter table public.group_members enable row level security;

-- ─── Users policies ───────────────────────────────────────────────────────────
create policy "Users can view own profile"
  on public.users for select
  using (auth.uid() = id);

create policy "Users can view other users for friend search"
  on public.users for select
  using (true);

create policy "Users can insert own profile"
  on public.users for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.users for update
  using (auth.uid() = id);

-- ─── Friendships policies ─────────────────────────────────────────────────────
create policy "Users can view their friendships"
  on public.friendships for select
  using (auth.uid() = user_id or auth.uid() = friend_id);

create policy "Users can send friend requests"
  on public.friendships for insert
  with check (auth.uid() = user_id);

create policy "Users can update friendship status"
  on public.friendships for update
  using (auth.uid() = friend_id);

-- ─── Plans policies ───────────────────────────────────────────────────────────
create policy "Users can view public plans"
  on public.plans for select
  using (visibility = 'public');

create policy "Users can view own plans"
  on public.plans for select
  using (auth.uid() = creator_id);

create policy "Users can view plans they are invited to"
  on public.plans for select
  using (
    exists (
      select 1 from public.plan_invites
      where plan_id = plans.id and invitee_id = auth.uid()
    )
  );

create policy "Users can view plans they attend"
  on public.plans for select
  using (
    exists (
      select 1 from public.plan_attendees
      where plan_id = plans.id and user_id = auth.uid()
    )
  );

create policy "Users can view friends plans"
  on public.plans for select
  using (
    visibility = 'friends' and
    exists (
      select 1 from public.friendships
      where (user_id = auth.uid() and friend_id = plans.creator_id and status = 'accepted')
         or (user_id = plans.creator_id and friend_id = auth.uid() and status = 'accepted')
    )
  );

create policy "Users can create plans"
  on public.plans for insert
  with check (auth.uid() = creator_id);

create policy "Users can update own plans"
  on public.plans for update
  using (auth.uid() = creator_id);

create policy "Users can delete own plans"
  on public.plans for delete
  using (auth.uid() = creator_id);

-- ─── Plan invites policies ────────────────────────────────────────────────────
create policy "Users can view their plan invites"
  on public.plan_invites for select
  using (auth.uid() = invitee_id);

create policy "Plan creators can insert invites"
  on public.plan_invites for insert
  with check (
    exists (
      select 1 from public.plans
      where id = plan_id and creator_id = auth.uid()
    )
  );

create policy "Users can update their invite status"
  on public.plan_invites for update
  using (auth.uid() = invitee_id);

-- ─── Plan attendees policies ──────────────────────────────────────────────────
create policy "Anyone can view plan attendees"
  on public.plan_attendees for select
  using (true);

create policy "Users can join plans"
  on public.plan_attendees for insert
  with check (auth.uid() = user_id);

create policy "Users can leave plans"
  on public.plan_attendees for delete
  using (auth.uid() = user_id);

-- ─── Messages policies ────────────────────────────────────────────────────────
create policy "Users can view their DMs"
  on public.messages for select
  using (
    auth.uid() = sender_id or auth.uid() = receiver_id
  );

create policy "Group members can view group messages"
  on public.messages for select
  using (
    group_id is not null and
    exists (
      select 1 from public.group_members
      where group_id = messages.group_id and user_id = auth.uid()
    )
  );

create policy "Users can send messages"
  on public.messages for insert
  with check (auth.uid() = sender_id);

-- ─── Chat groups policies ─────────────────────────────────────────────────────
create policy "Group members can view groups"
  on public.chat_groups for select
  using (
    exists (
      select 1 from public.group_members
      where group_id = chat_groups.id and user_id = auth.uid()
    )
  );

create policy "Users can create groups"
  on public.chat_groups for insert
  with check (auth.uid() = created_by);

-- ─── Group members policies ───────────────────────────────────────────────────
create policy "Group members can view membership"
  on public.group_members for select
  using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = group_members.group_id and gm.user_id = auth.uid()
    )
  );

create policy "Users can join groups"
  on public.group_members for insert
  with check (auth.uid() = user_id);

-- ─── Realtime ─────────────────────────────────────────────────────────────────
-- Enable realtime for messages table in the Supabase dashboard:
-- Database → Replication → Tables → enable messages

-- ─── Function: auto-create user profile on sign-up ───────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  _name text;
  _clean text;
  _initials text;
begin
  _name  := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));
  _clean := regexp_replace(_name, '[^A-Za-z ]', '', 'g');
  -- Try first-letter of first + last word, fall back to first letter, then '?'
  _initials := upper(coalesce(
    nullif(substring(_clean from '^(\w)\w*\s+(\w)'), ''),
    nullif(substring(_clean from '^(\w)'),           ''),
    '?'
  ));
  insert into public.users (id, email, full_name, avatar_initials, degree, year_of_study)
  values (
    new.id,
    new.email,
    _name,
    _initials,
    new.raw_user_meta_data->>'degree',
    new.raw_user_meta_data->>'year_of_study'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── Migrations: run these in the Supabase dashboard SQL editor ──────────────
-- Add columns if the table already existed before this change:
--
-- alter table public.users add column if not exists degree text;
-- alter table public.users add column if not exists year_of_study text;
--
-- Re-apply the fixed trigger (handles single-word names, no-letter names):
-- (paste the full create or replace function block above, then run it)
