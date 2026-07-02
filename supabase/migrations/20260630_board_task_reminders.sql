-- Persistent reminder queue for board task dates.
-- A scheduled worker can later turn pending rows into notifications.

create table if not exists public.board_task_reminders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  source_column text not null default 'due_date',
  lead_days integer not null default 0 check (lead_days >= 0),
  remind_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'dismissed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (task_id, user_id, source_column, lead_days)
);

create index if not exists idx_board_task_reminders_pending
  on public.board_task_reminders (status, remind_at)
  where status = 'pending';

create index if not exists idx_board_task_reminders_project_user
  on public.board_task_reminders (project_id, user_id);

alter table public.board_task_reminders enable row level security;

create policy "Users can view own board reminders"
  on public.board_task_reminders for select
  using (
    auth.uid() = user_id
    and public.is_project_member(auth.uid(), project_id)
  );

create policy "Users can insert own board reminders"
  on public.board_task_reminders for insert
  with check (
    auth.uid() = user_id
    and public.is_project_member(auth.uid(), project_id)
  );

create policy "Users can update own board reminders"
  on public.board_task_reminders for update
  using (
    auth.uid() = user_id
    and public.is_project_member(auth.uid(), project_id)
  )
  with check (
    auth.uid() = user_id
    and public.is_project_member(auth.uid(), project_id)
  );

create policy "Users can delete own board reminders"
  on public.board_task_reminders for delete
  using (
    auth.uid() = user_id
    and public.is_project_member(auth.uid(), project_id)
  );

create trigger update_board_task_reminders_updated_at
  before update on public.board_task_reminders
  for each row execute function public.update_updated_at_column();

comment on table public.board_task_reminders is 'Pending reminders generated from Sunday board date columns.';
