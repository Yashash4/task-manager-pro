-- ==========================================
-- HELPER FUNCTIONS & TRIGGERS
-- ==========================================

-- Update task updated_at timestamp
create or replace function update_task_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_update_task_updated_at on tasks;
create trigger trigger_update_task_updated_at
  before update on tasks
  for each row
  execute function update_task_updated_at();

-- Update room updated_at timestamp
create or replace function update_room_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_update_room_updated_at on rooms;
create trigger trigger_update_room_updated_at
  before update on rooms
  for each row
  execute function update_room_updated_at();

-- Create notification when task is assigned
create or replace function notify_task_assigned()
returns trigger as $$
begin
  if new.assigned_to is not null then
    insert into notifications (user_id, task_id, type, message, action_url)
    values (
      new.assigned_to,
      new.id,
      'task_assigned',
      'New task assigned: ' || new.title,
      '/user/tasks.html?task=' || new.id
    );
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_notify_task_assigned on tasks;
create trigger trigger_notify_task_assigned
  after insert on tasks
  for each row
  execute function notify_task_assigned();

-- Create notification when task is approved
create or replace function notify_task_approved()
returns trigger as $$
begin
  if new.status = 'approved' and old.status != 'approved' then
    insert into notifications (user_id, task_id, type, message, action_url)
    values (
      new.assigned_to,
      new.id,
      'task_approved',
      'Task approved: ' || new.title,
      '/user/tasks.html?task=' || new.id
    );
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_notify_task_approved on tasks;
create trigger trigger_notify_task_approved
  after update on tasks
  for each row
  execute function notify_task_approved();

-- Create notification when task is rejected
create or replace function notify_task_rejected()
returns trigger as $$
begin
  if new.status = 'rejected' and old.status != 'rejected' then
    insert into notifications (user_id, task_id, type, message, action_url)
    values (
      new.assigned_to,
      new.id,
      'task_rejected',
      'Task rejected: ' || new.title,
      '/user/tasks.html?task=' || new.id
    );
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_notify_task_rejected on tasks;
create trigger trigger_notify_task_rejected
  after update on tasks
  for each row
  execute function notify_task_rejected();