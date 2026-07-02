-- Per-user board preferences for the Sunday board engine.
-- Keeps UI structure choices synced across devices without changing task content.

create table if not exists public.board_preferences (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, user_id)
);

create index if not exists idx_board_preferences_project_user
  on public.board_preferences (project_id, user_id);

alter table public.board_preferences enable row level security;

create policy "Project members can view own board preferences"
  on public.board_preferences for select
  using (
    auth.uid() = user_id
    and public.is_project_member(auth.uid(), project_id)
  );

create policy "Project members can insert own board preferences"
  on public.board_preferences for insert
  with check (
    auth.uid() = user_id
    and public.is_project_member(auth.uid(), project_id)
  );

create policy "Project members can update own board preferences"
  on public.board_preferences for update
  using (
    auth.uid() = user_id
    and public.is_project_member(auth.uid(), project_id)
  )
  with check (
    auth.uid() = user_id
    and public.is_project_member(auth.uid(), project_id)
  );

create policy "Project members can delete own board preferences"
  on public.board_preferences for delete
  using (
    auth.uid() = user_id
    and public.is_project_member(auth.uid(), project_id)
  );

create trigger update_board_preferences_updated_at
  before update on public.board_preferences
  for each row execute function public.update_updated_at_column();

comment on table public.board_preferences is 'Per-user visual and automation preferences for Sunday boards.';
comment on column public.board_preferences.preferences is 'JSON payload with pinned tasks, hidden columns, group display config, fixed column order and date reminder config.';
