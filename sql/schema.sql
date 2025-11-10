-- ==========================================
-- TASK MANAGER PRO - UPDATED DATABASE SCHEMA
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

-- ========== USERS TABLE (UPDATED) ==========
create table if not exists users_info (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  email text not null,
  room_id uuid references rooms(id) on delete set null,
  role text default 'user' check (role in ('user', 'admin', 'approver')),
  status text default 'pending' check (status in ('pending', 'approved', 'suspended', 'rejected')),
  promoted_at timestamptz,
  promoted_by uuid references auth.users(id),
  is_active boolean default true,
  joined_at timestamptz default now(),
  last_login timestamptz,
  profile_image text,
  phone text,
  department text
);

create index if not exists idx_users_info_room on users_info(room_id);
create index if not exists idx_users_info_status on users_info(status);
create index if not exists idx_users_info_role on users_info(role);
create index if not exists idx_users_info_email on users_info(email);

-- ========== TASKS TABLE (UPDATED) ==========
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
  edited_at timestamptz,
  edited_by uuid references auth.users(id),
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references auth.users(id),
  is_deleted boolean default false,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id)
);

create index if not exists idx_tasks_room_id on tasks(room_id);
create index if not exists idx_tasks_assigned_to on tasks(assigned_to);
create index if not exists idx_tasks_status on tasks(status);
create index if not exists idx_tasks_due_date on tasks(due_date);
create index if not exists idx_tasks_is_deleted on tasks(is_deleted);

-- ========== TASK ACTIVITY LOG ==========
create table if not exists task_activity_log (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id) on delete cascade,
  user_id uuid references auth.users(id),
  action text not null check (action in ('created','assigned','started','submitted','approved','rejected','edited','deleted','commented','updated')),
  old_value text,
  new_value text,
  timestamp timestamptz default now(),
  ip_address text
);

create index if not exists idx_task_activity_task_id on task_activity_log(task_id);
create index if not exists idx_task_activity_timestamp on task_activity_log(timestamp);

-- ========== NOTIFICATIONS TABLE (UPDATED) ==========
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  task_id uuid references tasks(id) on delete set null,
  type text not null check (type in (
    'task_assigned',
    'task_approved',
    'task_rejected',
    'task_edited',
    'task_deleted',
    'user_approved',
    'user_rejected',
    'user_promoted',
    'new_user_pending',
    'task_waiting_approval',
    'room_code_rotated'
  )),
  message text not null,
  is_read boolean default false,
  created_at timestamptz default now(),
  action_url text
);

create index if not exists idx_notifications_user_id on notifications(user_id);
create index if not exists idx_notifications_is_read on notifications(is_read);
create index if not exists idx_notifications_created_at on notifications(created_at);
create index if not exists idx_notifications_type on notifications(type);

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
create or replace function generate_room_code()
returns text language sql as $$
  select string_agg(substr('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', floor(random() * 36)::int + 1, 1), '')
  from generate_series(1, 6);
$$;

create or replace function is_admin(user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((role = 'admin'), false)
  from users_info
  where id = user_id;
$$;

create or replace function is_approver(user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((role in ('approver', 'admin')), false)
  from users_info
  where id = user_id;
$$;

-- ========== TRIGGERS ==========

-- Update task updated_at
create or replace function update_task_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_update_task_timestamp on tasks;
create trigger trigger_update_task_timestamp
  before update on tasks
  for each row
  execute function update_task_timestamp();

-- Notify admin when new user registers
create or replace function notify_admin_user_pending()
returns trigger as $$
declare
  admin_id uuid;
begin
  if new.status = 'pending' and new.role = 'user' then
    select id into admin_id
    from users_info
    where room_id = new.room_id
      and role = 'admin'
      and status = 'approved'
    limit 1;
    
    if admin_id is not null then
      insert into notifications (user_id, type, message, action_url)
      values (
        admin_id,
        'new_user_pending',
        'New user registration: ' || new.username || ' (' || new.email || ') - Pending approval',
        '/admin/approvals.html'
      );
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_notify_admin_user_pending on users_info;
create trigger trigger_notify_admin_user_pending
  after insert on users_info
  for each row
  execute function notify_admin_user_pending();

-- Notify user when approved
create or replace function notify_user_approved()
returns trigger as $$
begin
  if new.status = 'approved' and old.status = 'pending' then
    insert into notifications (user_id, type, message)
    values (
      new.id,
      'user_approved',
      'Your account has been approved! You can now access the application.'
    );
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_notify_user_approved on users_info;
create trigger trigger_notify_user_approved
  after update of status on users_info
  for each row
  execute function notify_user_approved();

-- Notify user when rejected
create or replace function notify_user_rejected()
returns trigger as $$
begin
  if new.status = 'rejected' and old.status = 'pending' then
    insert into notifications (user_id, type, message)
    values (
      new.id,
      'user_rejected',
      'Your account registration has been rejected. Please contact the admin.'
    );
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_notify_user_rejected on users_info;
create trigger trigger_notify_user_rejected
  after update of status on users_info
  for each row
  execute function notify_user_rejected();

-- Notify user when promoted to approver
create or replace function notify_user_promoted()
returns trigger as $$
begin
  if new.role = 'approver' and old.role = 'user' then
    insert into notifications (user_id, type, message, action_url)
    values (
      new.id,
      'user_promoted',
      'Congratulations! You have been promoted to Approver role.',
      '/approver/dashboard.html'
    );
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_notify_user_promoted on users_info;
create trigger trigger_notify_user_promoted
  after update of role on users_info
  for each row
  execute function notify_user_promoted();

-- Notify user when task is assigned
create or replace function notify_task_assigned()
returns trigger as $$
begin
  if new.assigned_to is not null and (old.assigned_to is null or new.assigned_to != old.assigned_to) then
    insert into notifications (user_id, task_id, type, message, action_url)
    values (
      new.assigned_to,
      new.id,
      'task_assigned',
      'New task assigned: ' || new.title,
      '/user/tasks.html'
    );
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_notify_task_assigned on tasks;
create trigger trigger_notify_task_assigned
  after insert or update of assigned_to on tasks
  for each row
  execute function notify_task_assigned();

-- Notify user when task is edited
create or replace function notify_task_edited()
returns trigger as $$
begin
  if new.title != old.title or new.description != old.description or new.due_date != old.due_date then
    insert into notifications (user_id, task_id, type, message, action_url)
    values (
      new.assigned_to,
      new.id,
      'task_edited',
      'Task updated: ' || new.title,
      '/user/tasks.html'
    );
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_notify_task_edited on tasks;
create trigger trigger_notify_task_edited
  after update on tasks
  for each row
  when (new.is_deleted = false and old.is_deleted = false)
  execute function notify_task_edited();

-- Notify user when task is deleted
create or replace function notify_task_deleted()
returns trigger as $$
begin
  if new.is_deleted = true and old.is_deleted = false then
    insert into notifications (user_id, task_id, type, message)
    values (
      old.assigned_to,
      old.id,
      'task_deleted',
      'Task cancelled: ' || old.title
    );
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_notify_task_deleted on tasks;
create trigger trigger_notify_task_deleted
  after update of is_deleted on tasks
  for each row
  execute function notify_task_deleted();

-- Notify approver when task is submitted
create or replace function notify_approver_task_submitted()
returns trigger as $$
declare
  approver_id uuid;
begin
  if new.status = 'submitted' and old.status != 'submitted' then
    select id into approver_id
    from users_info
    where room_id = new.room_id
      and role in ('admin', 'approver')
      and status = 'approved'
    limit 1;
    
    if approver_id is not null then
      insert into notifications (user_id, task_id, type, message, action_url)
      values (
        approver_id,
        new.id,
        'task_waiting_approval',
        'Task submitted for approval: ' || new.title,
        '/admin/tasks.html'
      );
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_notify_approver_task_submitted on tasks;
create trigger trigger_notify_approver_task_submitted
  after update of status on tasks
  for each row
  execute function notify_approver_task_submitted();

-- Notify user when task is approved
create or replace function notify_task_approved()
returns trigger as $$
begin
  if new.status = 'approved' and old.status != 'approved' then
    insert into notifications (user_id, task_id, type, message, action_url)
    values (
      new.assigned_to,
      new.id,
      'task_approved',
      'Task approved: ' || new.title || ' ✅',
      '/user/tasks.html'
    );
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_notify_task_approved on tasks;
create trigger trigger_notify_task_approved
  after update of status on tasks
  for each row
  when (new.status = 'approved')
  execute function notify_task_approved();

-- Notify user when task is rejected
create or replace function notify_task_rejected()
returns trigger as $$
begin
  if new.status = 'rejected' and old.status != 'rejected' then
    insert into notifications (user_id, task_id, type, message, action_url)
    values (
      new.assigned_to,
      new.id,
      'task_rejected',
      'Task rejected: ' || new.title || '. Reason: ' || coalesce(new.rejection_reason, 'See details'),
      '/user/tasks.html'
    );
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_notify_task_rejected on tasks;
create trigger trigger_notify_task_rejected
  after update of status on tasks
  for each row
  when (new.status = 'rejected')
  execute function notify_task_rejected();

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
on rooms for insert to public
with check (is_admin(auth.uid()) and created_by = auth.uid());

drop policy if exists "Public can view rooms" on rooms;
create policy "Public can view rooms"
on rooms for select to public
using (true);

drop policy if exists "Admins can update rooms" on rooms;
create policy "Admins can update rooms"
on rooms for update to public
using (is_admin(auth.uid()) and created_by = auth.uid());

-- USERS_INFO POLICIES

-- Allow anyone to insert during signup (their own profile)
drop policy if exists "Allow user signup" on users_info;
create policy "Allow user signup" on users_info 
for insert to public 
with check (auth.uid() = id);

-- Users can view their own profile
drop policy if exists "Users can view own profile" on users_info;
create policy "Users can view own profile" on users_info 
for select to public 
using (auth.uid() = id);

-- Admins can view all users in their room
drop policy if exists "Admins can view all users" on users_info;
create policy "Admins can view all users" on users_info 
for select to public 
using (
  is_admin(auth.uid()) 
  and room_id = (select room_id from users_info where id = auth.uid())
);

-- Admins can update users in their room
drop policy if exists "Admins can update users" on users_info;
create policy "Admins can update users" on users_info 
for update to public 
using (
  is_admin(auth.uid()) 
  and room_id = (select room_id from users_info where id = auth.uid())
);

-- Admins can delete users in their room
drop policy if equals "Admins can delete users" on users_info;
create policy "Admins can delete users" on users_info 
for delete to public 
using (
  is_admin(auth.uid()) 
  and room_id = (select room_id from users_info where id = auth.uid())
);

-- Users can update their own profile
drop policy if exists "Users can update own profile" on users_info;
create policy "Users can update own profile" on users_info 
for update to public 
using (auth.uid() = id);

-- TASKS POLICIES
drop policy if exists "Admins can manage tasks" on tasks;
create policy "Admins can manage tasks" on tasks for all to public using (is_admin(auth.uid()));

drop policy if exists "Users can view assigned tasks" on tasks;
create policy "Users can view assigned tasks" on tasks for select to public using (assigned_to = auth.uid() and is_deleted = false);

drop policy if exists "Users can update assigned tasks" on tasks;
create policy "Users can update assigned tasks" on tasks for update to public using (assigned_to = auth.uid());

drop policy if exists "Approvers can view pending tasks" on tasks;
create policy "Approvers can view pending tasks" on tasks for select to public using (is_approver(auth.uid()));

-- NOTIFICATIONS POLICIES
drop policy if exists "Users can view own notifications" on notifications;
create policy "Users can view own notifications" on notifications for select to public using (user_id = auth.uid());

drop policy if exists "System can insert notifications" on notifications;
create policy "System can insert notifications" on notifications for insert to public with check (true);

drop policy if exists "Users can update own notifications" on notifications;
create policy "Users can update own notifications" on notifications for update to public using (user_id = auth.uid());

-- ROOMS_HISTORY POLICIES
drop policy if exists "Admins can manage room history" on rooms_history;
create policy "Admins can manage room history" on rooms_history for all to public using (is_admin(auth.uid()));