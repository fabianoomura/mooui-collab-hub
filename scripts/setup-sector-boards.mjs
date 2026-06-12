/**
 * Setup sector boards for the restructuring:
 *
 * 1. [3.4b] Merge "Modulo | Melhorias | Site" + "Modulo | Melhorias | Shopify Novo"
 *    into a single "Modulo | Melhorias | Site Unificado" board with task groups
 *    "Ativo" (Shopify Novo tasks) and "Backlog (site antigo)" (Site tasks).
 *
 * 2. [3.4d] Create empty "Modulo | Demandas Design" board in the Design sector.
 *
 * 3. Seed empty Modulo boards for new sectors that don't have boards yet:
 *    Comercial, Financeiro, Internacional, Produção.
 *
 * Dry-run:
 *   node scripts/setup-sector-boards.mjs
 *
 * Write:
 *   node scripts/setup-sector-boards.mjs --yes
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const BASE_URL = 'https://rckglywohrywurknephc.supabase.co';
const ORG_ID = '0d32934f-9628-4bd5-b3f4-1bc74f9227de';
const WRITE = process.argv.includes('--yes');

let ANON_KEY = '';
let TOKEN = '';
let USER_ID = '';

// ── Supabase REST helpers (same pattern as internalize script) ──

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
    } catch { /* try next */ }
  }
  throw new Error('Missing generated/.auth2.json or generated/.auth_response.json');
}

async function refreshAuth(auth) {
  if (!auth.refresh_token) return auth;
  const response = await fetch(`${BASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
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

async function updateRow(table, id, updates) {
  return rest(table, `id=eq.${id}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(updates),
  });
}

function norm(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

// ── Task 1: Merge Site boards [3.4b] ──

async function mergeSiteBoards(projects) {
  const results = [];
  const siteBoard = projects.find((p) => norm(p.name).includes(norm('Modulo | Melhorias | Site')));
  const shopifyBoard = projects.find((p) => norm(p.name).includes(norm('Modulo | Melhorias | Shopify Novo')));
  const targetName = 'Modulo | Melhorias | Site Unificado';
  const existing = projects.find((p) => norm(p.name) === norm(targetName));

  if (existing) {
    const tasks = await selectAll('tasks', `select=id&project_id=eq.${existing.id}`);
    results.push({ task: '3.4b merge', status: 'exists', projectId: existing.id, tasks: tasks.length });
    return results;
  }

  if (!siteBoard) {
    results.push({ task: '3.4b merge', status: 'source_not_found', missing: 'Modulo | Melhorias | Site' });
    return results;
  }
  if (!shopifyBoard) {
    results.push({ task: '3.4b merge', status: 'source_not_found', missing: 'Modulo | Melhorias | Shopify Novo' });
    return results;
  }

  const siteTasks = await selectAll('tasks', `select=*&project_id=eq.${siteBoard.id}&order=position.asc`);
  const shopifyTasks = await selectAll('tasks', `select=*&project_id=eq.${shopifyBoard.id}&order=position.asc`);

  if (!WRITE) {
    results.push({
      task: '3.4b merge',
      status: 'dry_run',
      sources: [
        { name: siteBoard.name, id: siteBoard.id, tasks: siteTasks.length },
        { name: shopifyBoard.name, id: shopifyBoard.id, tasks: shopifyTasks.length },
      ],
      target: targetName,
      totalTasks: siteTasks.length + shopifyTasks.length,
    });
    return results;
  }

  // Create merged project
  const [target] = await insertBatch('projects', [{
    name: targetName,
    description: `[merge:3.4b]\nMerged from: ${siteBoard.name} + ${shopifyBoard.name}`,
    color: '#3B82F6',
    status: 'active',
    organization_id: ORG_ID,
    created_by: USER_ID,
  }]);

  await insertBatch('project_members', [{ project_id: target.id, user_id: USER_ID, role: 'owner' }]).catch(() => []);

  // Copy columns from Shopify board (more recent/complete), merge unique from Site
  const shopifyCols = await selectAll('project_columns', `select=*&project_id=eq.${shopifyBoard.id}&order=position.asc`);
  const siteCols = await selectAll('project_columns', `select=*&project_id=eq.${siteBoard.id}&order=position.asc`);

  const colNames = new Set(shopifyCols.map((c) => c.name.toLowerCase()));
  const extraSiteCols = siteCols.filter((c) => !colNames.has(c.name.toLowerCase()));
  const allCols = [...shopifyCols, ...extraSiteCols];

  const insertedCols = allCols.length
    ? await insertBatch('project_columns', allCols.map((col, idx) => ({
        project_id: target.id,
        name: col.name,
        column_type: col.column_type,
        position: idx,
        width: col.width,
        config: col.config || {},
      })))
    : [];

  // Map old column IDs → new
  const colMapShopify = new Map(shopifyCols.map((c, i) => [c.id, insertedCols[i]?.id]).filter(([, id]) => id));
  const colMapSite = new Map();
  siteCols.forEach((c) => {
    const match = insertedCols.find((ic) => ic.name.toLowerCase() === c.name.toLowerCase());
    if (match) colMapSite.set(c.id, match.id);
  });

  // Copy labels from both boards (deduplicate by name)
  const shopifyLabels = await selectAll('task_labels', `select=*&project_id=eq.${shopifyBoard.id}`);
  const siteLabels = await selectAll('task_labels', `select=*&project_id=eq.${siteBoard.id}`);
  const labelNames = new Set();
  const allLabels = [];
  for (const l of [...shopifyLabels, ...siteLabels]) {
    if (!labelNames.has(l.name.toLowerCase())) {
      labelNames.add(l.name.toLowerCase());
      allLabels.push(l);
    }
  }
  const insertedLabels = allLabels.length
    ? await insertBatch('task_labels', allLabels.map((l) => ({
        project_id: target.id,
        name: l.name,
        color: l.color,
      })))
    : [];
  const labelMap = new Map(allLabels.map((l, i) => [l.id, insertedLabels[i]?.id]).filter(([, id]) => id));

  // Clone tasks — Shopify tasks get group "Ativo", Site tasks get "Backlog (site antigo)"
  async function cloneTasks(sourceTasks, group, colMap) {
    const taskMap = new Map();
    const pending = [...sourceTasks];
    let guard = 0;
    while (pending.length && guard < sourceTasks.length + 5) {
      guard++;
      const ready = pending.filter((t) => !t.parent_task_id || taskMap.has(t.parent_task_id));
      if (ready.length === 0) break;
      const inserted = await insertBatch('tasks', ready.map((t) => ({
        project_id: target.id,
        title: t.title,
        description: t.description ? `${t.description}\n\n[group:${group}]` : `[group:${group}]`,
        status: t.status,
        priority: t.priority,
        due_date: t.due_date,
        start_date: t.start_date,
        ticket_number: t.ticket_number,
        position: t.position,
        parent_task_id: t.parent_task_id ? taskMap.get(t.parent_task_id) : null,
        created_by: USER_ID,
      })));
      ready.forEach((t, i) => taskMap.set(t.id, inserted[i].id));
      for (const t of ready) pending.splice(pending.indexOf(t), 1);
    }

    // Clone custom values
    const sourceIds = sourceTasks.map((t) => t.id);
    if (sourceIds.length) {
      const cvs = [];
      for (let i = 0; i < sourceIds.length; i += 120) {
        const chunk = sourceIds.slice(i, i + 120);
        cvs.push(...await selectAll('task_custom_values', `select=task_id,column_id,value&task_id=in.(${chunk.join(',')})`));
      }
      const cvRows = cvs
        .map((cv) => ({ task_id: taskMap.get(cv.task_id), column_id: colMap.get(cv.column_id), value: cv.value }))
        .filter((cv) => cv.task_id && cv.column_id);
      if (cvRows.length) await insertBatch('task_custom_values', cvRows);

      // Clone assignees
      const assignees = [];
      for (let i = 0; i < sourceIds.length; i += 120) {
        const chunk = sourceIds.slice(i, i + 120);
        assignees.push(...await selectAll('task_assignees', `select=task_id,user_id&task_id=in.(${chunk.join(',')})`));
      }
      const aRows = assignees
        .map((a) => ({ task_id: taskMap.get(a.task_id), user_id: a.user_id }))
        .filter((a) => a.task_id && a.user_id);
      if (aRows.length) await insertBatch('task_assignees', aRows).catch(() => []);

      // Clone label assignments
      const las = [];
      for (let i = 0; i < sourceIds.length; i += 120) {
        const chunk = sourceIds.slice(i, i + 120);
        las.push(...await selectAll('task_label_assignments', `select=task_id,label_id&task_id=in.(${chunk.join(',')})`));
      }
      const laRows = las
        .map((la) => ({ task_id: taskMap.get(la.task_id), label_id: labelMap.get(la.label_id) }))
        .filter((la) => la.task_id && la.label_id);
      if (laRows.length) await insertBatch('task_label_assignments', laRows).catch(() => []);
    }

    return taskMap.size;
  }

  const activeCount = await cloneTasks(shopifyTasks, 'Ativo', colMapShopify);
  const backlogCount = await cloneTasks(siteTasks, 'Backlog (site antigo)', colMapSite);

  // Archive the source boards
  await updateRow('projects', siteBoard.id, { status: 'archived' });
  await updateRow('projects', shopifyBoard.id, { status: 'archived' });

  results.push({
    task: '3.4b merge',
    status: 'created',
    target: targetName,
    projectId: target.id,
    activeTasks: activeCount,
    backlogTasks: backlogCount,
    archivedSources: [siteBoard.name, shopifyBoard.name],
  });

  return results;
}

// ── Task 2: Create "Demandas Design" board [3.4d] ──

async function createDemandasDesign(projects) {
  const targetName = 'Modulo | Demandas Design';
  const existing = projects.find((p) => norm(p.name) === norm(targetName));

  if (existing) {
    return [{ task: '3.4d create', status: 'exists', name: targetName, projectId: existing.id }];
  }

  if (!WRITE) {
    return [{ task: '3.4d create', status: 'dry_run', name: targetName }];
  }

  const [project] = await insertBatch('projects', [{
    name: targetName,
    description: 'Board de demandas do setor Design. Criado pela reestruturação fase 3.4d.',
    color: '#A855F7',
    status: 'active',
    organization_id: ORG_ID,
    created_by: USER_ID,
  }]);

  await insertBatch('project_members', [{ project_id: project.id, user_id: USER_ID, role: 'owner' }]).catch(() => []);

  // Create default columns
  await insertBatch('project_columns', [
    { project_id: project.id, name: 'Responsável', column_type: 'person', position: 0, config: {} },
    { project_id: project.id, name: 'Status', column_type: 'status', position: 1, config: { options: [
      { value: 'pendente', label: 'Pendente', color: '#94A3B8' },
      { value: 'em_andamento', label: 'Em Andamento', color: '#3B82F6' },
      { value: 'revisao', label: 'Revisão', color: '#F59E0B' },
      { value: 'concluido', label: 'Concluído', color: '#22C55E' },
    ]}},
    { project_id: project.id, name: 'Prazo', column_type: 'date', position: 2, config: {} },
    { project_id: project.id, name: 'Prioridade', column_type: 'select', position: 3, config: { options: [
      { value: 'alta', label: 'Alta', color: '#EF4444' },
      { value: 'media', label: 'Média', color: '#F59E0B' },
      { value: 'baixa', label: 'Baixa', color: '#22C55E' },
    ]}},
    { project_id: project.id, name: 'Tipo', column_type: 'select', position: 4, config: { options: [
      { value: 'embalagem', label: 'Embalagem' },
      { value: 'grafico', label: 'Gráfico' },
      { value: 'foto', label: 'Foto' },
      { value: 'video', label: 'Vídeo' },
      { value: 'outro', label: 'Outro' },
    ]}},
    { project_id: project.id, name: 'Notas', column_type: 'text', position: 5, config: {} },
  ]);

  return [{ task: '3.4d create', status: 'created', name: targetName, projectId: project.id, columns: 6 }];
}

// ── Task 3: Seed Modulo boards for new sectors ──

const SECTOR_BOARDS = [
  { name: 'Modulo | Atacado', color: '#F97316', description: 'Board do setor Comercial (Atacado).' },
  { name: 'Modulo | Financeiro', color: '#10B981', description: 'Board do setor Financeiro.' },
  { name: 'Modulo | Internacional', color: '#6366F1', description: 'Board do setor Internacional.' },
  { name: 'Modulo | Producao', color: '#EF4444', description: 'Board do setor Produção.' },
];

async function seedSectorBoards(projects) {
  const results = [];

  for (const board of SECTOR_BOARDS) {
    const existing = projects.find((p) => norm(p.name) === norm(board.name));

    if (existing) {
      results.push({ task: 'seed', status: 'exists', name: board.name, projectId: existing.id });
      continue;
    }

    if (!WRITE) {
      results.push({ task: 'seed', status: 'dry_run', name: board.name });
      continue;
    }

    const [project] = await insertBatch('projects', [{
      name: board.name,
      description: board.description,
      color: board.color,
      status: 'active',
      organization_id: ORG_ID,
      created_by: USER_ID,
    }]);

    await insertBatch('project_members', [{ project_id: project.id, user_id: USER_ID, role: 'owner' }]).catch(() => []);

    // Default columns for sector boards
    await insertBatch('project_columns', [
      { project_id: project.id, name: 'Responsável', column_type: 'person', position: 0, config: {} },
      { project_id: project.id, name: 'Status', column_type: 'status', position: 1, config: { options: [
        { value: 'pendente', label: 'Pendente', color: '#94A3B8' },
        { value: 'em_andamento', label: 'Em Andamento', color: '#3B82F6' },
        { value: 'concluido', label: 'Concluído', color: '#22C55E' },
      ]}},
      { project_id: project.id, name: 'Prazo', column_type: 'date', position: 2, config: {} },
      { project_id: project.id, name: 'Notas', column_type: 'text', position: 3, config: {} },
    ]);

    results.push({ task: 'seed', status: 'created', name: board.name, projectId: project.id, columns: 4 });
  }

  return results;
}

// ── Main ──

async function main() {
  ANON_KEY = await loadAnonKey();
  const auth = await refreshAuth(await loadAuth());
  TOKEN = auth.access_token;
  USER_ID = auth.user.id;

  console.log(`Mode: ${WRITE ? 'WRITE' : 'DRY-RUN'}`);
  console.log(`Org: ${ORG_ID}`);
  console.log(`User: ${USER_ID}\n`);

  const projects = await selectAll('projects', `select=*&organization_id=eq.${ORG_ID}&status=eq.active`);
  console.log(`Found ${projects.length} active projects.\n`);

  const mergeResults = await mergeSiteBoards(projects);
  const designResults = await createDemandasDesign(projects);
  const seedResults = await seedSectorBoards(projects);

  const allResults = [...mergeResults, ...designResults, ...seedResults];
  console.log(JSON.stringify({ write: WRITE, results: allResults }, null, 2));

  if (!WRITE) {
    console.log('\nDry-run only. Re-run with --yes to execute.');
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
