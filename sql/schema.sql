-- ==========================================
-- TASK MANAGER PRO - COMPLETE WORKING SCHEMA
-- CORRECTED for actual database structure
-- Copy and paste ENTIRE content into Supabase SQL Editor
-- ==========================================

-- Step 1: DISABLE RLS to start fresh
ALTER TABLE IF EXISTS users_info DISABLE ROW LEVEL SECURITY;

-- Step 2: DROP ALL OLD POLICIES that might be causing issues
DROP POLICY IF EXISTS "Allow user signup" ON users_info;
DROP POLICY IF EXISTS "Users can view own profile" ON users_info;
DROP POLICY IF EXISTS "Admins can view all users" ON users_info;
DROP POLICY IF EXISTS "Admins can update users" ON users_info;
DROP POLICY IF EXISTS "Admins can delete users" ON users_info;
DROP POLICY IF EXISTS "Users can update own profile" ON users_info;
DROP POLICY IF EXISTS "Public can view approved users" ON users_info;
DROP POLICY IF EXISTS "enable_signup_for_all" ON users_info;
DROP POLICY IF EXISTS "users_can_view_own_profile" ON users_info;
DROP POLICY IF EXISTS "users_can_update_own" ON users_info;
DROP POLICY IF EXISTS "admin_can_view_room_users" ON users_info;
DROP POLICY IF EXISTS "admin_can_update_room_users" ON users_info;
DROP POLICY IF EXISTS "admin_can_delete_room_users" ON users_info;
DROP POLICY IF EXISTS "approved_users_see_team" ON users_info;

-- Step 3: RE-ENABLE RLS
ALTER TABLE users_info ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- NEW POLICIES - SIMPLE AND WORKING
-- Using ONLY 'role' column (NOT role_flags)
-- ==========================================

-- Policy 1: ALLOW SIGNUP - Anyone can insert their own profile
CREATE POLICY "allow_signup_insert" ON users_info
FOR INSERT TO public
WITH CHECK (auth.uid() = id);

-- Policy 2: Users can view their own profile
CREATE POLICY "user_view_self" ON users_info
FOR SELECT TO public
USING (auth.uid() = id);

-- Policy 3: Users can update their own profile
CREATE POLICY "user_update_self" ON users_info
FOR UPDATE TO public
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Policy 4: Admins can view all users in their room
CREATE POLICY "admin_view_room_users" ON users_info
FOR SELECT TO public
USING (
  EXISTS (
    SELECT 1 FROM users_info admin_check
    WHERE admin_check.id = auth.uid()
    AND admin_check.role = 'admin'
    AND admin_check.room_id = users_info.room_id
  )
);

-- Policy 5: Admins can update users in their room
CREATE POLICY "admin_update_room_users" ON users_info
FOR UPDATE TO public
USING (
  EXISTS (
    SELECT 1 FROM users_info admin_check
    WHERE admin_check.id = auth.uid()
    AND admin_check.role = 'admin'
    AND admin_check.room_id = users_info.room_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users_info admin_check
    WHERE admin_check.id = auth.uid()
    AND admin_check.role = 'admin'
    AND admin_check.room_id = users_info.room_id
  )
);

-- Policy 6: Admins can delete users in their room
CREATE POLICY "admin_delete_room_users" ON users_info
FOR DELETE TO public
USING (
  EXISTS (
    SELECT 1 FROM users_info admin_check
    WHERE admin_check.id = auth.uid()
    AND admin_check.role = 'admin'
    AND admin_check.room_id = users_info.room_id
  )
);

-- Policy 7: Approved users can see other approved users in their room
CREATE POLICY "users_see_team_members" ON users_info
FOR SELECT TO public
USING (
  status = 'approved'
  AND room_id = (
    SELECT room_id FROM users_info WHERE id = auth.uid()
  )
);

-- ==========================================
-- ROOMS POLICIES
-- ==========================================

DROP POLICY IF EXISTS "public_can_read_rooms" ON rooms;
DROP POLICY IF EXISTS "admin_can_create_rooms" ON rooms;
DROP POLICY IF EXISTS "admin_can_update_rooms" ON rooms;

CREATE POLICY "public_can_read_rooms" ON rooms
FOR SELECT TO public
USING (true);

CREATE POLICY "admin_can_create_rooms" ON rooms
FOR INSERT TO public
WITH CHECK (created_by = auth.uid());

CREATE POLICY "admin_can_update_rooms" ON rooms
FOR UPDATE TO public
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

-- ==========================================
-- TASKS POLICIES
-- ==========================================

DROP POLICY IF EXISTS "admin_can_manage_tasks" ON tasks;
DROP POLICY IF EXISTS "users_can_view_assigned_tasks" ON tasks;
DROP POLICY IF EXISTS "users_can_update_assigned_tasks" ON tasks;

CREATE POLICY "admin_can_manage_tasks" ON tasks
FOR ALL TO public
USING (
  EXISTS (
    SELECT 1 FROM users_info admin_check
    WHERE admin_check.id = auth.uid()
    AND admin_check.role = 'admin'
    AND admin_check.room_id = tasks.room_id
  )
);

CREATE POLICY "users_can_view_assigned_tasks" ON tasks
FOR SELECT TO public
USING (assigned_to = auth.uid() OR is_deleted = false);

CREATE POLICY "users_can_update_assigned_tasks" ON tasks
FOR UPDATE TO public
USING (assigned_to = auth.uid());

-- ==========================================
-- NOTIFICATIONS POLICIES
-- ==========================================

DROP POLICY IF EXISTS "users_view_own_notifications" ON notifications;
DROP POLICY IF EXISTS "system_insert_notifications" ON notifications;
DROP POLICY IF EXISTS "users_update_own_notifications" ON notifications;

CREATE POLICY "users_view_own_notifications" ON notifications
FOR SELECT TO public
USING (user_id = auth.uid());

CREATE POLICY "system_insert_notifications" ON notifications
FOR INSERT TO public
WITH CHECK (true);

CREATE POLICY "users_update_own_notifications" ON notifications
FOR UPDATE TO public
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- ==========================================
-- TASK ACTIVITY LOG POLICIES
-- ==========================================

DROP POLICY IF EXISTS "users_view_own_activity" ON task_activity_log;
DROP POLICY IF EXISTS "system_insert_activity" ON task_activity_log;

CREATE POLICY "users_view_own_activity" ON task_activity_log
FOR SELECT TO public
USING (user_id = auth.uid() OR EXISTS (
  SELECT 1 FROM tasks
  WHERE tasks.id = task_activity_log.task_id
  AND tasks.assigned_to = auth.uid()
));

CREATE POLICY "system_insert_activity" ON task_activity_log
FOR INSERT TO public
WITH CHECK (true);

-- ==========================================
-- ROOMS HISTORY POLICIES
-- ==========================================

DROP POLICY IF EXISTS "admin_view_room_history" ON rooms_history;
DROP POLICY IF EXISTS "admin_insert_room_history" ON rooms_history;

CREATE POLICY "admin_view_room_history" ON rooms_history
FOR SELECT TO public
USING (
  EXISTS (
    SELECT 1 FROM rooms
    WHERE rooms.id = rooms_history.room_id
    AND rooms.created_by = auth.uid()
  )
);

CREATE POLICY "admin_insert_room_history" ON rooms_history
FOR INSERT TO public
WITH CHECK (
  EXISTS (
    SELECT 1 FROM rooms
    WHERE rooms.id = rooms_history.room_id
    AND rooms.created_by = auth.uid()
  )
);

-- ==========================================
-- DONE!
-- All policies have been created successfully
-- You can now try signing up!
-- ==========================================

-- To verify policies were created, run this query:
-- SELECT tablename, policyname FROM pg_policies WHERE tablename IN ('users_info', 'rooms', 'tasks', 'notifications') ORDER BY tablename;