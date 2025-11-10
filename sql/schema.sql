-- ==========================================
-- TASK MANAGER PRO - COMPLETE SCHEMA (FRESH START)
-- ==========================================

-- Ensure extension for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Step 1: DROP EVERYTHING (safe)
-- Note: avoid DROP TRIGGER ... ON <table> when table may not exist.
DROP FUNCTION IF EXISTS public.update_task_updated_at();
DROP FUNCTION IF EXISTS public.update_room_updated_at();
DROP FUNCTION IF EXISTS public.notify_task_assigned();
DROP FUNCTION IF EXISTS public.notify_task_approved();
DROP FUNCTION IF EXISTS public.notify_task_rejected();
DROP FUNCTION IF EXISTS public.generate_room_code();

DROP TABLE IF EXISTS public.rooms_history CASCADE;
DROP TABLE IF EXISTS public.task_activity_log CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.tasks CASCADE;
DROP TABLE IF EXISTS public.users_info CASCADE;
DROP TABLE IF EXISTS public.rooms CASCADE;

-- ==========================================
-- Step 2: CREATE TABLES (IN CORRECT ORDER)
-- ==========================================

-- 1. ROOMS TABLE
CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  current_code TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  description TEXT
);

-- 2. USERS_INFO TABLE
CREATE TABLE public.users_info (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user', 'approver')),
  role_flags TEXT[] DEFAULT ARRAY['user'],
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
  approved BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  promoted_at TIMESTAMP WITH TIME ZONE,
  promoted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 3. TASKS TABLE
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  assigned_to UUID REFERENCES public.users_info(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES public.users_info(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'assigned' CHECK (status IN ('assigned', 'in_progress', 'submitted', 'approved', 'rejected')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_date DATE NOT NULL,
  rejection_reason TEXT,
  approved_by UUID REFERENCES public.users_info(id) ON DELETE SET NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  edited_by UUID REFERENCES public.users_info(id) ON DELETE SET NULL,
  edited_at TIMESTAMP WITH TIME ZONE,
  deleted_by UUID REFERENCES public.users_info(id) ON DELETE SET NULL,
  deleted_at TIMESTAMP WITH TIME ZONE,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. NOTIFICATIONS TABLE
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users_info(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('task_assigned', 'task_approved', 'task_rejected', 'user_approved', 'general')),
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  read_at TIMESTAMP WITH TIME ZONE
);

-- 5. TASK ACTIVITY LOG TABLE
CREATE TABLE public.task_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users_info(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 6. ROOMS HISTORY TABLE
CREATE TABLE public.rooms_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  old_code TEXT NOT NULL,
  new_code TEXT NOT NULL,
  rotated_by UUID NOT NULL REFERENCES public.users_info(id) ON DELETE CASCADE,
  rotated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ==========================================
-- Step 3: CREATE INDEXES
-- ==========================================
CREATE INDEX idx_users_room ON public.users_info(room_id);
CREATE INDEX idx_users_status ON public.users_info(status);
CREATE INDEX idx_tasks_room ON public.tasks(room_id);
CREATE INDEX idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_created_by ON public.tasks(created_by);
CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE INDEX idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX idx_activity_task ON public.task_activity_log(task_id);
CREATE INDEX idx_rooms_created_by ON public.rooms(created_by);

-- ==========================================
-- Step 4: ENABLE ROW LEVEL SECURITY
-- ==========================================
ALTER TABLE public.users_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms_history ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- Step 5: USERS_INFO POLICIES (SIMPLIFIED)
-- ==========================================

-- Anyone can insert their own profile (signup)
CREATE POLICY "allow_all_insert" ON public.users_info
FOR INSERT
WITH CHECK (true);

-- Users can view their own profile
CREATE POLICY "users_view_own" ON public.users_info
FOR SELECT
USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "users_update_own" ON public.users_info
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Admins can view all users
CREATE POLICY "admins_view_all" ON public.users_info
FOR SELECT
USING (
  (SELECT role FROM public.users_info WHERE id = auth.uid() LIMIT 1) = 'admin'
);

-- Admins can update users
CREATE POLICY "admins_update_all" ON public.users_info
FOR UPDATE
USING (
  (SELECT role FROM public.users_info WHERE id = auth.uid() LIMIT 1) = 'admin'
);

-- Admins can delete users
CREATE POLICY "admins_delete_all" ON public.users_info
FOR DELETE
USING (
  (SELECT role FROM public.users_info WHERE id = auth.uid() LIMIT 1) = 'admin'
);

-- Approved users can see team members
CREATE POLICY "view_approved_teammates" ON public.users_info
FOR SELECT
USING (
  status = 'approved'
  AND room_id = (SELECT room_id FROM public.users_info WHERE id = auth.uid() LIMIT 1)
);

-- ==========================================
-- Step 6: ROOMS POLICIES
-- ==========================================

CREATE POLICY "public_can_read_rooms" ON public.rooms
FOR SELECT
USING (true);

CREATE POLICY "admin_can_create_rooms" ON public.rooms
FOR INSERT
WITH CHECK (created_by = auth.uid());

CREATE POLICY "admin_can_update_rooms" ON public.rooms
FOR UPDATE
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

-- ==========================================
-- Step 7: TASKS POLICIES
-- ==========================================

CREATE POLICY "admin_can_manage_tasks" ON public.tasks
FOR ALL
USING (
  (SELECT role FROM public.users_info WHERE id = auth.uid() LIMIT 1) = 'admin'
);

CREATE POLICY "users_can_view_assigned_tasks" ON public.tasks
FOR SELECT
USING (assigned_to = auth.uid());

CREATE POLICY "users_can_update_assigned_tasks" ON public.tasks
FOR UPDATE
USING (assigned_to = auth.uid());

-- ==========================================
-- Step 8: NOTIFICATIONS POLICIES
-- ==========================================

CREATE POLICY "users_view_own_notifications" ON public.notifications
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "system_insert_notifications" ON public.notifications
FOR INSERT
WITH CHECK (true);

CREATE POLICY "users_update_own_notifications" ON public.notifications
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- ==========================================
-- Step 9: TASK ACTIVITY LOG POLICIES
-- ==========================================

CREATE POLICY "system_insert_activity" ON public.task_activity_log
FOR INSERT
WITH CHECK (true);

CREATE POLICY "users_view_activity" ON public.task_activity_log
FOR SELECT
USING (user_id = auth.uid());

-- ==========================================
-- Step 10: ROOMS HISTORY POLICIES
-- ==========================================

CREATE POLICY "admin_insert_room_history" ON public.rooms_history
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.rooms
    WHERE rooms.id = rooms_history.room_id
    AND rooms.created_by = auth.uid()
  )
);

CREATE POLICY "admin_view_room_history" ON public.rooms_history
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.rooms
    WHERE rooms.id = rooms_history.room_id
    AND rooms.created_by = auth.uid()
  )
);

-- ==========================================
-- Step 11: CREATE FUNCTIONS & TRIGGERS
-- ==========================================

-- Update task timestamp
CREATE FUNCTION public.update_task_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_task_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_task_updated_at();

-- Update room timestamp
CREATE FUNCTION public.update_room_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_room_updated_at
  BEFORE UPDATE ON public.rooms
  FOR EACH ROW
  EXECUTE FUNCTION public.update_room_updated_at();

-- Task assigned notification
CREATE FUNCTION public.notify_task_assigned()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.assigned_to IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, task_id, type, message)
    VALUES (NEW.assigned_to, NEW.id, 'task_assigned', 'New task assigned: ' || NEW.title);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_task_assigned
  AFTER INSERT ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_task_assigned();

-- Task approved notification
CREATE FUNCTION public.notify_task_approved()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    INSERT INTO public.notifications (user_id, task_id, type, message)
    VALUES (NEW.assigned_to, NEW.id, 'task_approved', 'Task approved: ' || NEW.title);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_task_approved
  AFTER UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_task_approved();

-- Task rejected notification
CREATE FUNCTION public.notify_task_rejected()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'rejected' AND OLD.status IS DISTINCT FROM 'rejected' THEN
    INSERT INTO public.notifications (user_id, task_id, type, message)
    VALUES (NEW.assigned_to, NEW.id, 'task_rejected', 'Task rejected: ' || NEW.title || '. Reason: ' || COALESCE(NEW.rejection_reason, 'No reason provided.'));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_task_rejected
  AFTER UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_task_rejected();

-- Generate room code
CREATE FUNCTION public.generate_room_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
BEGIN
  code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 6));
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- ✅ SCHEMA COMPLETE & READY!
-- ==========================================