
-- Custom column definitions per project
CREATE TABLE public.project_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  column_type text NOT NULL DEFAULT 'texto',
  position integer NOT NULL DEFAULT 0,
  width integer DEFAULT 150,
  config jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_columns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Columns viewable by project members" ON public.project_columns
  FOR SELECT TO authenticated
  USING (is_project_member(auth.uid(), project_id));

CREATE POLICY "Project members can create columns" ON public.project_columns
  FOR INSERT TO authenticated
  WITH CHECK (is_project_member(auth.uid(), project_id));

CREATE POLICY "Project members can update columns" ON public.project_columns
  FOR UPDATE TO authenticated
  USING (is_project_member(auth.uid(), project_id));

CREATE POLICY "Project members can delete columns" ON public.project_columns
  FOR DELETE TO authenticated
  USING (is_project_member(auth.uid(), project_id));

-- Custom values per task per column
CREATE TABLE public.task_custom_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  column_id uuid NOT NULL REFERENCES public.project_columns(id) ON DELETE CASCADE,
  value text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(task_id, column_id)
);

ALTER TABLE public.task_custom_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Values viewable by project members" ON public.task_custom_values
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM tasks t WHERE t.id = task_custom_values.task_id
    AND is_project_member(auth.uid(), t.project_id)
  ));

CREATE POLICY "Project members can insert values" ON public.task_custom_values
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM tasks t WHERE t.id = task_custom_values.task_id
    AND is_project_member(auth.uid(), t.project_id)
  ));

CREATE POLICY "Project members can update values" ON public.task_custom_values
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM tasks t WHERE t.id = task_custom_values.task_id
    AND is_project_member(auth.uid(), t.project_id)
  ));

CREATE POLICY "Project members can delete values" ON public.task_custom_values
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM tasks t WHERE t.id = task_custom_values.task_id
    AND is_project_member(auth.uid(), t.project_id)
  ));
