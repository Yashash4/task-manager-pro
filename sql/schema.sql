-- ==========================================
-- TASK MANAGER PRO - COMPLETE DATABASE SCHEMA
-- For Supabase SQL Editor (CORRECTED VERSION)
-- ==========================================

-- ==========================================
-- DROP ALL EXISTING FUNCTIONS AND TRIGGERS FIRST
-- ==========================================
DROP TRIGGER IF EXISTS trigger_update_task_updated_at ON public.tasks;
DROP TRIGGER IF EXISTS trigger_update_room_updated_at ON public.rooms;
DROP TRIGGER IF EXISTS trigger_notify_task_assigned ON public.tasks;
DROP TRIGGER IF EXISTS trigger_notify_task_approved ON public.tasks;
DROP TRIGGER IF EXISTS trigger_notify_task_rejected ON public.tasks;

DROP FUNCTION IF EXISTS public.update_task_updated_at();
DROP FUNCTION IF EXISTS public.update_room_updated_at();
DROP FUNCTION IF EXISTS public.notify_task_assigned();
DROP FUNCTION IF EXISTS public.notify_task_approved();
DROP FUNCTION IF EXISTS public.notify_task_rejected();
DROP FUNCTION IF EXISTS public.generate_room_code();

-- ==========================================
-- 1. ROOMS TABLE (Organizations)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  current_code TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  description TEXT
);

-- ==========================================
-- 2. USERS_INFO TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.users_info (
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
  promoted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT valid_email CHECK (email ~* '^[^\s@]+@[^\s@]+\.[^\s@]+$')
);

-- ==========================================
-- 3. TASKS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.tasks (
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

-- ==========================================
-- 4. NOTIFICATIONS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users_info(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('task_assigned', 'task_approved', 'task_rejected', 'user_approved', 'general')),
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  read_at TIMESTAMP WITH TIME ZONE
);

-- ==========================================
-- 5. TASK ACTIVITY LOG TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.task_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users_info(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ==========================================
-- 6. ROOMS HISTORY TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.rooms_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  old_code TEXT NOT NULL,
  new_code TEXT NOT NULL,
  rotated_by UUID NOT NULL REFERENCES public.users_info(id) ON DELETE CASCADE,
  rotated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ==========================================
-- 7. CREATE INDEXES FOR PERFORMANCE
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_users_room ON public.users_info(room_id);
CREATE INDEX IF NOT EXISTS idx_users_status ON public.users_info(status);
CREATE INDEX IF NOT EXISTS idx_tasks_room ON public.tasks(room_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON public.tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_activity_task ON public.task_activity_log(task_id);
CREATE INDEX IF NOT EXISTS idx_rooms_created_by ON public.rooms(created_by);

-- ==========================================
-- 8. ENABLE ROW LEVEL SECURITY (RLS)
-- ==========================================
ALTER TABLE public.users_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms_history ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 9. RLS POLICIES FOR USERS_INFO
-- ==========================================

-- Policy 1: Allow signup - Anyone can insert their own profile
CREATE POLICY "allow_signup_insert" ON public.users_info
FOR INSERT TO public
WITH CHECK (auth.uid() = id);

-- Policy 2: Users can view their own profile
CREATE POLICY "user_view_self" ON public.users_info
FOR SELECT TO public
USING (auth.uid() = id);

-- Policy 3: Users can update their own profile
CREATE POLICY "user_update_self" ON public.users_info
FOR UPDATE TO public
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Policy 4: Admins can view all users in their room
CREATE POLICY "admin_view_room_users" ON public.users_info
FOR SELECT TO public
USING (
  EXISTS (
    SELECT 1 FROM public.users_info admin_check
    WHERE admin_check.id = auth.uid()
    AND admin_check.role = 'admin'
    AND admin_check.room_id = users_info.room_id
  )
);

-- Policy 5: Admins can update users in their room
CREATE POLICY "admin_update_room_users" ON public.users_info
FOR UPDATE TO public
USING (
  EXISTS (
    SELECT 1 FROM public.users_info admin_check
    WHERE admin_check.id = auth.uid()
    AND admin_check.role = 'admin'
    AND admin_check.room_id = users_info.room_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users_info admin_check
    WHERE admin_check.id = auth.uid()
    AND admin_check.role = 'admin'
    AND admin_check.room_id = users_info.room_id
  )
);

-- Policy 6: Admins can delete users in their room
CREATE POLICY "admin_delete_room_users" ON public.users_info
FOR DELETE TO public
USING (
  EXISTS (
    SELECT 1 FROM public.users_info admin_check
    WHERE admin_check.id = auth.uid()
    AND admin_check.role = 'admin'
    AND admin_check.room_id = users_info.room_id
  )
);

-- Policy 7: Approved users can see other team members
CREATE POLICY "users_see_team_members" ON public.users_info
FOR SELECT TO public
USING (
  status = 'approved'
  AND room_id = (
    SELECT room_id FROM public.users_info WHERE id = auth.uid()
  )
);

-- ==========================================
-- 10. RLS POLICIES FOR ROOMS
-- ==========================================

CREATE POLICY "public_can_read_rooms" ON public.rooms
FOR SELECT TO public
USING (true);

CREATE POLICY "admin_can_create_rooms" ON public.rooms
FOR INSERT TO public
WITH CHECK (created_by = auth.uid());

CREATE POLICY "admin_can_update_rooms" ON public.rooms
FOR UPDATE TO public
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

-- ==========================================
-- 11. RLS POLICIES FOR TASKS
-- ==========================================

CREATE POLICY "admin_can_manage_tasks" ON public.tasks
FOR ALL TO public
USING (
  EXISTS (
    SELECT 1 FROM public.users_info admin_check
    WHERE admin_check.id = auth.uid()
    AND admin_check.role = 'admin'
    AND admin_check.room_id = tasks.room_id
  )
);

CREATE POLICY "users_can_view_assigned_tasks" ON public.tasks
FOR SELECT TO public
USING (assigned_to = auth.uid() OR is_deleted = false);

CREATE POLICY "users_can_update_assigned_tasks" ON public.tasks
FOR UPDATE TO public
USING (assigned_to = auth.uid());

-- ==========================================
-- 12. RLS POLICIES FOR NOTIFICATIONS
-- ==========================================

CREATE POLICY "users_view_own_notifications" ON public.notifications
FOR SELECT TO public
USING (user_id = auth.uid());

CREATE POLICY "system_insert_notifications" ON public.notifications
FOR INSERT TO public
WITH CHECK (true);

CREATE POLICY "users_update_own_notifications" ON public.notifications
FOR UPDATE TO public
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- ==========================================
-- 13. RLS POLICIES FOR TASK ACTIVITY LOG
-- ==========================================

CREATE POLICY "users_view_activity" ON public.task_activity_log
FOR SELECT TO public
USING (
  user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.tasks
    WHERE tasks.id = task_activity_log.task_id
    AND tasks.assigned_to = auth.uid()
  )
);

CREATE POLICY "system_insert_activity" ON public.task_activity_log
FOR INSERT TO public
WITH CHECK (true);

-- ==========================================
-- 14. RLS POLICIES FOR ROOMS HISTORY
-- ==========================================

CREATE POLICY "admin_view_room_history" ON public.rooms_history
FOR SELECT TO public
USING (
  EXISTS (
    SELECT 1 FROM public.rooms
    WHERE rooms.id = rooms_history.room_id
    AND rooms.created_by = auth.uid()
  )
);

CREATE POLICY "admin_insert_room_history" ON public.rooms_history
FOR INSERT TO public
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.rooms
    WHERE rooms.id = rooms_history.room_id
    AND rooms.created_by = auth.uid()
  )
);

-- ==========================================
-- 15. HELPER FUNCTIONS (CORRECTED)
-- ==========================================

-- Update task updated_at timestamp
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

-- Update room updated_at timestamp
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

-- Create notification when task is assigned
CREATE FUNCTION public.notify_task_assigned()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.assigned_to IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, task_id, type, message)
    VALUES (
      NEW.assigned_to,
      NEW.id,
      'task_assigned',
      'New task assigned: ' || NEW.title
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_task_assigned
  AFTER INSERT ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_task_assigned();

-- Create notification when task is approved
CREATE FUNCTION public.notify_task_approved()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    INSERT INTO public.notifications (user_id, task_id, type, message)
    VALUES (
      NEW.assigned_to,
      NEW.id,
      'task_approved',
      'Task approved: ' || NEW.title
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_task_approved
  AFTER UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_task_approved();

-- Create notification when task is rejected
CREATE FUNCTION public.notify_task_rejected()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'rejected' AND OLD.status IS DISTINCT FROM 'rejected' THEN
    INSERT INTO public.notifications (user_id, task_id, type, message)
    VALUES (
      NEW.assigned_to,
      NEW.id,
      'task_rejected',
      'Task rejected: ' || NEW.title || '. Reason: ' || COALESCE(NEW.rejection_reason, 'No reason provided.')
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_task_rejected
  AFTER UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_task_rejected();

-- Generate random room code
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
-- 16. SCHEMA COMPLETE ✅
-- ==========================================
-- All tables, indexes, RLS policies, and functions created!
-- You can now:
-- 1. Sign up as admin (creates room)
-- 2. Generate room code
-- 3. Invite users with code
-- ==========================================