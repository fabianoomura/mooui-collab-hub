-- Converts access governance signals into admin notifications.
-- Intended to be called by a scheduled Edge Function using the service role.

create or replace function public.process_access_governance_alerts(_limit integer default 100)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  _processed integer := 0;
begin
  with admin_recipients as (
    select om.organization_id, om.user_id as admin_id
    from public.organization_members om
    where om.role = 'admin'
      and coalesce(om.status, 'active') = 'active'
      and (om.access_expires_at is null or om.access_expires_at > now())
  ),
  raw_events as (
    select
      m.organization_id,
      o.name as org_name,
      m.user_id as target_user_id,
      coalesce(nullif(p.full_name, ''), p.email, m.user_id::text) as target_name,
      'access_expiring'::text as event_kind,
      m.access_expires_at as event_at,
      format('access_expiring:%s:%s:%s', m.organization_id, m.user_id, m.access_expires_at::date) as event_key,
      'Acesso perto de vencer'::text as title,
      format('O acesso de %s vence em %s.', coalesce(nullif(p.full_name, ''), p.email, m.user_id::text), to_char(m.access_expires_at, 'DD/MM/YYYY')) as message
    from public.organization_members m
    join public.organizations o on o.id = m.organization_id
    left join public.profiles p on p.id = m.user_id
    where coalesce(m.status, 'active') = 'active'
      and m.access_expires_at > now()
      and m.access_expires_at <= now() + interval '7 days'

    union all

    select
      m.organization_id,
      o.name as org_name,
      m.user_id as target_user_id,
      coalesce(nullif(p.full_name, ''), p.email, m.user_id::text) as target_name,
      'access_expired'::text as event_kind,
      m.access_expires_at as event_at,
      format('access_expired:%s:%s:%s', m.organization_id, m.user_id, m.access_expires_at::date) as event_key,
      'Acesso expirado'::text as title,
      format('O acesso de %s expirou em %s.', coalesce(nullif(p.full_name, ''), p.email, m.user_id::text), to_char(m.access_expires_at, 'DD/MM/YYYY')) as message
    from public.organization_members m
    join public.organizations o on o.id = m.organization_id
    left join public.profiles p on p.id = m.user_id
    where coalesce(m.status, 'active') = 'active'
      and m.access_expires_at <= now()
      and m.access_expires_at >= now() - interval '14 days'

    union all

    select
      m.organization_id,
      o.name as org_name,
      m.user_id as target_user_id,
      coalesce(nullif(p.full_name, ''), p.email, m.user_id::text) as target_name,
      'invite_expired'::text as event_kind,
      m.invite_expires_at as event_at,
      format('invite_expired:%s:%s:%s', m.organization_id, m.user_id, m.invite_expires_at::date) as event_key,
      'Convite vencido'::text as title,
      format('O convite de %s venceu em %s.', coalesce(nullif(p.full_name, ''), p.email, m.user_id::text), to_char(m.invite_expires_at, 'DD/MM/YYYY')) as message
    from public.organization_members m
    join public.organizations o on o.id = m.organization_id
    left join public.profiles p on p.id = m.user_id
    where coalesce(m.status, 'active') <> 'suspended'
      and m.invited_at is not null
      and m.invite_accepted_at is null
      and m.invite_expires_at <= now()
      and m.invite_expires_at >= now() - interval '30 days'
  ),
  events as (
    select *
    from raw_events
    order by event_at asc
    limit greatest(_limit, 1)
  ),
  due as (
    select
      e.*,
      a.admin_id
    from events e
    join admin_recipients a on a.organization_id = e.organization_id
    where not exists (
      select 1
      from public.notifications n
      where n.user_id = a.admin_id
        and n.type = 'governance_access_alert'
        and n.metadata ->> 'event_key' = e.event_key
        and n.created_at >= now() - interval '1 day'
    )
  ),
  inserted as (
    insert into public.notifications (user_id, type, title, message, link, metadata)
    select
      due.admin_id,
      'governance_access_alert',
      due.title,
      due.message,
      '/configuracoes',
      jsonb_build_object(
        'module', 'configuracoes',
        'source', 'access_governance_alerts',
        'organization_id', due.organization_id,
        'organization_name', due.org_name,
        'target_user_id', due.target_user_id,
        'target_name', due.target_name,
        'event_kind', due.event_kind,
        'event_at', due.event_at,
        'event_key', due.event_key
      )
    from due
    returning 1
  )
  select count(*) into _processed from inserted;

  return coalesce(_processed, 0);
end;
$$;

revoke all on function public.process_access_governance_alerts(integer) from public;
revoke all on function public.process_access_governance_alerts(integer) from authenticated;
grant execute on function public.process_access_governance_alerts(integer) to service_role;

comment on function public.process_access_governance_alerts(integer) is 'Processes invite/access governance signals into admin notifications. Call from scheduled Edge Function with service role.';
