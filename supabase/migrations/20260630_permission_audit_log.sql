-- Audit trail for governance changes: module releases, roles, users and layers.

create table if not exists public.permission_audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null default auth.uid(),
  target_user_id uuid references public.profiles(id) on delete set null,
  entity_type text not null,
  entity_id text,
  action text not null,
  before_state jsonb,
  after_state jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_permission_audit_log_org_created
  on public.permission_audit_log (organization_id, created_at desc);

create index if not exists idx_permission_audit_log_target_user
  on public.permission_audit_log (target_user_id)
  where target_user_id is not null;

alter table public.permission_audit_log enable row level security;

create policy "Org admins can view permission audit log"
  on public.permission_audit_log for select
  using (public.is_org_admin(auth.uid(), organization_id));

create policy "Org admins can insert permission audit log"
  on public.permission_audit_log for insert
  with check (public.is_org_admin(auth.uid(), organization_id));

comment on table public.permission_audit_log is 'Audit trail for permission, release, layer and user governance changes.';
