-- ==========================================
-- TASK MANAGER PRO - DATABASE SCHEMA
-- ==========================================

create extension if not exists pgcrypto;

-- ========== ORGANIZATIONS/ROOMS TABLE ==========
create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  current_code text not null unique,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  is_active boolean default true
);

create index if not exists idx_rooms_current_code on rooms(current_code);
create index if not exists idx_rooms_created_by on rooms(created_by);

-- ========== USERS TABLE ==========
create table if not exists users_info (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  email text not null,
  room_id uuid references rooms(id),
  role_flags jsonb default '["user"]'::jsonb,
  permissions jsonb default '{}'::jsonb,
  approved boolean default false,
  joined_at timestamptz default now(),
  last_login timestamptz,
  is_active boolean default true,
  profile_image text,
  phone text,
  department text
);

create index if not exists idx_users_info_room on users_info(room_id);
create index if not exists idx_users_info_approved on users_info(approved);
create index if not exists idx_users_info_email on users_info(email);

-- ========== TASKS TABLE ==========
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) not null,
  title text not null,
  description text,
  created_by uuid references auth.users(id),
  assigned_to uuid references users_info(id),
  status text default 'assigned' check (status in ('assigned','in_progress','submitted','approved','rejected','archived')),
  priority text default 'medium' check (priority in ('low','medium','high','urgent')),
  due_date date,
  completion_date date,
  rejection_reason text,
  tags text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references auth.users(id)
);

create index if not exists idx_tasks_room_id on tasks(room_id);
create index if not exists idx_tasks_assigned_to on tasks(assigned_to);
create index if not exists idx_tasks_status on tasks(status);
create index if not exists idx_tasks_due_date on tasks(due_date);

-- ========== TASK ACTIVITY LOG ==========
create table if not exists task_activity_log (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id) on delete cascade,
  user_id uuid references auth.users(id),
  action text not null check (action in ('created','assigned','started','submitted','approved','rejected','commented','updated')),
  old_value text,
  new_value text,
  timestamp timestamptz default now(),
  ip_address text
);

create index if not exists idx_task_activity_task_id on task_activity_log(task_id);
create index if not exists idx_task_activity_timestamp on task_activity_log(timestamp);

-- ========== NOTIFICATIONS TABLE ==========
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  task_id uuid references tasks(id) on delete set null,
  type text not null check (type in ('task_assigned','task_approved','task_rejected','user_approved','user_role_changed','room_code_rotated')),
  message text not null,
  is_read boolean default false,
  created_at timestamptz default now(),
  action_url text
);

create index if not exists idx_notifications_user_id on notifications(user_id);
create index if not exists idx_notifications_is_read on notifications(is_read);
create index if not exists idx_notifications_created_at on notifications(created_at);

-- ========== ROOM CODE HISTORY ==========
create table if not exists rooms_history (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  old_code text,
  new_code text,
  rotated_by uuid references auth.users(id),
  rotated_at timestamptz default now(),
  reason text
);

create index if not exists idx_rooms_history_room_id on rooms_history(room_id);
create index if not exists idx_rooms_history_rotated_at on rooms_history(rotated_at);

-- ========== FUNCTIONS ==========

-- Generate room code
create or replace function generate_room_code()
returns text language sql as $$
  select string_agg(substr('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', floor(random() * 36)::int + 1, 1), '')
  from generate_series(1, 6);
$$;

-- Check if user is admin
create or replace function is_admin(user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((role_flags @> '["admin"]'::jsonb or role_flags @> '["super_admin"]'::jsonb), false)
  from users_info
  where id = user_id;
$$;

-- ========== ROW LEVEL SECURITY ==========

alter table rooms enable row level security;
alter table users_info enable row level security;
alter table tasks enable row level security;
alter table task_activity_log enable row level security;
alter table notifications enable row level security;
alter table rooms_history enable row level security;

-- ROOMS POLICIES
drop policy if exists "Admins can create rooms" on rooms;
create policy "Admins can create rooms"
on rooms for insert
to public
with check (is_admin(auth.uid()) and created_by = auth.uid());

drop policy if exists "Users and Admins can view rooms" on rooms;
create policy "Users and Admins can view rooms"
on rooms for select
to public
using (
  (id = (select room_id from users_info where id = auth.uid()))
  OR
  is_admin(auth.uid())
);

-- USERS_INFO POLICIES
drop policy if exists "Allow user signup" on users_info;
create policy "Allow user signup"
on users_info for insert
to public
with check (true);

drop policy if exists "Users can view own profile" on users_info;
create policy "Users can view own profile"
on users_info for select
to public
using (auth.uid() = id);

drop policy if exists "Admins can view users in room" on users_info;
create policy "Admins can view users in room"
on users_info for select
to public
using (is_admin(auth.uid()));

drop policy if exists "Admins can update users" on users_info;
create policy "Admins can update users"
on users_info for update
to public
using (is_admin(auth.uid()));

-- TASKS POLICIES
drop policy if exists "Admins can create tasks" on tasks;
create policy "Admins can create tasks"
on tasks for insert
to public
with check (is_admin(auth.uid()));

drop policy if exists "Users can view assigned tasks" on tasks;
create policy "Users can view assigned tasks"
on tasks for select
to public
using (assigned_to = auth.uid());

drop policy if exists "Admins can view all tasks" on tasks;
create policy "Admins can view all tasks"
on tasks for select
to public
using (is_admin(auth.uid()));

drop policy if exists "Users can update assigned tasks" on tasks;
create policy "Users can update assigned tasks"
on tasks for update
to public
using (assigned_to = auth.uid());

drop policy if exists "Admins can update tasks" on tasks;
create policy "Admins can update tasks"
on tasks for update
to public
using (is_admin(auth.uid()));

-- NOTIFICATIONS POLICIES
drop policy if exists "Users can view own notifications" on notifications;
create policy "Users can view own notifications"
on notifications for select
to public
using (user_id = auth.uid());

drop policy if exists "System can insert notifications" on notifications;
create policy "System can insert notifications"
on notifications for insert
to public
with check (true);

drop policy if exists "Users can update own notifications" on notifications;
create policy "Users can update own notifications"
on notifications for update
to public
using (user_id = auth.uid());