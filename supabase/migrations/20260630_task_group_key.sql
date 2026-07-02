-- Optional manual group assignment for Sunday board tasks.
-- Keeps imported/computed grouping intact while allowing user-created visual groups.

alter table public.tasks
  add column if not exists group_key text;

create index if not exists idx_tasks_project_group_key
  on public.tasks (project_id, group_key)
  where group_key is not null;

comment on column public.tasks.group_key is 'Optional manual Sunday board group key. When set, the task is displayed in that custom group.';
