/**
 * Recreate Calendario de Acoes Mensais from the imported Sunday board.
 *
 * Dry-run:
 *   node scripts/import-sunday-acoes-mensais-calendar.mjs
 *
 * Write:
 *   node scripts/import-sunday-acoes-mensais-calendar.mjs --yes
 *
 * Verify:
 *   node scripts/import-sunday-acoes-mensais-calendar.mjs --verify
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const ORG_ID = '0d32934f-9628-4bd5-b3f4-1bc74f9227de';
const BASE_URL = 'https://rckglywohrywurknephc.supabase.co';
const IMPORT_MARKER = '[sunday-acoes-mensais-import:v1]';
const WRITE = process.argv.includes('--yes');
const VERIFY = process.argv.includes('--verify');

const DEFAULT_ETAPAS = [
  { etapa_key: 'briefing', title: 'Briefing', position: 1 },
  { etapa_key: 'conteudo', title: 'Conteudo', position: 2 },
  { etapa_key: 'criativos', title: 'Criativos', position: 3 },
  { etapa_key: 'revisao', title: 'Revisao', position: 4 },
  { etapa_key: 'publicacao', title: 'Publicacao', position: 5 },
];

const envText = await fs.readFile(path.join(ROOT, '.env'), 'utf8');
const ANON_KEY = /VITE_SUPABASE_PUBLISHABLE_KEY="([^"]+)"/.exec(envText)?.[1];
if (!ANON_KEY) throw new Error('Missing VITE_SUPABASE_PUBLISHABLE_KEY in .env');

function clean(value) {
  return String(value ?? '').trim();
}

function norm(value) {
  return clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function dateOnly(value) {
  const raw = clean(value);
  if (!raw) return null;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(raw);
  return match?.[1] ?? null;
}

function categoryFor(task) {
  return /^lancamento\s*\|/i.test(norm(task.title)) ? 'lancamento' : 'acao';
}

function colorFor(category) {
  return category === 'lancamento' ? '#D6336C' : '#2563EB';
}

async function refreshAuth(refreshToken) {
  const res = await fetch(`${BASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!res.ok) throw new Error(`Auth refresh failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function loadAuth() {
  for (const name of ['.auth2.json', '.auth_response.json', '.auth.json']) {
    try {
      const file = path.join(ROOT, 'generated', name);
      const auth = JSON.parse(await fs.readFile(file, 'utf8'));
      if (!auth.access_token || !auth.user?.id) continue;
      if (auth.expires_at && auth.expires_at > Math.floor(Date.now() / 1000) + 60) return auth;
      if (!auth.refresh_token) return auth;
      const refreshed = await refreshAuth(auth.refresh_token);
      const next = { ...auth, ...refreshed, user: refreshed.user || auth.user };
      await fs.writeFile(file, JSON.stringify(next, null, 2), 'utf8');
      return next;
    } catch {}
  }
  throw new Error('No generated auth file found.');
}

function headers(prefer = 'return=representation') {
  return {
    apikey: ANON_KEY,
    Authorization: `Bearer ${globalThis.TOKEN}`,
    'Content-Type': 'application/json',
    Prefer: prefer,
  };
}

async function rest(table, params = '', options = {}) {
  const url = `${BASE_URL}/rest/v1/${table}${params ? `?${params}` : ''}`;
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers: headers(options.prefer),
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) throw new Error(`${options.method || 'GET'} ${table} failed: ${res.status} ${await res.text()}`);
  if (res.status === 204) return [];
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

async function insertBatches(table, rows, size = 200) {
  const out = [];
  for (let i = 0; i < rows.length; i += size) {
    out.push(...await rest(table, '', { method: 'POST', body: rows.slice(i, i + size) }));
  }
  return out;
}

async function loadSundayBoard() {
  const projects = await rest(
    'projects',
    `select=id,name,description&organization_id=eq.${ORG_ID}`
  );
  const project = projects.find((item) => norm(item.name).includes('0 - acoes mensais'));
  if (!project) throw new Error('Sunday board 0 - acoes mensais not found.');

  const tasks = await rest(
    'tasks',
    `select=id,title,start_date,due_date,status,priority,description,parent_task_id&project_id=eq.${project.id}&parent_task_id=is.null&order=position.asc`
  );
  const columns = await rest(
    'project_columns',
    `select=id,name&project_id=eq.${project.id}&order=position.asc`
  );
  const taskIds = tasks.map((task) => task.id);
  const values = taskIds.length
    ? await rest('task_custom_values', `select=task_id,column_id,value&task_id=in.(${taskIds.join(',')})`)
    : [];

  const columnById = new Map(columns.map((column) => [column.id, column]));
  const valuesByTask = new Map();
  for (const value of values) {
    const column = columnById.get(value.column_id);
    if (!column || !clean(value.value)) continue;
    if (!valuesByTask.has(value.task_id)) valuesByTask.set(value.task_id, []);
    valuesByTask.get(value.task_id).push({ name: column.name, value: clean(value.value) });
  }
  return { project, tasks, valuesByTask };
}

async function activeCalendarInstanceId() {
  const instances = await rest(
    'module_instances',
    `select=id,name,position,created_at&organization_id=eq.${ORG_ID}&module_key=eq.calendario&archived_at=is.null&order=position.asc&order=created_at.asc`
  );
  return instances[0]?.id ?? null;
}

function eventFromTask(project, valuesByTask, task, instanceId) {
  const custom = valuesByTask.get(task.id) || [];
  const customStart = custom.find((item) => /^data acao.*start$/i.test(norm(item.name)))?.value;
  const customEnd = custom.find((item) => /^data acao.*end$/i.test(norm(item.name)))?.value;
  const start = dateOnly(task.start_date) || dateOnly(customStart) || dateOnly(task.due_date) || dateOnly(customEnd);
  const end = dateOnly(task.due_date) || dateOnly(customEnd) || start;
  if (!start) return null;
  const category = categoryFor(task);
  const customValues = custom
    .filter((item) => !/^data acao/i.test(norm(item.name)))
    .map((item) => `${item.name}: ${item.value}`)
    .join('\n');
  const parts = [
    IMPORT_MARKER,
    `Fonte Sunday: ${project.name}`,
    `Task ID: ${task.id}`,
    clean(task.description),
    customValues ? `Campos Sunday:\n${customValues}` : '',
  ].filter(Boolean);

  return {
    organization_id: ORG_ID,
    title: clean(task.title),
    description: parts.join('\n\n'),
    category,
    color: colorFor(category),
    start_date: start,
    end_date: end,
    project_id: project.id,
    instance_id: instanceId,
    created_by: globalThis.USER_ID,
  };
}

async function previousImportedEvents() {
  const events = await rest(
    'annual_events',
    `select=id,title,description,category,start_date&organization_id=eq.${ORG_ID}&start_date=gte.2026-01-01`
  );
  return events.filter((event) => {
    const description = clean(event.description);
    return description.includes(IMPORT_MARKER)
      || (description.includes('Grupo Monday:') && ['acao', 'lancamento'].includes(event.category));
  });
}

async function deleteEvents(events) {
  for (const event of events) await rest('annual_events', `id=eq.${event.id}`, { method: 'DELETE' });
}

async function verifyImport() {
  const events = await rest(
    'annual_events',
    `select=id,title,start_date,end_date,description&organization_id=eq.${ORG_ID}&start_date=gte.2026-01-01`
  );
  const imported = events.filter((event) => clean(event.description).includes(IMPORT_MARKER));
  const other = events.filter((event) => !clean(event.description).includes(IMPORT_MARKER));
  const ids = imported.map((event) => event.id);
  const etapas = ids.length
    ? await rest('annual_event_etapas', `select=id,event_id&event_id=in.(${ids.join(',')})`)
    : [];
  console.log(`Verificacao: ${imported.length} eventos importados, ${other.length} outros eventos 2026+ e ${etapas.length} etapas.`);
  console.log(imported.slice(0, 5).map((event) => `${event.start_date} - ${event.title}`).join('\n'));
}

async function main() {
  const auth = await loadAuth();
  globalThis.TOKEN = auth.access_token;
  globalThis.USER_ID = auth.user.id;

  if (VERIFY) {
    await verifyImport();
    return;
  }

  const [{ project, tasks, valuesByTask }, instanceId, previous] = await Promise.all([
    loadSundayBoard(),
    activeCalendarInstanceId(),
    previousImportedEvents(),
  ]);
  const rows = tasks
    .map((task) => eventFromTask(project, valuesByTask, task, instanceId))
    .filter(Boolean);
  const skipped = tasks.length - rows.length;

  console.log(`Sunday: ${project.name}`);
  console.log(`Instancia calendario: ${instanceId || 'sem instancia'}`);
  console.log(`Eventos antigos a remover: ${previous.length}`);
  console.log(`Eventos novos a inserir: ${rows.length}`);
  console.log(`Sem data ignorados: ${skipped}`);
  if (skipped > 0) {
    const skippedTitles = tasks
      .filter((task) => !eventFromTask(project, valuesByTask, task, instanceId))
      .map((task) => `- ${task.title}`)
      .join('\n');
    console.log(`Itens sem data:\n${skippedTitles}`);
  }
  console.log(rows.slice(0, 5).map((event) => `${event.start_date} - ${event.title}`).join('\n'));

  if (!WRITE) {
    console.log('\nDry-run apenas. Use --yes para gravar.');
    return;
  }

  await deleteEvents(previous);
  const created = await insertBatches('annual_events', rows, 100);
  const etapas = created.flatMap((event) => DEFAULT_ETAPAS.map((etapa) => ({
    event_id: event.id,
    ...etapa,
    status: 'pendente',
  })));
  await insertBatches('annual_event_etapas', etapas, 200);
  console.log(`Carga concluida: ${created.length} eventos e ${etapas.length} etapas.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
