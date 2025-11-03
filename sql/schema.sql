-- ==========================================
-- TASK MANAGER PRO - DATABASE SCHEMA (FINAL)
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

-- ========== USERS TABLE ==========
create table if not exists users_info (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  email text not null,
  room_id uuid references rooms(id) on delete set null,
  role_flags jsonb default '["user"]'::jsonb,
  approved boolean default false,
  is_active boolean default true,
  joined_at timestamptz default now()
);

create index if not exists idx_users_info_room on users_info(room_id);

-- ========== TASKS TABLE ==========
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) not null,
  title text not null,
  description text,
  created_by uuid references auth.users(id),
  assigned_to uuid references users_info(id),
  status text default 'assigned' check (status in ('assigned','in_progress','submitted','approved','rejected')),
  priority text default 'medium' check (priority in ('low','medium','high','urgent')),
  due_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references auth.users(id),
  rejection_reason text
);

create index if not exists idx_tasks_room_id on tasks(room_id);
create index if not exists idx_tasks_assigned_to on tasks(assigned_to);
create index if not exists idx_tasks_status on tasks(status);

-- ========== NOTIFICATIONS TABLE ==========
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  task_id uuid references tasks(id) on delete set null,
  type text not null,
  message text not null,
  is_read boolean default false,
  created_at timestamptz default now()
);

create index if not exists idx_notifications_user_id on notifications(user_id);

-- ========== ROOM CODE HISTORY ==========
create table if not exists rooms_history (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  old_code text,
  new_code text,
  rotated_by uuid references auth.users(id),
  rotated_at timestamptz default now()
);

create index if not exists idx_rooms_history_room_id on rooms_history(room_id);

-- ========== FUNCTIONS ==========
create or replace function generate_room_code()
returns text language sql as $$
  select string_agg(substr('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', floor(random() * 36)::int + 1, 1), '')
  from generate_series(1, 6);
$$;

create or replace function is_admin(user_id uuid)
returns boolean language sql security definer stable as $$
  select coalesce((role_flags @> '["admin"]'::jsonb), false)
  from public.users_info
  where id = user_id;
$$;

-- ========== ROW LEVEL SECURITY ==========
alter table rooms enable row level security;
alter table users_info enable row level security;
alter table tasks enable row level security;
alter table notifications enable row level security;
alter table rooms_history enable row level security;

-- ROOMS POLICIES
drop policy if exists "Admins can create rooms" on rooms;
create policy "Admins can create rooms" on rooms for insert to public with check (is_admin(auth.uid()) and created_by = auth.uid());

drop policy if exists "Public can view rooms to check code" on rooms;
create policy "Public can view rooms to check code" on rooms for select to public using (true);

drop policy if exists "Admins can update their room" on rooms;
create policy "Admins can update their room" on rooms for update to public using (is_admin(auth.uid()));

-- USERS_INFO POLICIES
drop policy if exists "Allow user signup" on users_info;
create policy "Allow user signup" on users_info for insert to public with check (true);

drop policy if exists "Users can view their own profile" on users_info;
create policy "Users can view their own profile" on users_info for select to public using (auth.uid() = id);

drop policy if exists "Admins can view users in their room" on users_info;
create policy "Admins can view users in their room" on users_info for select to public using (is_admin(auth.uid()));

drop policy if exists "Admins can update users in their room" on users_info;
create policy "Admins can update users in their room" on users_info for update to public using (is_admin(auth.uid()));

drop policy if exists "Admins can delete users" on users_info;
create policy "Admins can delete users" on users_info for delete to public using (is_admin(auth.uid()));

-- TASKS POLICIES
drop policy if exists "Admins can manage tasks" on tasks;
create policy "Admins can manage tasks" on tasks for all to public using (is_admin(auth.uid()));

drop policy if exists "Users can view their assigned tasks" on tasks;
create policy "Users can view their assigned tasks" on tasks for select to public using (assigned_to = auth.uid());

drop policy if exists "Users can update status of their tasks" on tasks;
create policy "Users can update status of their tasks" on tasks for update to public using (assigned_to = auth.uid());

-- NOTIFICATIONS POLICIES
drop policy if exists "Users can manage their own notifications" on notifications;
create policy "Users can manage their own notifications" on notifications for all to public using (user_id = auth.uid());

-- ROOMS_HISTORY POLICIES
drop policy if exists "Admins can manage room history" on rooms_history;
create policy "Admins can manage room history" on rooms_history for all to public using (is_admin(auth.uid()));

-- Create notification when user requests approval
CREATE OR REPLACE FUNCTION notify_admin_approval_request()
RETURNS TRIGGER AS $$
DECLARE
  admin_id UUID;
BEGIN
  -- Find admin in the same room
  SELECT id INTO admin_id
  FROM users_info
  WHERE room_id = NEW.room_id
    AND role_flags @> '["admin"]'::jsonb
    AND approved = true
  LIMIT 1;
  
  IF admin_id IS NOT NULL AND NEW.approved = FALSE THEN
    INSERT INTO notifications (user_id, type, message)
    VALUES (
      admin_id,
      'approval_request',
      'New user approval request: ' || NEW.username || ' (' || NEW.email || ')'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_notify_admin_approval_request ON users_info;
CREATE TRIGGER trigger_notify_admin_approval_request
  AFTER INSERT ON users_info
  FOR EACH ROW
  EXECUTE FUNCTION notify_admin_approval_request();