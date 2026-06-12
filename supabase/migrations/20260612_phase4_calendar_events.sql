-- Phase 4.1: Central calendar_events table
-- Aggregates dated items from all sources into one unified calendar.
-- annual_events stays as-is (source of master campaigns/marcos).
-- calendar_events is the UI-facing table for the unified calendar.

create table if not exists calendar_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  source_type text not null,       -- 'annual_event', 'task', 'launch', 'booking'
  source_id uuid not null,         -- ID in the source table
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  sector text,                     -- e.g. 'marketing', 'produto', 'estudio', 'ti', 'sac'
  category text not null default 'prazo',  -- campanha|lancamento|sessao|feira|prazo|reuniao
  scope text not null default 'sector' check (scope in ('master', 'sector')),
  pinned_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, source_type, source_id)
);

-- Indexes for common queries
create index if not exists idx_calendar_events_org_scope
  on calendar_events (organization_id, scope, starts_at);
create index if not exists idx_calendar_events_org_sector
  on calendar_events (organization_id, sector, starts_at);
create index if not exists idx_calendar_events_source
  on calendar_events (source_type, source_id);

-- RLS
alter table calendar_events enable row level security;

create policy "calendar_events_select"
  on calendar_events for select
  using (organization_id in (
    select organization_id from organization_members where user_id = auth.uid()
  ));

create policy "calendar_events_insert"
  on calendar_events for insert
  with check (organization_id in (
    select organization_id from organization_members where user_id = auth.uid()
  ));

create policy "calendar_events_update"
  on calendar_events for update
  using (organization_id in (
    select organization_id from organization_members where user_id = auth.uid()
  ));

create policy "calendar_events_delete"
  on calendar_events for delete
  using (
    public.has_min_role(auth.uid(), organization_id, 'manager')
  );

-- Trigger: auto-update updated_at
create or replace function update_calendar_events_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_calendar_events_updated_at
  before update on calendar_events
  for each row execute function update_calendar_events_updated_at();

-- Backfill: sync existing annual_events → calendar_events
insert into calendar_events (organization_id, source_type, source_id, title, description, starts_at, ends_at, sector, category, scope, created_at, updated_at)
select
  ae.organization_id,
  'annual_event',
  ae.id,
  ae.title,
  ae.description,
  ae.start_date::timestamptz,
  ae.end_date::timestamptz,
  null,  -- annual_events are org-wide (master scope)
  case
    when ae.category = 'lancamento' then 'lancamento'
    when ae.category = 'data' then 'feira'
    else 'campanha'
  end,
  'master',
  ae.created_at,
  ae.updated_at
from annual_events ae
on conflict (organization_id, source_type, source_id) do nothing;

-- Backfill: sync launches → calendar_events (sector scope)
insert into calendar_events (organization_id, source_type, source_id, title, description, starts_at, ends_at, sector, category, scope, created_at, updated_at)
select
  l.organization_id,
  'launch',
  l.id,
  l.name,
  l.description,
  l.start_date::timestamptz,
  null,
  'produto',
  'lancamento',
  'sector',
  l.created_at,
  l.updated_at
from launches l
where l.start_date is not null
on conflict (organization_id, source_type, source_id) do nothing;

-- Backfill: sync room_bookings → calendar_events
insert into calendar_events (organization_id, source_type, source_id, title, starts_at, ends_at, sector, category, scope, created_at, updated_at)
select
  rb.organization_id,
  'booking',
  rb.id,
  rb.title,
  rb.starts_at,
  rb.ends_at,
  null,
  'reuniao',
  'sector',
  rb.created_at,
  rb.created_at
from room_bookings rb
on conflict (organization_id, source_type, source_id) do nothing;
