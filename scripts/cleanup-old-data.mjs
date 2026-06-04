/**
 * Cleanup old Monday.com imported data (before 2026).
 * Authenticates via email/password, then DELETEs via REST API.
 *
 * Usage: node scripts/cleanup-old-data.mjs
 */

const BASE_URL = 'https://rckglywohrywurknephc.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJja2dseXdvaHJ5d3Vya25lcGhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxOTIyNzUsImV4cCI6MjA5MTc2ODI3NX0.tE1xWUmVQiiC3FPVRh8BN3j0_p5tYQzkrNRqDtW2vZw';
const ORG_ID = '0d32934f-9628-4bd5-b3f4-1bc74f9227de';
const CUTOFF = '2026-01-01';

const email = process.argv[2];
const password = process.argv[3];
const autoConfirm = process.argv[4] === '--yes';

if (!email || !password) {
  console.error('Usage: node scripts/cleanup-old-data.mjs <email> <password> [--yes]');
  process.exit(1);
}

// ---- Auth ----
async function login(email, password) {
  const res = await fetch(`${BASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'apikey': ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// ---- REST helpers ----
function headers(token) {
  return {
    'apikey': ANON_KEY,
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };
}

async function countRows(token, table, filter) {
  const url = `${BASE_URL}/rest/v1/${table}?select=id&organization_id=eq.${ORG_ID}&${filter}`;
  const res = await fetch(url, { headers: headers(token) });
  if (!res.ok) throw new Error(`GET ${table}: ${res.status} ${await res.text()}`);
  return (await res.json()).length;
}

async function deleteRows(token, table, filter) {
  const url = `${BASE_URL}/rest/v1/${table}?organization_id=eq.${ORG_ID}&${filter}`;
  const res = await fetch(url, { method: 'DELETE', headers: headers(token) });
  if (!res.ok) throw new Error(`DELETE ${table}: ${res.status} ${await res.text()}`);
  return (await res.json()).length;
}

async function countTotal(token, table) {
  const url = `${BASE_URL}/rest/v1/${table}?select=id&organization_id=eq.${ORG_ID}`;
  const res = await fetch(url, { headers: headers(token) });
  if (!res.ok) return '?';
  return (await res.json()).length;
}

// ---- Main ----
console.log('\nAutenticando...');
const auth = await login(email, password);
const TOKEN = auth.access_token;
console.log(`OK — ${auth.user.email}\n`);

const tables = [
  { name: 'melhorias',      dateCol: 'data_abertura',  filter: `data_abertura=lt.${CUTOFF}` },
  { name: 'conteudo_items',  dateCol: 'scheduled_date', filter: `scheduled_date=lt.${CUTOFF}` },
  { name: 'newsletters',    dateCol: 'scheduled_date', filter: `scheduled_date=lt.${CUTOFF}` },
  { name: 'pautas',         dateCol: 'scheduled_date', filter: `scheduled_date=lt.${CUTOFF}` },
  { name: 'sessoes',        dateCol: 'scheduled_date', filter: `scheduled_date=lt.${CUTOFF}` },
  { name: 'annual_events',  dateCol: 'start_date',     filter: `start_date=lt.${CUTOFF}` },
];

// Preview
console.log('=== PREVIEW — registros a deletar (antes de 2026) ===\n');
for (const t of tables) {
  const count = await countRows(TOKEN, t.name, t.filter);
  const total = await countTotal(TOKEN, t.name);
  console.log(`  ${t.name}: ${count} de ${total} (${t.dateCol} < ${CUTOFF})`);
}

// Produtos: special filter (launch_target < 2026 OR (launch_target is null AND cronograma_end < 2026))
const prodFilter1 = `launch_target=lt.${CUTOFF}`;
const prodCount1 = await countRows(TOKEN, 'produtos', prodFilter1);
const prodFilter2 = `launch_target=is.null&cronograma_end=lt.${CUTOFF}`;
const prodCount2 = await countRows(TOKEN, 'produtos', prodFilter2);
const prodTotal = await countTotal(TOKEN, 'produtos');
console.log(`  produtos: ${prodCount1 + prodCount2} de ${prodTotal} (launch_target ou cronograma_end < ${CUTOFF})`);

if (!autoConfirm) {
  console.log('\nPara confirmar, rode com --yes no final.');
  process.exit(0);
}

// Execute deletes
console.log('\n=== DELETANDO ===\n');
for (const t of tables) {
  try {
    const deleted = await deleteRows(TOKEN, t.name, t.filter);
    console.log(`  ${t.name}: ${deleted} deletados`);
  } catch (e) {
    console.error(`  ${t.name}: ERRO — ${e.message}`);
  }
}

// Produtos in two passes
try {
  const d1 = await deleteRows(TOKEN, 'produtos', prodFilter1);
  const d2 = await deleteRows(TOKEN, 'produtos', prodFilter2);
  console.log(`  produtos: ${d1 + d2} deletados`);
} catch (e) {
  console.error(`  produtos: ERRO — ${e.message}`);
}

// Final counts
console.log('\n=== CONTAGEM FINAL ===\n');
for (const t of [...tables, { name: 'produtos' }]) {
  const remaining = await countTotal(TOKEN, t.name);
  console.log(`  ${t.name}: ${remaining} restantes`);
}

console.log('\nLimpeza concluida!');
