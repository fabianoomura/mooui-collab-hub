import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

/**
 * ai-agent Edge Function — Daily deadline reminder bot.
 *
 * Designed to be invoked via Supabase Cron (pg_cron) once daily.
 * It scans for tasks, launch stages, and checklist items with deadlines
 * approaching within 24h and sends reminder messages in the relevant
 * project/org channels via the Speaks module.
 *
 * Required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Optional:     BOT_USER_ID (UUID of the bot user in auth.users)
 *               If not set, the function will look for a user with
 *               email "bot@mooui.system".
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Resolve bot user
    let botId = Deno.env.get('BOT_USER_ID');
    if (!botId) {
      // Search through pages to find the bot user
      let page = 1;
      while (!botId && page <= 10) {
        const { data: users } = await admin.auth.admin.listUsers({ page, perPage: 100 });
        const bot = users?.users?.find(u => u.email === 'bot@mooui.system');
        if (bot) { botId = bot.id; break; }
        if (!users?.users?.length || users.users.length < 100) break;
        page++;
      }
    }
    if (!botId) {
      return json({ error: 'Bot user not found. Create a user with email bot@mooui.system or set BOT_USER_ID.' }, 503);
    }

    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const todayStr = now.toISOString().split('T')[0];

    let reminders = 0;

    // 1. Tasks with due_date in next 24h
    const { data: tasks } = await admin
      .from('tasks')
      .select('id, title, due_date, project_id, task_assignees(user_id)')
      .neq('status', 'done')
      .gte('due_date', todayStr)
      .lte('due_date', in24h);

    for (const task of (tasks || [])) {
      const assignees = (task.task_assignees || []) as { user_id: string }[];
      for (const a of assignees) {
        await admin.rpc('notify_user', {
          _user_id: a.user_id,
          _type: 'task_deadline',
          _title: `Prazo amanha: ${task.title}`,
          _message: `A tarefa "${task.title}" vence em ${task.due_date}.`,
          _link: '/projetos',
          _metadata: JSON.stringify({ module: 'tasks', entity_id: task.id }),
        });
        reminders++;
      }
    }

    // 2. Launch stages with planned_end in next 24h
    const { data: stages } = await admin
      .from('launch_stages')
      .select('id, name, planned_end, assignee_id, launch_id, launches(name)')
      .neq('status', 'done')
      .gte('planned_end', todayStr)
      .lte('planned_end', in24h);

    for (const stage of (stages || [])) {
      if (!stage.assignee_id) continue;
      const launchName = (stage.launches as any)?.name ?? '';
      await admin.rpc('notify_user', {
        _user_id: stage.assignee_id,
        _type: 'launch_deadline',
        _title: `Prazo amanha: ${stage.name}`,
        _message: `A etapa "${stage.name}" do lancamento "${launchName}" vence em ${stage.planned_end}.`,
        _link: '/lancamentos',
        _metadata: JSON.stringify({ module: 'launches', entity_id: stage.launch_id }),
      });
      reminders++;
    }

    // 3. Checklist items with due_date in next 24h
    const { data: checkItems } = await admin
      .from('launch_checklist_items')
      .select('id, label, due_date, assignee_id, checklist_id, launch_checklists(name)')
      .neq('status', 'done')
      .neq('status', 'na')
      .gte('due_date', todayStr)
      .lte('due_date', in24h);

    for (const item of (checkItems || [])) {
      if (!item.assignee_id) continue;
      const clName = (item.launch_checklists as any)?.name ?? '';
      await admin.rpc('notify_user', {
        _user_id: item.assignee_id,
        _type: 'checklist_deadline',
        _title: `Prazo amanha: ${item.label}`,
        _message: `O item "${item.label}" da checklist "${clName}" vence em ${item.due_date}.`,
        _link: '/checagens',
        _metadata: JSON.stringify({ module: 'checklists', entity_id: item.checklist_id }),
      });
      reminders++;
    }

    return json({ ok: true, reminders_sent: reminders, run_at: now.toISOString() });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
