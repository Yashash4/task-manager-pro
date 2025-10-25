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
    insert into notifications (user_id, task_id, type, message)
    values (
      new.assigned_to,
      new.id,
      'task_assigned',
      'New task assigned: ' || new.title
    );
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_notify_task_assigned on tasks;
create trigger trigger_notify_task_assigned
  after insert or update of assigned_to on tasks
  for each row
  when (new.assigned_to is not null and (tg_op = 'INSERT' or new.assigned_to != old.assigned_to))
  execute function notify_task_assigned();

-- Create notification when task is approved
create or replace function notify_task_approved()
returns trigger as $$
begin
  if new.status = 'approved' and old.status != 'approved' then
    insert into notifications (user_id, task_id, type, message)
    values (
      new.assigned_to,
      new.id,
      'task_approved',
      'Task approved: ' || new.title
    );
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_notify_task_approved on tasks;
create trigger trigger_notify_task_approved
  after update of status on tasks
  for each row
  when (new.status = 'approved' and old.status != 'approved')
  execute function notify_task_approved();

-- Create notification when task is rejected
create or replace function notify_task_rejected()
returns trigger as $$
begin
  if new.status = 'rejected' and old.status != 'rejected' then
    insert into notifications (user_id, task_id, type, message)
    values (
      new.assigned_to,
      new.id,
      'task_rejected',
      'Task rejected: ' || new.title || '. Reason: ' || coalesce(new.rejection_reason, 'No reason provided.')
    );
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_notify_task_rejected on tasks;
create trigger trigger_notify_task_rejected
  after update of status on tasks
  for each row
  when (new.status = 'rejected' and old.status != 'rejected')
  execute function notify_task_rejected();