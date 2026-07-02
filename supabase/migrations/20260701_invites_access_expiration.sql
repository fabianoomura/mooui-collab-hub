-- Governance: invitation resend tracking and temporary access expiration.

alter table public.organization_members
  add column if not exists invite_last_sent_at timestamptz,
  add column if not exists invite_expires_at timestamptz,
  add column if not exists invite_sent_count integer not null default 0,
  add column if not exists invite_last_sent_by uuid references public.profiles(id) on delete set null,
  add column if not exists access_expires_at timestamptz,
  add column if not exists access_renewed_at timestamptz,
  add column if not exists access_renewed_by uuid references public.profiles(id) on delete set null;

create index if not exists idx_org_members_access_expires
  on public.organization_members (organization_id, access_expires_at)
  where access_expires_at is not null;

create index if not exists idx_org_members_invite_expires
  on public.organization_members (organization_id, invite_expires_at)
  where invite_expires_at is not null;

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
      and (access_expires_at is null or access_expires_at > now())
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
      and (access_expires_at is null or access_expires_at > now())
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
          and (om.access_expires_at is null or om.access_expires_at > now())
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
      and (om.access_expires_at is null or om.access_expires_at > now())
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
   and (om.access_expires_at is null or om.access_expires_at > now())
  where d.organization_id = _org_id
    and lower(d.name) = lower(_dept_name)
$$;

comment on column public.organization_members.invite_expires_at is
  'Operational expiry shown in the admin UI for the latest invite email.';

comment on column public.organization_members.access_expires_at is
  'When set in the past, membership checks treat the user as without access until renewed.';

comment on column public.organization_members.status is
  'active keeps access while access_expires_at is null/future; suspended blocks org access; invited is reserved for audited invite states.';
