ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_tasks_project_active
ON public.tasks(project_id, position)
WHERE archived_at IS NULL;
