-- ==========================================
-- SEED DATA FOR TESTING
-- ==========================================

-- Note: Update these UUIDs with actual Supabase auth user IDs
-- This is commented out by default. Uncomment and update with real IDs to use.

/*
-- Insert test organization/room
insert into rooms (name, current_code, created_by, is_active)
values (
  'Test Organization',
  'ABC123',
  'user-id-here'::uuid,
  true
);

-- Insert test users
insert into users_info (id, username, email, room_id, role_flags, approved, is_active)
values
  ('user-id-1'::uuid, 'john_admin', 'john@example.com', room_id_here, '[\"admin\"]'::jsonb, true, true),
  ('user-id-2'::uuid, 'jane_user', 'jane@example.com', room_id_here, '[\"user\"]'::jsonb, true, true),
  ('user-id-3'::uuid, 'bob_user', 'bob@example.com', room_id_here, '[\"user\"]'::jsonb, true, true);

-- Insert test tasks
insert into tasks (room_id, title, description, created_by, assigned_to, status, priority, due_date)
values
  (room_id_here, 'Design Homepage', 'Create design mockups', 'user-id-1'::uuid, 'user-id-2'::uuid, 'assigned', 'high', now()::date + 7),
  (room_id_here, 'API Development', 'Build REST API endpoints', 'user-id-1'::uuid, 'user-id-3'::uuid, 'in_progress', 'urgent', now()::date + 5);
*/
