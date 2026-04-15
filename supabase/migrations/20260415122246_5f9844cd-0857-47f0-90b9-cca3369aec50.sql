-- Add parent_task_id for subtasks
ALTER TABLE public.tasks ADD COLUMN parent_task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE;

-- Index for fast subtask lookups
CREATE INDEX idx_tasks_parent_task_id ON public.tasks(parent_task_id) WHERE parent_task_id IS NOT NULL;