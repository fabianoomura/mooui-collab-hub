
-- Create enum types
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'member');
CREATE TYPE public.task_status AS ENUM ('backlog', 'todo', 'in_progress', 'in_review', 'done');
CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE public.project_status AS ENUM ('active', 'archived');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  department TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'member',
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Projects table
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#D6336C',
  status project_status NOT NULL DEFAULT 'active',
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Project members
CREATE TABLE public.project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- Now create functions that reference tables
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_project_member(_user_id UUID, _project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE user_id = _user_id AND project_id = _project_id
  )
$$;

-- Task labels
CREATE TABLE public.task_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#D6336C',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.task_labels ENABLE ROW LEVEL SECURITY;

-- Sprints
CREATE TABLE public.sprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  goal TEXT,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sprints ENABLE ROW LEVEL SECURITY;

-- Tasks
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  sprint_id UUID REFERENCES public.sprints(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status task_status NOT NULL DEFAULT 'backlog',
  priority task_priority NOT NULL DEFAULT 'medium',
  due_date DATE,
  position INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Task assignees
CREATE TABLE public.task_assignees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(task_id, user_id)
);
ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;

-- Task comments
CREATE TABLE public.task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

-- Task attachments
CREATE TABLE public.task_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

-- Task activity log
CREATE TABLE public.task_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.task_activity_log ENABLE ROW LEVEL SECURITY;

-- Task label assignments
CREATE TABLE public.task_label_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  label_id UUID NOT NULL REFERENCES public.task_labels(id) ON DELETE CASCADE,
  UNIQUE(task_id, label_id)
);
ALTER TABLE public.task_label_assignments ENABLE ROW LEVEL SECURITY;

-- Notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Storage bucket for task attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('task-attachments', 'task-attachments', false);

-- ==================== RLS POLICIES ====================

-- Profiles
CREATE POLICY "Profiles viewable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- User roles
CREATE POLICY "Roles viewable by authenticated" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Projects
CREATE POLICY "Projects viewable by members" ON public.projects FOR SELECT TO authenticated USING (public.is_project_member(auth.uid(), id));
CREATE POLICY "Authenticated can create projects" ON public.projects FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Project members can update" ON public.projects FOR UPDATE TO authenticated USING (public.is_project_member(auth.uid(), id));

-- Project members
CREATE POLICY "Members viewable by project members" ON public.project_members FOR SELECT TO authenticated USING (public.is_project_member(auth.uid(), project_id));
CREATE POLICY "Project members can add members" ON public.project_members FOR INSERT TO authenticated WITH CHECK (public.is_project_member(auth.uid(), project_id) OR auth.uid() = user_id);
CREATE POLICY "Members can be removed" ON public.project_members FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.is_project_member(auth.uid(), project_id));

-- Tasks
CREATE POLICY "Tasks viewable by project members" ON public.tasks FOR SELECT TO authenticated USING (public.is_project_member(auth.uid(), project_id));
CREATE POLICY "Project members can create tasks" ON public.tasks FOR INSERT TO authenticated WITH CHECK (public.is_project_member(auth.uid(), project_id) AND auth.uid() = created_by);
CREATE POLICY "Project members can update tasks" ON public.tasks FOR UPDATE TO authenticated USING (public.is_project_member(auth.uid(), project_id));
CREATE POLICY "Project members can delete tasks" ON public.tasks FOR DELETE TO authenticated USING (public.is_project_member(auth.uid(), project_id));

-- Task assignees
CREATE POLICY "Assignees viewable by project members" ON public.task_assignees FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND public.is_project_member(auth.uid(), t.project_id)));
CREATE POLICY "Project members can manage assignees" ON public.task_assignees FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND public.is_project_member(auth.uid(), t.project_id)));
CREATE POLICY "Project members can remove assignees" ON public.task_assignees FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND public.is_project_member(auth.uid(), t.project_id)));

-- Task comments
CREATE POLICY "Comments viewable by project members" ON public.task_comments FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND public.is_project_member(auth.uid(), t.project_id)));
CREATE POLICY "Project members can add comments" ON public.task_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND public.is_project_member(auth.uid(), t.project_id)));
CREATE POLICY "Users can update own comments" ON public.task_comments FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON public.task_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Task attachments
CREATE POLICY "Attachments viewable by project members" ON public.task_attachments FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND public.is_project_member(auth.uid(), t.project_id)));
CREATE POLICY "Project members can add attachments" ON public.task_attachments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND public.is_project_member(auth.uid(), t.project_id)));
CREATE POLICY "Users can delete own attachments" ON public.task_attachments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Task activity log
CREATE POLICY "Activity viewable by project members" ON public.task_activity_log FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND public.is_project_member(auth.uid(), t.project_id)));
CREATE POLICY "Project members can log activity" ON public.task_activity_log FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND public.is_project_member(auth.uid(), t.project_id)));

-- Task labels
CREATE POLICY "Labels viewable by project members" ON public.task_labels FOR SELECT TO authenticated USING (public.is_project_member(auth.uid(), project_id));
CREATE POLICY "Project members can create labels" ON public.task_labels FOR INSERT TO authenticated WITH CHECK (public.is_project_member(auth.uid(), project_id));
CREATE POLICY "Project members can update labels" ON public.task_labels FOR UPDATE TO authenticated USING (public.is_project_member(auth.uid(), project_id));
CREATE POLICY "Project members can delete labels" ON public.task_labels FOR DELETE TO authenticated USING (public.is_project_member(auth.uid(), project_id));

-- Task label assignments
CREATE POLICY "Label assignments viewable" ON public.task_label_assignments FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND public.is_project_member(auth.uid(), t.project_id)));
CREATE POLICY "Project members can assign labels" ON public.task_label_assignments FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND public.is_project_member(auth.uid(), t.project_id)));
CREATE POLICY "Project members can remove labels" ON public.task_label_assignments FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND public.is_project_member(auth.uid(), t.project_id)));

-- Sprints
CREATE POLICY "Sprints viewable by project members" ON public.sprints FOR SELECT TO authenticated USING (public.is_project_member(auth.uid(), project_id));
CREATE POLICY "Project members can create sprints" ON public.sprints FOR INSERT TO authenticated WITH CHECK (public.is_project_member(auth.uid(), project_id));
CREATE POLICY "Project members can update sprints" ON public.sprints FOR UPDATE TO authenticated USING (public.is_project_member(auth.uid(), project_id));

-- Notifications
CREATE POLICY "Users see own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Anyone can create notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own notifications" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Storage policies
CREATE POLICY "Authenticated can upload attachments" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'task-attachments');
CREATE POLICY "Authenticated can view attachments" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'task-attachments');
CREATE POLICY "Users can delete attachments" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'task-attachments');

-- ==================== TRIGGERS ====================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_sprints_updated_at BEFORE UPDATE ON public.sprints FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_task_comments_updated_at BEFORE UPDATE ON public.task_comments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile and role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'member');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
