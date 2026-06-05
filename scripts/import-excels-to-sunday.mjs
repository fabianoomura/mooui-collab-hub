/**
 * Populate Sunday projects from every Excel export in the repository root.
 *
 * Dry-run:
 *   node scripts/import-excels-to-sunday.mjs
 *
 * Write:
 *   node scripts/import-excels-to-sunday.mjs --yes
 *
 * The script deletes/recreates only projects whose description contains IMPORT_MARKER.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';

const ROOT = process.cwd();
const ORG_ID = '0d32934f-9628-4bd5-b3f4-1bc74f9227de';
const BASE_URL = 'https://rckglywohrywurknephc.supabase.co';
const IMPORT_MARKER = '[sunday-excel-import:v1]';
const WRITE = process.argv.includes('--yes');
const VERIFY = process.argv.includes('--verify');
const PEOPLE_REPORT = process.argv.includes('--people-report');
const envText = await fs.readFile(path.join(ROOT, '.env'), 'utf8');
const ANON_KEY = /VITE_SUPABASE_PUBLISHABLE_KEY="([^"]+)"/.exec(envText)?.[1];

if (!ANON_KEY) throw new Error('Missing VITE_SUPABASE_PUBLISHABLE_KEY in .env');

const COLORS = [
  '#D6336C', '#2563EB', '#059669', '#F59E0B', '#7C3AED', '#0891B2',
  '#EA580C', '#DB2777', '#16A34A', '#475569', '#DC2626', '#4F46E5',
];

function decode(value) {
  return String(value ?? '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function norm(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function clean(value) {
  return String(value ?? '').trim();
}

function validText(value) {
  const text = clean(value);
  if (!text) return false;
  if (/try it free|monday\.com|spreadsheet was created/i.test(text)) return false;
  return true;
}

function uniqueHeaders(headers, prefix = '') {
  const counts = new Map();
  return headers.map((header, index) => {
    const base = clean(header) || `Coluna ${index + 1}`;
    const key = norm(prefix + base) || `col${index + 1}`;
    const count = (counts.get(key) || 0) + 1;
    counts.set(key, count);
    return {
      raw: base,
      name: count > 1 ? `${base} ${count}` : base,
      key: count > 1 ? `${key}${count}` : key,
      index,
      prefixedName: prefix ? `${prefix}${count > 1 ? `${base} ${count}` : base}` : count > 1 ? `${base} ${count}` : base,
    };
  });
}

function rowObject(headers, row) {
  const out = {};
  for (const header of headers) out[header.key] = clean(row[header.index]);
  return out;
}

function value(item, ...names) {
  for (const name of names) {
    const candidates = [norm(name), norm(`Subitem: ${name}`), norm(`Subelemento: ${name}`)];
    for (const candidate of candidates) {
      const hit = item.values[candidate];
      if (hit !== undefined && hit !== null && clean(hit) !== '') return clean(hit);
    }
  }
  return '';
}

function isPeopleHeader(headerName) {
  const n = norm(headerName);
  return n.includes('respons') || n.includes('pessoa') || n.includes('person') || n.includes('owner');
}

function splitPeople(value) {
  return clean(value)
    .split(/\r?\n|;|,|\s+\+\s+|\s+\/\s+|\s+ e /i)
    .map((part) => clean(part))
    .filter(validText)
    .filter((part) => !/^(na|n\/a|-|_)$/i.test(part));
}

function peopleFromItem(item) {
  const names = [];
  for (const header of item.headers) {
    if (!isPeopleHeader(header.raw) && !isPeopleHeader(header.prefixedName)) continue;
    for (const person of splitPeople(item.values[header.key])) names.push(person);
  }
  return [...new Set(names)];
}

function excelDate(value) {
  const raw = clean(value);
  if (!raw) return null;
  if (/^\d+(\.\d+)?$/.test(raw)) {
    const date = new Date(Date.UTC(1899, 11, 30 + Number(raw)));
    return date.toISOString().slice(0, 10);
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function mapStatus(input) {
  const s = norm(input);
  if (!s) return 'todo';
  if (['feito', 'done', 'concluido', 'concluida', 'finalizado', 'finalizada', 'entregue', 'enviado', 'enviada', 'postada', 'publicado', 'publicada', 'producaofinalizada'].includes(s)) return 'done';
  if (['emandamento', 'workingonit', 'emproducao', 'producao', 'emdesenvolvimento', 'rascunho'].includes(s)) return 'in_progress';
  if (['emrevisao', 'revisaonecessaria', 'necessitarevisao', 'stuck', 'aprovacao', 'aprovacaoestampas'].includes(s)) return 'in_review';
  if (['cancelado', 'cancelada', 'abortado', 'abortada', 'rejeitado', 'rejeitada', 'na', 'n/a'].includes(s)) return 'backlog';
  return 'todo';
}

function mapPriority(input) {
  const s = norm(input);
  if (['baixa', 'low'].includes(s)) return 'low';
  if (['alta', 'high'].includes(s)) return 'high';
  if (['critica', 'critical', 'urgente'].includes(s)) return 'critical';
  return 'medium';
}

function firstDate(item, subitem = false) {
  const names = subitem
    ? ['Date', 'Data', 'Due date', 'Data Vencimento', 'Data Fim', 'Data - End', 'Cronograma - End', 'Lancamento']
    : ['Data', 'Date', 'Due date', 'Prazo', 'Data Vencimento', 'Data Fim', 'Data Ação - End', 'Data Acao - End', 'Data lançamento', 'Data lancamento', 'Lançamento', 'Lancamento', 'Cronograma - End'];
  for (const name of names) {
    const date = excelDate(value(item, name));
    if (date) return date;
  }
  return null;
}

function firstStartDate(item) {
  for (const name of ['Data Início', 'Data Inicio', 'Data Ação - Start', 'Data Acao - Start', 'Cronograma - Start', 'Data - Start']) {
    const date = excelDate(value(item, name));
    if (date) return date;
  }
  return null;
}

function noteFromItem(item, extra = []) {
  const lines = [
    ['Arquivo', item.file],
    ['Aba', item.sheetName],
    ['Grupo Monday', item.group],
    ...extra,
  ].filter(([, v]) => validText(v)).map(([k, v]) => `${k}: ${clean(v)}`);
  return lines.join('\n') || null;
}

async function readXlsxRows(file) {
  const zip = await JSZip.loadAsync(await fs.readFile(path.join(ROOT, file)));
  const sharedXml = await zip.file('xl/sharedStrings.xml')?.async('string');
  const shared = [];
  if (sharedXml) {
    for (const match of sharedXml.matchAll(/<si[\s\S]*?<\/si>/g)) {
      shared.push([...match[0].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => decode(m[1])).join(''));
    }
  }

  const workbook = await zip.file('xl/workbook.xml').async('string');
  const rels = await zip.file('xl/_rels/workbook.xml.rels').async('string');
  const relMap = new Map([...rels.matchAll(/<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)].map((m) => [m[1], m[2]]));
  const sheetMatch = /<sheet[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/.exec(workbook);
  const sheetName = decode(sheetMatch?.[1] || path.basename(file, '.xlsx'));
  const target = relMap.get(sheetMatch?.[2]);
  const sheetXml = await zip.file(`xl/${target.replace(/^\//, '').replace(/^xl\//, '')}`).async('string');

  const rows = [...sheetXml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map((rowMatch) => {
    const row = [];
    for (const cellMatch of rowMatch[1].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = cellMatch[1];
      const body = cellMatch[2];
      const ref = /r="([A-Z]+)\d+"/.exec(attrs)?.[1];
      const index = ref ? ref.split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1 : row.length;
      const type = /t="([^"]+)"/.exec(attrs)?.[1];
      let valueText = '';
      if (type === 's') {
        const sharedIndex = /<v>(.*?)<\/v>/.exec(body)?.[1];
        valueText = sharedIndex == null ? '' : shared[Number(sharedIndex)] ?? '';
      } else if (type === 'inlineStr') {
        valueText = [...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => decode(m[1])).join('');
      } else {
        valueText = decode(/<v>(.*?)<\/v>/.exec(body)?.[1] ?? '');
      }
      row[index] = valueText.trim();
    }
    return row;
  });

  return { sheetName, rows };
}

function parseBoard(file, sheetName, rows) {
  const mainItems = [];
  const columnMap = new Map();
  let headers = null;
  let subHeaders = null;
  let group = null;
  let parent = null;

  function addColumns(nextHeaders) {
    for (const header of nextHeaders) {
      if (!validText(header.raw)) continue;
      if (['name', 'subitems', 'subelementos'].includes(norm(header.raw))) continue;
      if (!columnMap.has(header.prefixedName)) columnMap.set(header.prefixedName, header.prefixedName);
    }
  }

  for (const row of rows) {
    const nonEmpty = row.filter(Boolean).length;
    const first = clean(row[0]);
    if (!nonEmpty || /try it free|monday\.com/i.test(first)) continue;

    if (first === 'Name') {
      headers = uniqueHeaders(row);
      addColumns(headers);
      subHeaders = null;
      continue;
    }

    if (/^Subitems$|^Subelementos$/i.test(first)) {
      subHeaders = uniqueHeaders(row, 'Subitem: ');
      addColumns(subHeaders);
      continue;
    }

    if (!headers) {
      if (first && nonEmpty <= 2) group = first;
      continue;
    }

    if (first && nonEmpty <= 1) {
      group = first;
      subHeaders = null;
      parent = null;
      continue;
    }

    if (subHeaders && !first && parent) {
      const values = rowObject(subHeaders, row);
      const title = values[norm('Subitem: Name')] || values[norm('Name')] || row[1] || '';
      if (validText(title)) {
        parent.subitems.push({ file, sheetName, group, title: clean(title), values, headers: subHeaders, isBlockSubitem: true });
      }
      continue;
    }

    if (!first || !validText(first)) continue;
    const values = rowObject(headers, row);
    const subelementColumn = values.subelementos || values.subitems || '';
    const item = { file, sheetName, group, title: first, values, headers, subitems: [] };

    if (validText(subelementColumn)) {
      let existing = mainItems.find((candidate) => candidate.title === first && candidate.group === group);
      if (!existing) {
        existing = { ...item, values: { ...values, subelementos: '', subitems: '' }, subitems: [] };
        mainItems.push(existing);
      }
      existing.subitems.push({
        file,
        sheetName,
        group,
        title: clean(subelementColumn),
        values,
        headers,
        isColumnSubitem: true,
      });
      parent = existing;
    } else {
      mainItems.push(item);
      parent = item;
    }
  }

  return { mainItems, columns: [...columnMap.keys()] };
}

function taskFromItem(projectId, item, position, parentTaskId = null) {
  const statusSource = value(item, 'Status', 'Status - Prod. Interna', 'Status - Prod. Terceirizada', 'Lançamento', 'Lancamento');
  const prioritySource = value(item, 'Prioridade');
  const startDate = firstStartDate(item);
  const dueDate = firstDate(item, !!parentTaskId);
  const ticket = value(item, 'Número Ticket', 'Numero Ticket', 'Protocolo');
  return {
    project_id: projectId,
    title: item.title,
    description: noteFromItem(item, [
      ['Origem', parentTaskId ? 'Subelemento importado do Excel' : 'Elemento importado do Excel'],
      ['Status original', statusSource],
      ['Prioridade original', prioritySource],
    ]),
    status: mapStatus(statusSource),
    priority: mapPriority(prioritySource),
    start_date: startDate,
    due_date: dueDate,
    ticket_number: ticket || null,
    parent_task_id: parentTaskId,
    position,
    created_by: globalThis.USER_ID,
  };
}

function customValuesFor(item, columnIdByName, taskId) {
  const values = [];
  for (const header of item.headers) {
    if (!validText(header.raw)) continue;
    if (['name', 'subitems', 'subelementos'].includes(norm(header.raw))) continue;
    const columnId = columnIdByName.get(header.prefixedName);
    const cell = clean(item.values[header.key]);
    if (columnId && cell) values.push({ task_id: taskId, column_id: columnId, value: cell });
  }
  return values;
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

async function refreshAuth(refreshToken) {
  const res = await fetch(`${BASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!res.ok) throw new Error(`Auth refresh failed: ${res.status} ${await res.text()}`);
  return res.json();
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
  const res = await fetch(`${BASE_URL}/rest/v1/${table}${params ? `?${params}` : ''}`, {
    method: options.method || 'GET',
    headers: headers(options.prefer),
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) throw new Error(`${options.method || 'GET'} ${table}: ${res.status} ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

async function countRows(table, params = '') {
  const res = await fetch(`${BASE_URL}/rest/v1/${table}?select=id${params ? `&${params}` : ''}`, {
    headers: {
      ...headers('count=exact'),
      Range: '0-0',
    },
  });
  if (!res.ok) throw new Error(`COUNT ${table}: ${res.status} ${await res.text()}`);
  return Number((res.headers.get('content-range') || '/0').split('/').pop());
}

async function countTaskAssigneesByProjects(projectIds) {
  const res = await fetch(
    `${BASE_URL}/rest/v1/task_assignees?select=id,tasks!inner(project_id)&tasks.project_id=in.(${projectIds.join(',')})`,
    {
      headers: {
        ...headers('count=exact'),
        Range: '0-0',
      },
    },
  );
  if (!res.ok) throw new Error(`COUNT task_assignees: ${res.status} ${await res.text()}`);
  return Number((res.headers.get('content-range') || '/0').split('/').pop());
}

async function insertBatch(table, rows, batchSize = 100) {
  const out = [];
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    if (!batch.length) continue;
    out.push(...await rest(table, '', { method: 'POST', body: batch }));
  }
  return out;
}

async function ensureProjectMembers(projectId, userIds) {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  for (const userId of uniqueUserIds) {
    try {
      await rest('project_members', '', {
        method: 'POST',
        body: [{ project_id: projectId, user_id: userId, role: userId === globalThis.USER_ID ? 'owner' : 'member' }],
      });
    } catch (error) {
      if (!String(error.message).includes('project_members_project_id_user_id_key')) throw error;
    }
  }
}

async function buildImports() {
  const files = (await fs.readdir(ROOT)).filter((file) => /\.xlsx$/i.test(file)).sort();
  const projects = [];
  for (const file of files) {
    const { sheetName, rows } = await readXlsxRows(file);
    const parsed = parseBoard(file, sheetName, rows);
    const suffix = /_(\d{10,})\.xlsx$/i.exec(file)?.[1];
    const name = `Excel | ${sheetName}${suffix ? ` (${suffix})` : ''}`;
    projects.push({ file, sheetName, name, ...parsed });
  }
  return projects;
}

async function deletePreviousImports() {
  const previous = await rest('projects', `select=id,name,description&organization_id=eq.${ORG_ID}`);
  const imports = previous.filter((project) => clean(project.description).includes(IMPORT_MARKER));
  for (const project of imports) await rest('projects', `id=eq.${project.id}`, { method: 'DELETE' });
  return imports.length;
}

async function loadOrgProfiles() {
  const members = await rest('organization_members', `select=user_id&organization_id=eq.${ORG_ID}`);
  const ids = [...new Set(members.map((member) => member.user_id).filter(Boolean))];
  if (!ids.length) return [];
  return rest('profiles', `select=id,full_name,email&id=in.(${ids.join(',')})`);
}

async function loadAssignableProfiles() {
  const profiles = await rest('profiles', 'select=id,full_name,email');
  return profiles.filter((profile) => profile.id && (validText(profile.full_name) || validText(profile.email)));
}

function buildPeopleMatcher(profiles) {
  const map = new Map();
  const firstNameCounts = new Map();
  for (const profile of profiles) {
    for (const key of [profile.full_name, profile.email, String(profile.email || '').split('@')[0]]) {
      const normalized = norm(key);
      if (normalized && !map.has(normalized)) map.set(normalized, profile);
    }
    const firstName = tokens(profile.full_name)[0];
    if (firstName) firstNameCounts.set(firstName, (firstNameCounts.get(firstName) || 0) + 1);
  }
  return { exact: map, profiles, firstNameCounts };
}

function tokens(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3);
}

function resolvePerson(person, matcher) {
  const exact = matcher.exact.get(norm(person));
  if (exact) return exact;

  if (/deleted|excluido|membro/i.test(person)) return null;

  const sourceTokens = new Set(tokens(person));
  if (!sourceTokens.size) return null;

  for (const profile of matcher.profiles) {
    const profileTokens = tokens(profile.full_name);
    if (profileTokens.length >= 2 && profileTokens.every((token) => sourceTokens.has(token))) return profile;
  }

  const firstName = [...sourceTokens][0];
  if (firstName && matcher.firstNameCounts.get(firstName) === 1) {
    return matcher.profiles.find((profile) => tokens(profile.full_name)[0] === firstName) || null;
  }

  return null;
}

function matchedPeople(item, peopleMatcher) {
  const matches = [];
  const unmatched = [];
  for (const person of peopleFromItem(item)) {
    const profile = resolvePerson(person, peopleMatcher);
    if (profile) matches.push({ source: person, profile });
    else unmatched.push(person);
  }
  return { matches, unmatched };
}

async function buildPeopleReport(imports) {
  const profiles = await loadAssignableProfiles();
  const matcher = buildPeopleMatcher(profiles);
  const found = new Map();
  const matched = new Map();
  const unmatched = new Map();

  function add(map, key, context) {
    if (!map.has(key)) map.set(key, { name: key, count: 0, examples: [] });
    const entry = map.get(key);
    entry.count += 1;
    if (entry.examples.length < 3) entry.examples.push(context);
  }

  for (const project of imports) {
    for (const item of project.mainItems) {
      const context = `${project.file} > ${item.title}`;
      for (const person of peopleFromItem(item)) add(found, person, context);
      const itemPeople = matchedPeople(item, matcher);
      for (const match of itemPeople.matches) add(matched, match.profile.full_name || match.profile.email || match.profile.id, context);
      for (const person of itemPeople.unmatched) add(unmatched, person, context);
      for (const subitem of item.subitems) {
        const subContext = `${project.file} > ${item.title} > ${subitem.title}`;
        for (const person of peopleFromItem(subitem)) add(found, person, subContext);
        const subPeople = matchedPeople(subitem, matcher);
        for (const match of subPeople.matches) add(matched, match.profile.full_name || match.profile.email || match.profile.id, subContext);
        for (const person of subPeople.unmatched) add(unmatched, person, subContext);
      }
    }
  }

  return {
    assignableProfiles: profiles.length,
    sourcePeople: found.size,
    matchedPeople: matched.size,
    unmatchedPeople: unmatched.size,
    matched: [...matched.values()].sort((a, b) => b.count - a.count),
    unmatched: [...unmatched.values()].sort((a, b) => b.count - a.count),
  };
}

async function verifyImport() {
  const projects = (await rest('projects', 'select=id,name,description&description=like.*sunday-excel-import*'))
    .filter((project) => clean(project.description).includes(IMPORT_MARKER));
  const projectIds = projects.map((project) => project.id);
  if (!projectIds.length) {
    return {
      importedProjects: 0,
      tasks: 0,
      topLevelTasks: 0,
      subtasks: 0,
      projectColumns: 0,
      customValues: 0,
      sampleProjects: [],
    };
  }

  const projectFilter = `project_id=in.(${projectIds.join(',')})`;
  const taskCount = await countRows('tasks', projectFilter);
  const topLevelTaskCount = await countRows('tasks', `${projectFilter}&parent_task_id=is.null`);
  const subtaskCount = await countRows('tasks', `${projectFilter}&parent_task_id=not.is.null`);
  const columnCount = await countRows('project_columns', projectFilter);
  const columns = await rest('project_columns', `select=id&${projectFilter}`);
  const valueCount = columns.length
    ? await countRows('task_custom_values', `column_id=in.(${columns.map((column) => column.id).join(',')})`)
    : 0;
  const assigneeCount = await countTaskAssigneesByProjects(projectIds);

  return {
    importedProjects: projects.length,
    tasks: taskCount,
    topLevelTasks: topLevelTaskCount,
    subtasks: subtaskCount,
    projectColumns: columnCount,
    taskAssignees: assigneeCount,
    customValues: valueCount,
    sampleProjects: projects.slice(0, 5).map((project) => project.name),
  };
}

async function importProject(project, index, peopleMatcher) {
  const [created] = await rest('projects', '', {
    method: 'POST',
    body: [{
      name: project.name,
      description: `${IMPORT_MARKER}\nArquivo: ${project.file}\nAba: ${project.sheetName}`,
      color: COLORS[index % COLORS.length],
      organization_id: ORG_ID,
      created_by: globalThis.USER_ID,
    }],
  });

  const columns = project.columns.slice(0, 80).map((name, position) => ({
    project_id: created.id,
    name,
    column_type: inferColumnType(name),
    position,
    width: 150,
  }));
  const insertedColumns = await insertBatch('project_columns', columns);
  const columnIdByName = new Map(insertedColumns.map((column) => [column.name, column.id]));

  const parentRows = project.mainItems.map((item, position) => taskFromItem(created.id, item, position));
  const parents = await insertBatch('tasks', parentRows);
  const values = [];
  const taskAssignees = [];
  const projectMemberIds = new Set([globalThis.USER_ID]);

  function addTaskAssignees(taskId, item) {
    const seen = new Set();
    for (const match of matchedPeople(item, peopleMatcher).matches) {
      if (seen.has(match.profile.id)) continue;
      seen.add(match.profile.id);
      projectMemberIds.add(match.profile.id);
      taskAssignees.push({ task_id: taskId, user_id: match.profile.id });
    }
  }

  for (let i = 0; i < project.mainItems.length; i++) {
    const item = project.mainItems[i];
    const parent = parents[i];
    values.push(...customValuesFor(item, columnIdByName, parent.id));
    addTaskAssignees(parent.id, item);

    const subtasks = item.subitems.map((subitem, position) => taskFromItem(created.id, subitem, position, parent.id));
    const insertedSubtasks = await insertBatch('tasks', subtasks);
    for (let j = 0; j < item.subitems.length; j++) {
      values.push(...customValuesFor(item.subitems[j], columnIdByName, insertedSubtasks[j].id));
      addTaskAssignees(insertedSubtasks[j].id, item.subitems[j]);
    }
  }

  await ensureProjectMembers(created.id, [...projectMemberIds]);
  await insertBatch('task_assignees', taskAssignees, 250);
  await insertBatch('task_custom_values', values, 250);

  return {
    project: created.name,
    tasks: parentRows.length,
    subtasks: project.mainItems.reduce((sum, item) => sum + item.subitems.length, 0),
    columns: insertedColumns.length,
    assignees: taskAssignees.length,
    projectMembers: projectMemberIds.size,
    customValues: values.length,
  };
}

function inferColumnType(name) {
  const n = norm(name);
  if (n.includes('data') || n.includes('date') || n.includes('prazo') || n.includes('cronograma')) return 'texto';
  if (n.includes('status') || n.includes('aprov') || n.includes('feito')) return 'texto';
  if (n.includes('respons') || n.includes('owner') || n.includes('pessoa') || n.includes('person')) return 'texto';
  if (n.includes('numero') || n.includes('numeros') || n.includes('valor') || n.includes('qt') || n.includes('faturamento') || n.includes('clique') || n.includes('abertura')) return 'texto';
  return 'texto';
}

async function main() {
  const auth = await loadAuth();
  globalThis.TOKEN = auth.access_token;
  globalThis.USER_ID = auth.user.id;

  const imports = await buildImports();
  if (PEOPLE_REPORT) {
    console.log(JSON.stringify(await buildPeopleReport(imports), null, 2));
    return;
  }

  if (VERIFY) {
    console.log(JSON.stringify(await verifyImport(), null, 2));
    return;
  }

  const summary = {
    write: WRITE,
    projects: imports.length,
    tasks: imports.reduce((sum, project) => sum + project.mainItems.length, 0),
    subtasks: imports.reduce((sum, project) => sum + project.mainItems.reduce((inner, item) => inner + item.subitems.length, 0), 0),
    columns: imports.reduce((sum, project) => sum + Math.min(project.columns.length, 80), 0),
    files: imports.map((project) => ({
      file: project.file,
      project: project.name,
      tasks: project.mainItems.length,
      subtasks: project.mainItems.reduce((sum, item) => sum + item.subitems.length, 0),
      columns: Math.min(project.columns.length, 80),
    })),
  };
  console.log(JSON.stringify(summary, null, 2));

  if (!WRITE) {
    console.log('\nDry-run only. Re-run with --yes to delete previous Excel imports and populate Sunday.');
    return;
  }

  const peopleMatcher = buildPeopleMatcher(await loadAssignableProfiles());
  const deleted = await deletePreviousImports();
  console.log(`\nDeleted previous imported Sunday projects: ${deleted}`);

  const results = [];
  for (let i = 0; i < imports.length; i++) {
    results.push(await importProject(imports[i], i, peopleMatcher));
    console.log(`Imported ${imports[i].name}`);
  }

  console.log('\nImport completed.');
  console.log(JSON.stringify({
    projects: results.length,
    tasks: results.reduce((sum, item) => sum + item.tasks, 0),
    subtasks: results.reduce((sum, item) => sum + item.subtasks, 0),
    columns: results.reduce((sum, item) => sum + item.columns, 0),
    assignees: results.reduce((sum, item) => sum + item.assignees, 0),
    projectMembers: results.reduce((sum, item) => sum + item.projectMembers, 0),
    customValues: results.reduce((sum, item) => sum + item.customValues, 0),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
