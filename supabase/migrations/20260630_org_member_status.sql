-- Governance: reversible user lifecycle for organization members.
-- Active members keep access. Suspended/invited members stay auditable but lose org access.

alter table public.organization_members
  add column if not exists status text not null default 'active'
    check (status in ('active', 'invited', 'suspended')),
  add column if not exists status_changed_at timestamptz,
  add column if not exists status_changed_by uuid references public.profiles(id) on delete set null,
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_by uuid references public.profiles(id) on delete set null,
  add column if not exists suspension_reason text,
  add column if not exists invited_at timestamptz;

update public.organization_members
set status = 'active'
where status is null;

create index if not exists idx_org_members_active_lookup
  on public.organization_members (organization_id, user_id)
  where status = 'active';

create index if not exists idx_org_members_status
  on public.organization_members (organization_id, status);

create or replace function public.is_org_member(_user_id uuid, _org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members
    where user_id = _user_id
      and organization_id = _org_id
      and coalesce(status, 'active') = 'active'
  )
$$;

create or replace function public.is_org_admin(_user_id uuid, _org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members
    where user_id = _user_id
      and organization_id = _org_id
      and role = 'admin'
      and coalesce(status, 'active') = 'active'
  ) or exists (
    select 1
    from public.user_roles ur
    where ur.user_id = _user_id
      and ur.role = 'director'
      and exists (
        select 1
        from public.organization_members om
        where om.user_id = _user_id
          and om.organization_id = _org_id
          and coalesce(om.status, 'active') = 'active'
      )
  )
$$;

create or replace function public.has_min_role(_user_id uuid, _org_id uuid, _min_role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    left join public.user_roles ur on ur.user_id = om.user_id
      and ur.role::text not in ('it_support')
    where om.user_id = _user_id
      and om.organization_id = _org_id
      and coalesce(om.status, 'active') = 'active'
      and (
        case coalesce(ur.role::text, om.role::text)
          when 'admin' then 0
          when 'director' then 1
          when 'manager' then 2
          when 'operator' then 3
          when 'member' then 4
          else 4
        end
      ) <= (
        case _min_role
          when 'admin' then 0
          when 'director' then 1
          when 'manager' then 2
          when 'operator' then 3
          when 'member' then 4
        end
      )
  )
$$;

create or replace function public.get_dept_member_ids(_org_id uuid, _dept_name text)
returns table(user_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select dm.user_id
  from public.department_members dm
  join public.org_departments d on d.id = dm.department_id
  join public.organization_members om
    on om.organization_id = d.organization_id
   and om.user_id = dm.user_id
   and coalesce(om.status, 'active') = 'active'
  where d.organization_id = _org_id
    and lower(d.name) = lower(_dept_name)
$$;

comment on column public.organization_members.status is
  'active keeps access; invited/suspended remain auditable but are ignored by membership checks.';
