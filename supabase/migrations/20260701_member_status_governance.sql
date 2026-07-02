-- Governance hardening for user lifecycle:
-- suspension must explain why, and optional auth-level block is tracked.

alter table public.organization_members
  add column if not exists auth_blocked_at timestamptz,
  add column if not exists auth_blocked_by uuid references public.profiles(id) on delete set null,
  add column if not exists auth_block_reason text;

update public.organization_members
set suspension_reason = 'Suspensao anterior sem motivo registrado'
where status = 'suspended'
  and nullif(trim(coalesce(suspension_reason, '')), '') is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'organization_members_suspended_reason_check'
      and conrelid = 'public.organization_members'::regclass
  ) then
    alter table public.organization_members
      add constraint organization_members_suspended_reason_check
      check (
        status <> 'suspended'
        or length(trim(coalesce(suspension_reason, ''))) >= 3
      );
  end if;
end $$;

comment on column public.organization_members.suspension_reason is
  'Required when status = suspended. Explains the organization-level access suspension.';

comment on column public.organization_members.auth_blocked_at is
  'When set, the account was also blocked at Supabase Auth level by an admin action.';
