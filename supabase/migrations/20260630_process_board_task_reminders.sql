-- Converts pending board reminders into in-app notifications.
-- Intended to be called by a scheduled Edge Function using the service role.

create or replace function public.process_board_task_reminders(_limit integer default 100)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  _processed integer := 0;
begin
  with due as (
    select
      r.id,
      r.user_id,
      r.project_id,
      r.task_id,
      r.lead_days,
      r.metadata,
      t.title as task_title,
      t.due_date,
      p.name as project_name
    from public.board_task_reminders r
    join public.tasks t on t.id = r.task_id
    join public.projects p on p.id = r.project_id
    where r.status = 'pending'
      and r.remind_at <= now()
      and t.archived_at is null
      and t.status <> 'done'
    order by r.remind_at asc
    limit greatest(_limit, 1)
    for update skip locked
  ),
  inserted as (
    insert into public.notifications (user_id, type, title, message, link, metadata)
    select
      due.user_id,
      'board_date_reminder',
      'Lembrete de Data Acao',
      case
        when due.lead_days = 0 then
          format('"%s" vence hoje no board %s.', due.task_title, due.project_name)
        when due.lead_days = 1 then
          format('"%s" vence em 1 dia no board %s.', due.task_title, due.project_name)
        else
          format('"%s" vence em %s dias no board %s.', due.task_title, due.lead_days, due.project_name)
      end,
      '/projetos',
      jsonb_build_object(
        'module', 'boards',
        'project_id', due.project_id,
        'task_id', due.task_id,
        'due_date', due.due_date,
        'lead_days', due.lead_days,
        'source', 'board_task_reminders'
      ) || coalesce(due.metadata, '{}'::jsonb)
    from due
    returning 1
  ),
  updated as (
    update public.board_task_reminders r
    set status = 'sent',
        updated_at = now()
    from due
    where r.id = due.id
    returning 1
  )
  select count(*) into _processed from updated;

  return coalesce(_processed, 0);
end;
$$;

revoke all on function public.process_board_task_reminders(integer) from public;
revoke all on function public.process_board_task_reminders(integer) from authenticated;
grant execute on function public.process_board_task_reminders(integer) to service_role;

comment on function public.process_board_task_reminders(integer) is 'Processes pending board_task_reminders into notifications. Call from scheduled Edge Function with service role.';
