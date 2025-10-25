-- ==========================================
-- TASK MANAGER PRO - COMPLETE DATABASE SCHEMA
-- ==========================================

create extension if not exists pgcrypto;

-- ========== ROOMS TABLE ==========
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
  email text not null unique,
  room_id uuid references rooms(id),
  role_flags jsonb default '["user"]'::jsonb,
  approved boolean default false,
  joined_at timestamptz default now(),
  last_login timestamptz,
  is_active boolean default true
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

-- ========== ROOMS HISTORY TABLE ==========
create table if not exists rooms_history (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  old_code text,
  new_code text,
  rotated_by uuid references auth.users(id),
  rotated_at timestamptz default now()
);

create index if not exists idx_rooms_history_room_id on rooms_history(room_id);
create index if not exists idx_rooms_history_rotated_at on rooms_history(rotated_at);

-- ========== HELPER FUNCTIONS ==========

create or replace function generate_room_code()
returns text language sql as \$\$
  select string_agg(substr('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', floor(random() * 36)::int + 1, 1), '')
  from generate_series(1, 6);
\$\$;

create or replace function is_admin(user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as \$\$
  select coalesce((role_flags @> '[\"admin\"]'::jsonb or role_flags @> '[\"super_admin\"]'::jsonb), false)
  from users_info
  where id = user_id;
\$\$;

-- ========== ROW LEVEL SECURITY ==========

alter table rooms enable row level security;
alter table users_info enable row level security;
alter table tasks enable row level security;
alter table rooms_history enable row level security;

-- ROOMS POLICIES
drop policy if exists "Admins can create rooms" on rooms;
create policy "Admins can create rooms"
on rooms for insert
to public
with check (is_admin(auth.uid()) and created_by = auth.uid());

drop policy if exists "Users can view their room" on rooms;
create policy "Users can view their room"
on rooms for select
to public
using (
  id = (select room_id from users_info where id = auth.uid())
);

drop policy if exists "Admins can update rooms" on rooms;
create policy "Admins can update rooms"
on rooms for update
to public
using (is_admin(auth.uid()));

-- USERS_INFO POLICIES
drop policy if exists "Allow signup" on users_info;
create policy "Allow signup"
on users_info for insert
to public
with check (true);

drop policy if exists "Users view own profile" on users_info;
create policy "Users view own profile"
on users_info for select
to public
using (auth.uid() = id);

drop policy if exists "Admins view users" on users_info;
create policy "Admins view users"
on users_info for select
to public
using (is_admin(auth.uid()));

drop policy if exists "Admins update users" on users_info;
create policy "Admins update users"
on users_info for update
to public
using (is_admin(auth.uid()));

-- TASKS POLICIES
drop policy if exists "Admins create tasks" on tasks;
create policy "Admins create tasks"
on tasks for insert
to public
with check (is_admin(auth.uid()));

drop policy if exists "Users view assigned" on tasks;
create policy "Users view assigned"
on tasks for select
to public
using (assigned_to = auth.uid());

drop policy if exists "Admins view all tasks" on tasks;
create policy "Admins view all tasks"
on tasks for select
to public
using (is_admin(auth.uid()));

drop policy if exists "Users update own tasks" on tasks;
create policy "Users update own tasks"
on tasks for update
to public
using (assigned_to = auth.uid());

drop policy if exists "Admins update tasks" on tasks;
create policy "Admins update tasks"
on tasks for update
to public
using (is_admin(auth.uid()));

-- ROOMS_HISTORY POLICIES
drop policy if exists "Admins view history" on rooms_history;
create policy "Admins view history"
on rooms_history for select
to public
using (is_admin(auth.uid()));
