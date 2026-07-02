-- Governance: invite acceptance and access telemetry.

alter table public.organization_members
  add column if not exists invite_accepted_at timestamptz,
  add column if not exists first_seen_at timestamptz,
  add column if not exists last_seen_at timestamptz,
  add column if not exists last_seen_ip text,
  add column if not exists last_seen_user_agent text;

create index if not exists idx_org_members_first_seen
  on public.organization_members (organization_id, first_seen_at)
  where first_seen_at is not null;

create index if not exists idx_org_members_last_seen
  on public.organization_members (organization_id, last_seen_at)
  where last_seen_at is not null;

comment on column public.organization_members.invite_accepted_at is
  'Set when an invited user signs in for the first time after an invite flow.';

comment on column public.organization_members.first_seen_at is
  'First authenticated access observed by the app for this organization membership.';

comment on column public.organization_members.last_seen_at is
  'Most recent authenticated access observed by the app for this organization membership.';
