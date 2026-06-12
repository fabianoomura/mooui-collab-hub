/**
 * Clone imported Sunday/Excel projects into module-owned boards.
 *
 * Dry-run:
 *   node scripts/internalize-sunday-module-boards.mjs
 *
 * Write:
 *   node scripts/internalize-sunday-module-boards.mjs --yes
 *
 * The script is idempotent: if the target board already exists, it is skipped.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const BASE_URL = 'https://rckglywohrywurknephc.supabase.co';
const ORG_ID = '0d32934f-9628-4bd5-b3f4-1bc74f9227de';
const MARKER = '[module-board:v1]';
const WRITE = process.argv.includes('--yes');

const BOARD_CLONES = [
  {
    module: 'programacao',
    target: 'Modulo | Programacao | Amo MOOUI',
    color: '#F43F5E',
    aliases: ['Excel | programacao amo mooui (1780430275)', '1780430275'],
  },
  {
    module: 'programacao',
    target: 'Modulo | Programacao | Barcelona',
    color: '#3B82F6',
    aliases: ['Excel | programacao mooui barcelona (1780430285)', '1780430285'],
  },
  {
    module: 'programacao',
    target: 'Modulo | Programacao | MOOUI Home',
    color: '#F59E0B',
    aliases: ['Excel | programacao mooui home (1780430305)', '1780430305'],
  },
  {
    module: 'programacao',
    target: 'Modulo | Programacao | MOOUI Kids',
    color: '#EC4899',
    aliases: ['Excel | programacao mooui kids (1780430295)', '1780430295'],
  },
  {
    module: 'programacao',
    target: 'Modulo | Programacao | Outras Redes',
    color: '#64748B',
    aliases: ['Excel | programacao outras redes (1780430314)', '1780430314'],
  },
  {
    module: 'newsletters',
    target: 'Modulo | Newsletters | Brasil',
    color: '#D6336C',
    aliases: ['Excel | newsletter mooui brasil (1780430246)', '1780430246'],
  },
  {
    module: 'newsletters',
    target: 'Modulo | Newsletters | Barcelona',
    color: '#2563EB',
    aliases: ['Excel | newsletter barcelona (1780430265)', '1780430265'],
  },
  {
    module: 'demandas-marketing',
    target: 'Modulo | Demandas Marketing',
    color: '#D6336C',
    aliases: ['Excel | marketing demandas (1780430344)', 'Marketing Demandas 1780430344', '1780430344'],
  },
  {
    module: 'sessoes',
    target: 'Modulo | Sessoes | Calendario de Fotos e Videos',
    color: '#0EA5E9',
    aliases: ['Excel | calendario de fotos e videos (1780430231)', 'Calendario de Fotos e Videos 1780430231', '1780430231'],
  },
  {
    module: 'melhorias',
    target: 'Modulo | Melhorias | Site',
    color: '#3B82F6',
    aliases: ['6 Site 1780430139', 'Site Melhorias 1780430139', '1780430139'],
  },
  {
    module: 'melhorias',
    target: 'Modulo | Melhorias | Shopify Novo',
    color: '#22C55E',
    aliases: ['6.1 Site Shopify Novo 1780430149', 'Shopify 1780430149', '1780430149'],
  },
  {
    module: 'melhorias',
    target: 'Modulo | Melhorias | SEO On-Page',
    color: '#F59E0B',
    aliases: ['NP SEO On Page 1780430199', 'SEO On-Page 1780430199', '1780430199'],
  },
  {
    module: 'melhorias',
    target: 'Modulo | Melhorias | SEO Tecnico',
    color: '#8B5CF6',
    aliases: ['NP SEO Tecnico 1780430208', 'SEO Tecnico 1780430208', '1780430208'],
  },
  {
    module: 'produtos',
    target: 'Modulo | Produtos',
    color: '#F97316',
    aliases: ['Excel | 4 - novos produtos (1780430107)', '4 - novos produtos 1780430107', '1780430107'],
  },
];

function norm(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

async function loadAuth() {
  for (const file of ['.auth2.json', '.auth_response.json']) {
    try {
      const json = JSON.parse(await fs.readFile(path.join(ROOT, 'generated', file), 'utf8'));
      const session = json.session || json;
      if (session.access_token && (session.user?.id || json.user?.id)) {
        return {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          user: session.user || json.user,
        };
      }
    } catch {
      // try next file
    }
  }
  throw new Error('Missing generated/.auth2.json or generated/.auth_response.json');
}

async function refreshAuth(auth) {
  if (!auth.refresh_token) return auth;
  const response = await fetch(`${BASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: {
      apikey: ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refresh_token: auth.refresh_token }),
  });
  if (!response.ok) return auth;
  const refreshed = await response.json();
  return {
    access_token: refreshed.access_token || auth.access_token,
    refresh_token: refreshed.refresh_token || auth.refresh_token,
    user: refreshed.user || auth.user,
  };
}

async function loadAnonKey() {
  const envText = await fs.readFile(path.join(ROOT, '.env'), 'utf8');
  const key = /VITE_SUPABASE_PUBLISHABLE_KEY="?([^"\r\n]+)"?/.exec(envText)?.[1];
  if (!key) throw new Error('Missing VITE_SUPABASE_PUBLISHABLE_KEY in .env');
  return key;
}

let ANON_KEY = '';
let TOKEN = '';
let USER_ID = '';

async function rest(table, query = '', options = {}) {
  const url = `${BASE_URL}/rest/v1/${table}${query ? `?${query}` : ''}`;
  const headers = {
    apikey: ANON_KEY,
    Authorization: `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${options.method || 'GET'} ${table} failed ${response.status}: ${text}`);
  }
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function selectAll(table, query, pageSize = 1000) {
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const page = await rest(table, query, { headers: { Range: `${from}-${to}` } });
    rows.push(...(page || []));
    if (!page || page.length < pageSize) break;
  }
  return rows;
}

async function selectAllOptional(table, query, pageSize = 1000) {
  try {
    return await selectAll(table, query, pageSize);
  } catch (error) {
    if (String(error.message || '').includes('PGRST205') || String(error.message || '').includes('404')) return [];
    throw error;
  }
}

async function selectByIds(table, select, column, ids, chunkSize = 120) {
  const rows = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    if (chunk.length === 0) continue;
    rows.push(...await selectAll(table, `select=${select}&${column}=in.(${chunk.join(',')})`));
  }
  return rows;
}

async function selectByIdsOptional(table, select, column, ids, chunkSize = 120) {
  try {
    return await selectByIds(table, select, column, ids, chunkSize);
  } catch (error) {
    if (String(error.message || '').includes('PGRST205') || String(error.message || '').includes('404')) return [];
    throw error;
  }
}

async function insertBatch(table, rows, batchSize = 500) {
  const inserted = [];
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    if (chunk.length === 0) continue;
    const data = await rest(table, '', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(chunk),
    });
    inserted.push(...(data || []));
  }
  return inserted;
}

function findProject(projects, aliases) {
  const keys = aliases.map(norm).filter(Boolean);
  return projects.find((project) => {
    const key = norm(project.name);
    return keys.some((alias) => key.includes(alias) || alias.includes(key));
  });
}

function cleanTaskForClone(task, projectId, parentTaskId = null) {
  return {
    project_id: projectId,
    sprint_id: null,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    due_date: task.due_date,
    start_date: task.start_date,
    ticket_number: task.ticket_number,
    position: task.position,
    parent_task_id: parentTaskId,
    created_by: USER_ID,
  };
}

async function cloneProject({ source, targetName, color, module }) {
  const description = `${MARKER}\nModule: ${module}\nSource project: ${source.name}\nSource project id: ${source.id}`;
  const [target] = await insertBatch('projects', [{
    name: targetName,
    description,
    color: color || source.color || '#D6336C',
    status: 'active',
    organization_id: ORG_ID,
    created_by: USER_ID,
  }], 1);

  await insertBatch('project_members', [{ project_id: target.id, user_id: USER_ID, role: 'owner' }], 1).catch(() => []);

  const sourceMembers = await selectAll('project_members', `select=user_id,role&project_id=eq.${source.id}`);
  const memberRows = sourceMembers
    .filter((member) => member.user_id !== USER_ID)
    .map((member) => ({ project_id: target.id, user_id: member.user_id, role: member.role || 'member' }));
  if (memberRows.length) await insertBatch('project_members', memberRows).catch(() => []);

  const sourceColumns = await selectAll('project_columns', `select=*&project_id=eq.${source.id}&order=position.asc`);
  const insertedColumns = sourceColumns.length
    ? await insertBatch('project_columns', sourceColumns.map((column) => ({
      project_id: target.id,
      name: column.name,
      column_type: column.column_type,
      position: column.position,
      width: column.width,
      config: column.config || {},
    })))
    : [];
  const columnMap = new Map(sourceColumns.map((column, index) => [column.id, insertedColumns[index]?.id]).filter(([, id]) => id));

  const sourceLabels = await selectAll('task_labels', `select=*&project_id=eq.${source.id}`);
  const insertedLabels = sourceLabels.length
    ? await insertBatch('task_labels', sourceLabels.map((label) => ({
      project_id: target.id,
      name: label.name,
      color: label.color,
    })))
    : [];
  const labelMap = new Map(sourceLabels.map((label, index) => [label.id, insertedLabels[index]?.id]).filter(([, id]) => id));

  const sourceTasks = await selectAll('tasks', `select=*&project_id=eq.${source.id}&order=position.asc`);
  const taskMap = new Map();
  const pending = [...sourceTasks];
  let guard = 0;
  while (pending.length && guard < sourceTasks.length + 5) {
    guard += 1;
    const ready = pending.filter((task) => !task.parent_task_id || taskMap.has(task.parent_task_id));
    if (ready.length === 0) break;
    const inserted = await insertBatch('tasks', ready.map((task) =>
      cleanTaskForClone(task, target.id, task.parent_task_id ? taskMap.get(task.parent_task_id) : null),
    ));
    ready.forEach((task, index) => taskMap.set(task.id, inserted[index].id));
    for (const task of ready) pending.splice(pending.indexOf(task), 1);
  }
  if (pending.length) throw new Error(`Could not clone ${pending.length} tasks for ${source.name}`);

  const sourceTaskIds = sourceTasks.map((task) => task.id);
  if (sourceTaskIds.length) {
    const customValues = await selectByIds('task_custom_values', 'task_id,column_id,value', 'task_id', sourceTaskIds);
    const customRows = customValues
      .map((value) => ({
        task_id: taskMap.get(value.task_id),
        column_id: columnMap.get(value.column_id),
        value: value.value,
      }))
      .filter((value) => value.task_id && value.column_id);
    if (customRows.length) await insertBatch('task_custom_values', customRows);

    const assignees = await selectByIds('task_assignees', 'task_id,user_id', 'task_id', sourceTaskIds);
    const assigneeRows = assignees
      .map((assignee) => ({ task_id: taskMap.get(assignee.task_id), user_id: assignee.user_id }))
      .filter((assignee) => assignee.task_id && assignee.user_id);
    if (assigneeRows.length) await insertBatch('task_assignees', assigneeRows).catch(() => []);

    const labelAssignments = await selectByIds('task_label_assignments', 'task_id,label_id', 'task_id', sourceTaskIds);
    const labelRows = labelAssignments
      .map((assignment) => ({ task_id: taskMap.get(assignment.task_id), label_id: labelMap.get(assignment.label_id) }))
      .filter((assignment) => assignment.task_id && assignment.label_id);
    if (labelRows.length) await insertBatch('task_label_assignments', labelRows).catch(() => []);

    const dependencies = await selectByIdsOptional('task_dependencies', 'task_id,depends_on_id', 'task_id', sourceTaskIds);
    const dependencyRows = dependencies
      .map((dependency) => ({ task_id: taskMap.get(dependency.task_id), depends_on_id: taskMap.get(dependency.depends_on_id) }))
      .filter((dependency) => dependency.task_id && dependency.depends_on_id);
    if (dependencyRows.length) await insertBatch('task_dependencies', dependencyRows).catch(() => []);
  }

  return {
    source: source.name,
    target: target.name,
    projectId: target.id,
    columns: sourceColumns.length,
    labels: sourceLabels.length,
    tasks: sourceTasks.length,
  };
}

async function main() {
  ANON_KEY = await loadAnonKey();
  const auth = await refreshAuth(await loadAuth());
  TOKEN = auth.access_token;
  USER_ID = auth.user.id;

  const projects = await selectAll('projects', `select=*&organization_id=eq.${ORG_ID}&status=eq.active`);
  const results = [];

  for (const config of BOARD_CLONES) {
    const existing = projects.find((project) => norm(project.name) === norm(config.target));
    const source = findProject(projects, config.aliases);
    if (!source) {
      results.push({ target: config.target, status: 'source_not_found', aliases: config.aliases });
      continue;
    }
    if (existing) {
      const tasks = await selectAll('tasks', `select=id&project_id=eq.${existing.id}`);
      results.push({ target: config.target, status: 'exists', projectId: existing.id, tasks: tasks.length });
      continue;
    }
    if (!WRITE) {
      const tasks = await selectAll('tasks', `select=id&project_id=eq.${source.id}`);
      results.push({ target: config.target, status: 'dry_run', source: source.name, sourceId: source.id, tasks: tasks.length });
      continue;
    }
    results.push({ status: 'created', ...(await cloneProject({
      source,
      targetName: config.target,
      color: config.color,
      module: config.module,
    })) });
  }

  console.log(JSON.stringify({ write: WRITE, results }, null, 2));
  if (!WRITE) console.log('\nDry-run only. Re-run with --yes to create missing module boards.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
