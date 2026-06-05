import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const ORG_ID = '0d32934f-9628-4bd5-b3f4-1bc74f9227de';
const BASE_URL = 'https://rckglywohrywurknephc.supabase.co';
const envText = await fs.readFile(path.join(ROOT, '.env'), 'utf8');
const ANON_KEY = /VITE_SUPABASE_PUBLISHABLE_KEY="([^"]+)"/.exec(envText)?.[1];
if (!ANON_KEY) throw new Error('Missing VITE_SUPABASE_PUBLISHABLE_KEY in .env');

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

function headers() {
  return {
    apikey: ANON_KEY,
    Authorization: `Bearer ${globalThis.TOKEN}`,
    'Content-Type': 'application/json',
  };
}

async function rest(table, params = '') {
  const res = await fetch(`${BASE_URL}/rest/v1/${table}${params ? `?${params}` : ''}`, { headers: headers() });
  if (!res.ok) throw new Error(`GET ${table} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

function clean(value) {
  return String(value ?? '').trim();
}

function norm(value) {
  return clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function classify(name) {
  const n = norm(name);
  if (n.includes('newsletter')) return 'newsletter';
  if (n.includes('marketing') && (n.includes('demanda') || n.includes('pauta'))) return 'demandas_marketing';
  if (n.includes('calendario') && (n.includes('foto') || n.includes('video'))) return 'fotos_videos';
  if (n.includes('conteudo') || n.includes('programacao') || n.includes('redes')) return 'programacao';
  if (n.includes('melhoria')) return 'melhorias';
  return 'outro';
}

async function count(table, params) {
  const res = await fetch(`${BASE_URL}/rest/v1/${table}?select=id&${params}`, {
    headers: { ...headers(), Prefer: 'count=exact' },
  });
  if (!res.ok) throw new Error(`COUNT ${table} failed: ${res.status} ${await res.text()}`);
  return Number(res.headers.get('content-range')?.split('/')?.[1] ?? 0);
}

const auth = await loadAuth();
globalThis.TOKEN = auth.access_token;

const projects = await rest('projects', `select=id,name,description&organization_id=eq.${ORG_ID}&order=name.asc`);
const rows = [];
for (const project of projects) {
  const taskCount = await count('tasks', `project_id=eq.${project.id}&parent_task_id=is.null`);
  const subCount = await count('tasks', `project_id=eq.${project.id}&parent_task_id=not.is.null`);
  rows.push({ class: classify(project.name), name: project.name, tasks: taskCount, subitems: subCount, id: project.id });
}

console.table(rows.filter((row) => row.class !== 'outro'));
console.log('\nOutros Sunday:');
console.table(rows.filter((row) => row.class === 'outro').map(({ class: _class, ...row }) => row));

const moduleCounts = {};
for (const table of ['conteudo_items', 'newsletters', 'pautas', 'pauta_items', 'sessoes', 'sessao_shots', 'melhorias', 'melhoria_subitems']) {
  moduleCounts[table] = await count(table, table === 'pauta_items' || table === 'sessao_shots' || table === 'melhoria_subitems' ? 'id=not.is.null' : `organization_id=eq.${ORG_ID}`);
}
console.log('\nTabelas proprias:');
console.table(moduleCounts);
