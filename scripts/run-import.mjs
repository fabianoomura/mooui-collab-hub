/**
 * Import Monday.com data into Supabase via REST API.
 * Reads generated/monday-import.sql, parses the VALUES blocks,
 * and inserts via authenticated REST calls.
 *
 * Usage: node scripts/run-import.mjs
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const BASE_URL = 'https://rckglywohrywurknephc.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJja2dseXdvaHJ5d3Vya25lcGhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxOTIyNzUsImV4cCI6MjA5MTc2ODI3NX0.tE1xWUmVQiiC3FPVRh8BN3j0_p5tYQzkrNRqDtW2vZw';
const ORG_ID = '0d32934f-9628-4bd5-b3f4-1bc74f9227de';

// Read auth token from file
const authFile = path.join(process.cwd(), 'generated', '.auth.json');
const auth = JSON.parse(await fs.readFile(authFile, 'utf8'));
const TOKEN = auth.access_token;
const USER_ID = auth.user.id;

console.log(`Authenticated as ${auth.user.email} (${USER_ID})`);

async function supaRest(table, method, body, params = '') {
  const url = `${BASE_URL}/rest/v1/${table}${params}`;
  const headers = {
    'apikey': ANON_KEY,
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
    'Prefer': method === 'POST' ? 'return=representation' : 'return=minimal',
  };
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${method} ${table}: ${res.status} ${err}`);
  }
  if (method === 'POST' || method === 'GET') return res.json();
  return null;
}

async function getExisting(table, selectCols = 'id') {
  return supaRest(table, 'GET', null, `?select=${selectCols}&organization_id=eq.${ORG_ID}`);
}

async function insertBatch(table, rows, batchSize = 50) {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    try {
      await supaRest(table, 'POST', batch);
      inserted += batch.length;
    } catch (e) {
      // Try one by one on batch failure
      for (const row of batch) {
        try {
          await supaRest(table, 'POST', row);
          inserted++;
        } catch (e2) {
          console.warn(`  SKIP ${table}: ${e2.message.slice(0, 120)}`);
        }
      }
    }
  }
  return inserted;
}

// ============================================================
// 1. PRODUTOS
// ============================================================
console.log('\n=== PRODUTOS ===');
const existingProdutos = await getExisting('produtos', 'id,name');
console.log(`  Existing: ${existingProdutos.length}`);

const produtosFile = await fs.readFile(path.join(process.cwd(), 'generated', 'monday-import.sql'), 'utf8');

// Parse produtos from SQL
function parseProdutos(sql) {
  const match = sql.match(/insert into public\.produtos.*?\nfrom \(values\n([\s\S]*?)\n\) as v\(/);
  if (!match) return [];
  const valuesBlock = match[1];
  const rows = [];
  // Split by each value tuple
  const tuples = valuesBlock.split(/\n  \(v_org_id, v_created_by, /);
  for (const t of tuples) {
    if (!t.trim()) continue;
    const clean = t.replace(/\),$/, '').replace(/\)$/, '');
    // Parse: 'name', 'collection_group', null, null, null, null, 'observations'
    const parts = parseValueTuple(clean);
    if (parts.length >= 7) {
      rows.push({
        organization_id: ORG_ID,
        created_by: USER_ID,
        name: parts[0],
        collection_group: parts[1],
        responsible: parts[2],
        launch_target: parts[3],
        cronograma_start: parts[4],
        cronograma_end: parts[5],
        observations: parts[6] || null,
      });
    }
  }
  return rows;
}

function parseValueTuple(str) {
  const parts = [];
  let i = 0;
  while (i < str.length) {
    // Skip whitespace and commas
    while (i < str.length && (str[i] === ' ' || str[i] === ',' || str[i] === '\t')) i++;
    if (i >= str.length) break;
    if (str.substring(i, i + 4) === 'null') {
      parts.push(null);
      i += 4;
    } else if (str[i] === "'") {
      // Find closing quote (handle escaped quotes '')
      let val = '';
      i++; // skip opening quote
      while (i < str.length) {
        if (str[i] === "'" && str[i + 1] === "'") {
          val += "'";
          i += 2;
        } else if (str[i] === "'") {
          i++; // skip closing quote
          break;
        } else {
          val += str[i];
          i++;
        }
      }
      parts.push(val);
    } else {
      // Read until comma
      let val = '';
      while (i < str.length && str[i] !== ',') {
        val += str[i];
        i++;
      }
      parts.push(val.trim() || null);
    }
  }
  return parts;
}

const existingNames = new Set(existingProdutos.map(p => p.name));
const produtoRows = parseProdutos(produtosFile).filter(r => !existingNames.has(r.name));
console.log(`  To insert: ${produtoRows.length}`);
if (produtoRows.length > 0) {
  const count = await insertBatch('produtos', produtoRows);
  console.log(`  Inserted: ${count}`);
}

// Refresh produtos with IDs
const allProdutos = await getExisting('produtos', 'id,name');
const produtoMap = new Map(allProdutos.map(p => [p.name, p.id]));
console.log(`  Total produtos: ${allProdutos.length}`);

// ============================================================
// 2. PRODUTO DESIGN ITEMS
// ============================================================
console.log('\n=== PRODUTO DESIGN ITEMS ===');
function parseProdutoDesignItems(sql) {
  const match = sql.match(/insert into public\.produto_design_items.*?\nfrom \(values\n([\s\S]*?)\n\) as v\(/);
  if (!match) return [];
  const block = match[1];
  const rows = [];
  // Each line: (v_org_id, v_created_by, 'ProdName', 'ItemName', 'status', 'date'/'null', position)
  const lines = block.split('\n');
  for (const line of lines) {
    const m = line.match(/v_org_id,\s*v_created_by,\s*'((?:[^']|'')*)',\s*'((?:[^']|'')*)',\s*'((?:[^']|'')*)',\s*(null|'[^']*'),\s*(\d+)/);
    if (m) {
      const prodName = m[1].replace(/''/g, "'");
      const itemName = m[2].replace(/''/g, "'");
      const status = m[3];
      const targetDate = m[4] === 'null' ? null : m[4].replace(/'/g, '');
      const position = parseInt(m[5]);
      const prodId = produtoMap.get(prodName);
      if (prodId) {
        rows.push({ produto_id: prodId, name: itemName, status, target_date: targetDate, position });
      }
    }
  }
  return rows;
}

const designItems = parseProdutoDesignItems(produtosFile);
console.log(`  Parsed: ${designItems.length}`);
if (designItems.length > 0) {
  const count = await insertBatch('produto_design_items', designItems);
  console.log(`  Inserted: ${count}`);
}

// ============================================================
// 3. SESSOES
// ============================================================
console.log('\n=== SESSOES ===');
function parseSessoes(sql) {
  const match = sql.match(/insert into public\.sessoes.*?\nfrom \(values\n([\s\S]*?)\n\) as v\(/);
  if (!match) return [];
  const rows = [];
  const tuples = match[1].split(/\n  \(v_org_id, v_created_by, /);
  for (const t of tuples) {
    if (!t.trim()) continue;
    const clean = t.replace(/\),?\s*$/, '');
    const parts = parseValueTuple(clean);
    if (parts.length >= 5) {
      rows.push({
        organization_id: ORG_ID,
        created_by: USER_ID,
        title: parts[0],
        scheduled_date: parts[1],
        professional: parts[2],
        status: parts[3],
        notes: parts[4] || null,
      });
    }
  }
  return rows;
}

const existingSessoes = await getExisting('sessoes', 'id,title');
const existingSessTitles = new Set(existingSessoes.map(s => s.title));
const sessaoRows = parseSessoes(produtosFile).filter(r => !existingSessTitles.has(r.title));
console.log(`  Existing: ${existingSessoes.length}, To insert: ${sessaoRows.length}`);
if (sessaoRows.length > 0) {
  const count = await insertBatch('sessoes', sessaoRows);
  console.log(`  Inserted: ${count}`);
}

// Refresh sessoes
const allSessoes = await getExisting('sessoes', 'id,title,scheduled_date');
const sessaoMap = new Map(allSessoes.map(s => [s.title, s.id]));

// ============================================================
// 4. SESSAO SHOTS
// ============================================================
console.log('\n=== SESSAO SHOTS ===');
function parseSessaoShots(sql) {
  const match = sql.match(/insert into public\.sessao_shots.*?\nfrom \(values\n([\s\S]*?)\n\) as v\(/);
  if (!match) return [];
  const rows = [];
  const lines = match[1].split('\n');
  for (const line of lines) {
    // (v_org_id, v_created_by, 'SessaoTitle', 'ShotDate', 'ShotTitle', 'tipo', 'status', 'local', 'funil', 'content_type', 'modelo', 'data_entrega'|null, position)
    const m = line.match(/v_org_id,\s*v_created_by,\s*'((?:[^']|'')*)',\s*'([^']*)',\s*'((?:[^']|'')*)',\s*'([^']*)',\s*'([^']*)',\s*(null|'(?:[^']|'')*'),\s*(null|'(?:[^']|'')*'),\s*(null|'(?:[^']|'')*'),\s*(null|'(?:[^']|'')*'),\s*(null|'[^']*'),\s*(\d+)/);
    if (m) {
      const sessTitle = m[1].replace(/''/g, "'");
      const sessId = sessaoMap.get(sessTitle);
      if (sessId) {
        rows.push({
          sessao_id: sessId,
          title: m[3].replace(/''/g, "'"),
          tipo: m[4],
          status: m[5],
          local: m[6] === 'null' ? null : m[6].replace(/'/g, ''),
          funil: m[7] === 'null' ? null : m[7].replace(/'/g, ''),
          content_type: m[8] === 'null' ? null : m[8].replace(/'/g, ''),
          modelo: m[9] === 'null' ? null : m[9].replace(/'/g, ''),
          data_entrega: m[10] === 'null' ? null : m[10].replace(/'/g, ''),
          position: parseInt(m[11]),
        });
      }
    }
  }
  return rows;
}

const shotRows = parseSessaoShots(produtosFile);
console.log(`  Parsed: ${shotRows.length}`);
if (shotRows.length > 0) {
  const count = await insertBatch('sessao_shots', shotRows);
  console.log(`  Inserted: ${count}`);
}

// ============================================================
// 5. MELHORIAS
// ============================================================
console.log('\n=== MELHORIAS ===');
function parseMelhorias(sql) {
  const match = sql.match(/insert into public\.melhorias.*?\nfrom \(values\n([\s\S]*?)\n\) as v\(/);
  if (!match) return [];
  const rows = [];
  const tuples = match[1].split(/\n  \(v_org_id, v_created_by, /);
  for (const t of tuples) {
    if (!t.trim()) continue;
    const clean = t.replace(/\),?\s*$/, '');
    const parts = parseValueTuple(clean);
    if (parts.length >= 8) {
      rows.push({
        organization_id: ORG_ID,
        created_by: USER_ID,
        title: parts[0],
        description: parts[1],
        area: parts[2],
        status: parts[3],
        priority: parts[4],
        assigned_to: parts[5],
        data_abertura: parts[6] === 'current_date' ? new Date().toISOString().split('T')[0] : parts[6],
        data_conclusao: parts[7],
      });
    }
  }
  return rows;
}

const existingMelhorias = await getExisting('melhorias', 'id,title');
const existingMelTitles = new Set(existingMelhorias.map(m => m.title));
const melhoriaRows = parseMelhorias(produtosFile).filter(r => !existingMelTitles.has(r.title));
console.log(`  Existing: ${existingMelhorias.length}, To insert: ${melhoriaRows.length}`);
if (melhoriaRows.length > 0) {
  const count = await insertBatch('melhorias', melhoriaRows);
  console.log(`  Inserted: ${count}`);
}

// ============================================================
// 6. CONTEUDO (check what marketing already populated)
// ============================================================
console.log('\n=== CONTEUDO ITEMS (check) ===');
const existingConteudo = await getExisting('conteudo_items', 'id,title');
console.log(`  Existing: ${existingConteudo.length}`);

// Parse and insert missing
function parseConteudoItems(sql) {
  const match = sql.match(/insert into public\.conteudo_items.*?\nfrom \(values\n([\s\S]*?)\n\) as v\(/);
  if (!match) return [];
  const rows = [];
  const tuples = match[1].split(/\n  \(v_org_id, v_created_by, /);
  for (const t of tuples) {
    if (!t.trim()) continue;
    const clean = t.replace(/\),?\s*$/, '');
    const parts = parseValueTuple(clean);
    if (parts.length >= 11) {
      rows.push({
        organization_id: ORG_ID,
        created_by: USER_ID,
        title: parts[0],
        channel: parts[1],
        scheduled_date: parts[2],
        time_slot: parts[3],
        status: parts[4],
        content_type: parts[5],
        is_repost: parts[6] === 'true',
        content_category: parts[7],
        photo_url: parts[8],
        assigned_to: parts[9],
        notes: parts[10] || null,
      });
    }
  }
  return rows;
}

const existingConteudoTitles = new Set(existingConteudo.map(c => c.title));
const conteudoRows = parseConteudoItems(produtosFile).filter(r => !existingConteudoTitles.has(r.title));
console.log(`  To insert: ${conteudoRows.length}`);
if (conteudoRows.length > 0) {
  const count = await insertBatch('conteudo_items', conteudoRows);
  console.log(`  Inserted: ${count}`);
}

// ============================================================
// 7. NEWSLETTERS
// ============================================================
console.log('\n=== NEWSLETTERS ===');
const existingNL = await getExisting('newsletters', 'id,title');
console.log(`  Existing: ${existingNL.length}`);

function parseNewsletters(sql) {
  const match = sql.match(/insert into public\.newsletters.*?\nfrom \(values\n([\s\S]*?)\n\) as v\(/);
  if (!match) return [];
  const rows = [];
  const tuples = match[1].split(/\n  \(v_org_id, v_created_by, /);
  for (const t of tuples) {
    if (!t.trim()) continue;
    const clean = t.replace(/\),?\s*$/, '');
    const parts = parseValueTuple(clean);
    if (parts.length >= 11) {
      rows.push({
        organization_id: ORG_ID,
        created_by: USER_ID,
        title: parts[0],
        scheduled_date: parts[1],
        status: parts[2],
        tema: parts[3],
        base: parts[4],
        hora: parts[5],
        titulo_email: parts[6],
        open_rate: parts[7] ? parseFloat(parts[7]) : null,
        click_rate: parts[8] ? parseFloat(parts[8]) : null,
        channel: parts[9],
        notes: parts[10] || null,
      });
    }
  }
  return rows;
}

const existingNLTitles = new Set(existingNL.map(n => n.title));
const nlRows = parseNewsletters(produtosFile).filter(r => !existingNLTitles.has(r.title));
console.log(`  To insert: ${nlRows.length}`);
if (nlRows.length > 0) {
  const count = await insertBatch('newsletters', nlRows);
  console.log(`  Inserted: ${count}`);
}

// ============================================================
// 8. PAUTAS
// ============================================================
console.log('\n=== PAUTAS ===');
const existingPautas = await getExisting('pautas', 'id,title');
console.log(`  Existing: ${existingPautas.length}`);

function parsePautas(sql) {
  const match = sql.match(/insert into public\.pautas.*?\nfrom \(values\n([\s\S]*?)\n\) as v\(/);
  if (!match) return [];
  const rows = [];
  const tuples = match[1].split(/\n  \(v_org_id, v_created_by, /);
  for (const t of tuples) {
    if (!t.trim()) continue;
    const clean = t.replace(/\),?\s*$/, '');
    const parts = parseValueTuple(clean);
    if (parts.length >= 6) {
      rows.push({
        organization_id: ORG_ID,
        created_by: USER_ID,
        title: parts[0],
        assigned_to: parts[1],
        priority: parts[2],
        status: parts[3],
        scheduled_date: parts[4],
        notes: parts[5] || null,
      });
    }
  }
  return rows;
}

const existingPautaTitles = new Set(existingPautas.map(p => p.title));
const pautaRows = parsePautas(produtosFile).filter(r => !existingPautaTitles.has(r.title));
console.log(`  To insert: ${pautaRows.length}`);
if (pautaRows.length > 0) {
  const count = await insertBatch('pautas', pautaRows);
  console.log(`  Inserted: ${count}`);
}

// Refresh pautas for items
const allPautas = await getExisting('pautas', 'id,title');
const pautaMap = new Map(allPautas.map(p => [p.title, p.id]));

// ============================================================
// 9. PAUTA ITEMS
// ============================================================
console.log('\n=== PAUTA ITEMS ===');
function parsePautaItems(sql) {
  const match = sql.match(/insert into public\.pauta_items.*?\nfrom \(values\n([\s\S]*?)\n\) as v\(/);
  if (!match) return [];
  const rows = [];
  const lines = match[1].split('\n');
  for (const line of lines) {
    const m = line.match(/v_org_id,\s*v_created_by,\s*'((?:[^']|'')*)',\s*'((?:[^']|'')*)',\s*'([^']*)',\s*(null|'[^']*'),\s*(\d+)/);
    if (m) {
      const pautaTitle = m[1].replace(/''/g, "'");
      const pautaId = pautaMap.get(pautaTitle);
      if (pautaId) {
        rows.push({
          pauta_id: pautaId,
          title: m[2].replace(/''/g, "'"),
          status: m[3],
          assigned_to: m[4] === 'null' ? null : m[4].replace(/'/g, ''),
          position: parseInt(m[5]),
        });
      }
    }
  }
  return rows;
}

const pautaItemRows = parsePautaItems(produtosFile);
console.log(`  Parsed: ${pautaItemRows.length}`);
if (pautaItemRows.length > 0) {
  const count = await insertBatch('pauta_items', pautaItemRows);
  console.log(`  Inserted: ${count}`);
}

// ============================================================
// 10. ANNUAL EVENTS
// ============================================================
console.log('\n=== ANNUAL EVENTS ===');
function parseAnnualEvents(sql) {
  const match = sql.match(/insert into public\.annual_events.*?\nfrom \(values\n([\s\S]*?)\n\) as v\(/);
  if (!match) return [];
  const rows = [];
  const tuples = match[1].split(/\n  \(v_org_id, v_created_by, /);
  for (const t of tuples) {
    if (!t.trim()) continue;
    const clean = t.replace(/\),?\s*$/, '');
    const parts = parseValueTuple(clean);
    if (parts.length >= 6) {
      rows.push({
        organization_id: ORG_ID,
        created_by: USER_ID,
        title: parts[0],
        description: parts[1],
        category: parts[2],
        color: parts[3],
        start_date: parts[4],
        end_date: parts[5],
      });
    }
  }
  return rows;
}

const existingEvents = await supaRest('annual_events', 'GET', null, `?select=id,title,start_date&organization_id=eq.${ORG_ID}`);
const existingEventKeys = new Set(existingEvents.map(e => `${e.title}|${e.start_date}`));
const eventRows = parseAnnualEvents(produtosFile).filter(r => !existingEventKeys.has(`${r.title}|${r.start_date}`));
console.log(`  Existing: ${existingEvents.length}, To insert: ${eventRows.length}`);
if (eventRows.length > 0) {
  const count = await insertBatch('annual_events', eventRows);
  console.log(`  Inserted: ${count}`);
}

// ============================================================
// SUMMARY
// ============================================================
console.log('\n=== IMPORT COMPLETE ===');

// Final counts
const finals = {};
for (const table of ['produtos', 'produto_stages', 'produto_design_items', 'conteudo_items', 'newsletters', 'pautas', 'sessoes', 'sessao_shots', 'melhorias', 'annual_events']) {
  try {
    const data = await supaRest(table, 'GET', null, `?select=id&organization_id=eq.${ORG_ID}`);
    finals[table] = data.length;
  } catch {
    // Tables without org_id (child tables)
    try {
      const data = await supaRest(table, 'GET', null, `?select=id&limit=10000`);
      finals[table] = data.length;
    } catch { finals[table] = '?'; }
  }
}

console.log('\nFinal counts:');
for (const [t, c] of Object.entries(finals)) {
  console.log(`  ${t}: ${c}`);
}

// Clean up auth file
try { await fs.unlink(authFile); } catch {}
console.log('\nDone!');
