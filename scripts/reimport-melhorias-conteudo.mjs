/**
 * Re-import Melhorias + Conteúdo from Monday.com Excel files.
 * - Deletes existing data
 * - Parses Excel with subitems
 * - Inserts via REST API with user mapping
 *
 * Usage: node scripts/reimport-melhorias-conteudo.mjs <email> <password> [--yes]
 */

import XLSX from 'xlsx';
import path from 'node:path';

const BASE_URL = 'https://rckglywohrywurknephc.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJja2dseXdvaHJ5d3Vya25lcGhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxOTIyNzUsImV4cCI6MjA5MTc2ODI3NX0.tE1xWUmVQiiC3FPVRh8BN3j0_p5tYQzkrNRqDtW2vZw';
const ORG_ID = '0d32934f-9628-4bd5-b3f4-1bc74f9227de';
const CUTOFF = '2026-01-01';

const email = process.argv[2];
const password = process.argv[3];
const autoConfirm = process.argv.includes('--yes');

if (!email || !password) {
  console.error('Usage: node scripts/reimport-melhorias-conteudo.mjs <email> <password> [--yes]');
  process.exit(1);
}

// ---- Auth ----
async function login() {
  const res = await fetch(`${BASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'apikey': ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status} ${await res.text()}`);
  return res.json();
}

let TOKEN, USER_ID;
function hdrs(prefer = 'return=representation') {
  return {
    'apikey': ANON_KEY,
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
    'Prefer': prefer,
  };
}

async function restGet(table, params = '') {
  const res = await fetch(`${BASE_URL}/rest/v1/${table}?${params}`, { headers: hdrs() });
  if (!res.ok) throw new Error(`GET ${table}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function restDelete(table, params) {
  const res = await fetch(`${BASE_URL}/rest/v1/${table}?${params}`, { method: 'DELETE', headers: hdrs() });
  if (!res.ok) throw new Error(`DELETE ${table}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function insertBatch(table, rows, batchSize = 50) {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    try {
      const res = await fetch(`${BASE_URL}/rest/v1/${table}`, {
        method: 'POST', headers: hdrs(), body: JSON.stringify(batch),
      });
      if (!res.ok) throw new Error(await res.text());
      inserted += batch.length;
    } catch (e) {
      for (const row of batch) {
        try {
          const res = await fetch(`${BASE_URL}/rest/v1/${table}`, {
            method: 'POST', headers: hdrs(), body: JSON.stringify(row),
          });
          if (res.ok) inserted++;
          else console.warn(`  SKIP ${table}: ${(await res.text()).slice(0, 120)}`);
        } catch (e2) { console.warn(`  SKIP ${table}: ${e2.message.slice(0, 120)}`); }
      }
    }
  }
  return inserted;
}

// ---- User mapping ----
// Maps Monday.com names/emails to Supabase user IDs
function buildUserMap(profiles) {
  const map = new Map();
  for (const p of profiles) {
    if (p.full_name) map.set(p.full_name.toLowerCase(), p.id);
    if (p.email) {
      map.set(p.email.toLowerCase(), p.id);
      // Also map first part of email
      const name = p.email.split('@')[0].replace(/[._]/g, ' ').toLowerCase();
      map.set(name, p.id);
    }
  }
  // Monday.com specific name mappings
  map.set('thais carballal', map.get('thais master') || null);
  map.set('thais', map.get('thais master') || null);
  return map;
}

function resolveUser(mondayName, userMap) {
  if (!mondayName) return null;
  const clean = mondayName.trim().toLowerCase();
  if (clean === '' || clean === 'membro excluído' || clean === 'deleted member') return null;
  // Try exact match
  if (userMap.has(clean)) return userMap.get(clean);
  // Try first name only
  const firstName = clean.split(/[\s,]+/)[0];
  if (userMap.has(firstName)) return userMap.get(firstName);
  // Try email pattern
  if (clean.includes('@') && userMap.has(clean)) return userMap.get(clean);
  return null;
}

// ---- Excel parsing helpers ----
function excelDateToISO(serial) {
  if (!serial) return null;
  if (typeof serial === 'string') {
    if (serial.match(/^\d{4}-\d{2}-\d{2}/)) return serial.slice(0, 10);
    return null;
  }
  // Excel serial date to JS date
  const d = new Date((serial - 25569) * 86400 * 1000);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function mapPriority(mondayPriority) {
  if (!mondayPriority) return 'medium';
  const p = mondayPriority.toString().toLowerCase().trim();
  if (p === 'baixa' || p === 'low') return 'low';
  if (p === 'media' || p === 'média' || p === 'medium') return 'medium';
  if (p === 'alta' || p === 'high') return 'high';
  if (p === 'crítica' || p === 'critica' || p === 'critical' || p === 'urgente') return 'critical';
  return 'medium';
}

function mapMelhoriaStatus(mondayStatus) {
  if (!mondayStatus) return 'open';
  const s = mondayStatus.toString().toLowerCase().trim();
  if (s === 'não iniciado' || s === 'nao iniciado') return 'open';
  if (s === 'em andamento' || s === 'working on it') return 'in_progress';
  if (s === 'feito' || s === 'done' || s === 'concluído') return 'done';
  if (s === 'necessita revisão' || s === 'stuck') return 'in_progress';
  if (s === 'rejeitado' || s === 'rejected') return 'rejected';
  return 'open';
}

function mapConteudoStatus(mondayStatus) {
  if (!mondayStatus) return 'nao_iniciado';
  const s = mondayStatus.toString().toLowerCase().trim();
  if (s === 'postada' || s === 'publicado' || s === 'done' || s === 'feito') return 'publicado';
  if (s === 'aprovado' || s === 'approved') return 'aprovado';
  if (s === 'em revisão' || s === 'em revisao') return 'em_revisao';
  if (s === 'em andamento' || s === 'working on it') return 'em_andamento';
  if (s === 'rascunho') return 'em_andamento';
  return 'nao_iniciado';
}

function mapConteudoType(mondayType) {
  if (!mondayType) return 'foto';
  const t = mondayType.toString().toLowerCase().trim();
  if (t.includes('carrossel')) return 'carrossel';
  if (t.includes('video') || t.includes('vídeo')) return 'video';
  if (t.includes('reel')) return 'reels';
  if (t.includes('stor')) return 'stories';
  return 'foto';
}

function mapFotoVideo(val) {
  if (!val) return 'foto';
  const v = val.toString().toLowerCase().trim();
  if (v.includes('carrossel') && v.includes('foto')) return 'carrossel';
  if (v.includes('carrossel') && v.includes('video')) return 'carrossel';
  if (v.includes('carrossel')) return 'carrossel';
  if (v.includes('video') || v.includes('vídeo')) return 'video';
  if (v.includes('reel')) return 'reels';
  if (v.includes('foto')) return 'foto';
  return 'foto';
}

// ---- Parse Monday.com Excel structure ----
function parseMondayBoard(filePath) {
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  const groups = [];
  let currentGroup = null;
  let mainHeaders = null;
  let subHeaders = null;
  let lastMainItem = null;
  let inSubitems = false;

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0 || row.every(c => c === undefined || c === null || c === '')) {
      inSubitems = false;
      continue;
    }

    // Detect column header row for main items
    if (row[0] === 'Name' && row.length > 1) {
      mainHeaders = row.map(h => (h || '').toString().trim());
      inSubitems = false;
      continue;
    }

    // Detect subitem header row
    if ((row[0] === 'Subitems' || row[0] === 'Subelementos') && row[1] === 'Name') {
      subHeaders = row.slice(1).map(h => (h || '').toString().trim());
      inSubitems = true;
      continue;
    }

    // Subitem data row (blank col A, data from col B)
    if (inSubitems && (!row[0] || row[0] === '') && row[1]) {
      if (lastMainItem) {
        const subItem = {};
        if (subHeaders) {
          for (let j = 0; j < subHeaders.length; j++) {
            subItem[subHeaders[j]] = row[j + 1] !== undefined ? row[j + 1] : null;
          }
        } else {
          subItem['Name'] = row[1];
        }
        lastMainItem.subitems.push(subItem);
      }
      continue;
    }

    // If we hit a non-sub row, exit subitem mode
    if (inSubitems && row[0]) {
      inSubitems = false;
    }

    // Group header detection: short row, no status-like values, not a data row
    if (row[0] && mainHeaders && row.length <= 3 && !row[0].includes('spreadsheet') && !row[0].includes('Try it free')) {
      // Check if it looks like a group header
      const hasStatusCol = mainHeaders.indexOf('Status');
      if (hasStatusCol > 0 && (row[hasStatusCol] === undefined || row[hasStatusCol] === null || row[hasStatusCol] === '')) {
        // Probably a group header
        currentGroup = row[0].toString().trim();
        continue;
      }
    }

    // Main item data row
    if (row[0] && mainHeaders && row[0] !== mainHeaders[0]) {
      // Skip branding rows
      if (row[0].toString().includes('spreadsheet') || row[0].toString().includes('Try it free') ||
          row[0].toString().includes('algum teste')) continue;

      const item = { _group: currentGroup, subitems: [] };
      for (let j = 0; j < mainHeaders.length; j++) {
        item[mainHeaders[j]] = row[j] !== undefined ? row[j] : null;
      }

      // Check if this is a group header vs data row
      // Count how many non-null data cells (beyond Name) the row has
      const filledCols = row.filter((c, idx) => idx > 0 && c !== undefined && c !== null && c !== '').length;
      const statusVal = item['Status'];
      const hasAnyKnownField = statusVal || item['Prioridade'] || item['Owner'] || item['Responsável'] ||
                                item['Responsavel'] || item['Pessoas'] || item['Pessoa'];

      // It's a group header if: only 1 col filled AND no known data fields
      if (filledCols === 0 && !hasAnyKnownField) {
        currentGroup = row[0].toString().trim();
        continue;
      }

      lastMainItem = item;
      groups.push(item);
    }
  }

  return { groups, mainHeaders };
}

// ---- Determine area from group name (for Melhorias) ----
function areaFromGroup(group, fileName) {
  if (!group) {
    if (fileName.includes('SEO_On_Page')) return 'seo_onpage';
    if (fileName.includes('SEO_Tecnico')) return 'seo_tecnico';
    if (fileName.includes('Shopify')) return 'shopify';
    return 'site_melhorias';
  }
  const g = group.toLowerCase();
  if (g.includes('seo') && g.includes('on')) return 'seo_onpage';
  if (g.includes('seo') && g.includes('tec')) return 'seo_tecnico';
  if (g.includes('seo')) return 'seo_onpage';
  if (g.includes('shopify')) return 'shopify';
  if (g.includes('blog')) return 'site_melhorias';
  if (g.includes('auditoria')) return 'seo_tecnico';
  return 'site_melhorias';
}

// ---- Determine channel from file name (for Conteúdo) ----
function channelFromFile(fileName) {
  const f = fileName.toLowerCase();
  if (f.includes('kids')) return 'mooui_kids';
  if (f.includes('home')) return 'mooui_home';
  if (f.includes('amo')) return 'amo_mooui';
  if (f.includes('barcelona')) return 'barcelona';
  if (f.includes('outras')) return 'outras_redes';
  if (f.includes('pinterest')) return 'pinterest';
  return 'mooui_kids';
}

// ===================================================================
// MAIN
// ===================================================================
console.log('Autenticando...');
const auth = await login();
TOKEN = auth.access_token;
USER_ID = auth.user.id;
console.log(`OK — ${auth.user.email}\n`);

// Get profiles for user mapping
const profiles = await restGet('profiles', 'select=id,full_name,email');
const userMap = buildUserMap(profiles);
console.log(`Perfis mapeados: ${profiles.length}\n`);

// ===================================================================
// MELHORIAS
// ===================================================================
console.log('=== MELHORIAS ===\n');

const melhoriaFiles = [
  '6_Site_1780430139.xlsx',
  '6_1_Site_Shopify_Novo_1780430149.xlsx',
  'NP_SEO_On_Page_1780430199.xlsx',
  'NP_SEO_Tecnico_1780430208.xlsx',
];

// Parse all files
let allMelhorias = [];
for (const file of melhoriaFiles) {
  const filePath = path.join(process.cwd(), file);
  console.log(`Parsing ${file}...`);
  const { groups } = parseMondayBoard(filePath);

  for (const item of groups) {
    const responsavel = item['Responsável'] || item['Responsavel'] || item['Owner'] || item['Pessoa'] || '';
    const dateOpen = excelDateToISO(item['Abertura'] || item['Date'] || item['Due date'] || item['Data']);
    const dateClose = excelDateToISO(item['Conclusão']);

    const melhoria = {
      organization_id: ORG_ID,
      created_by: USER_ID,
      title: (item['Name'] || '').toString().trim(),
      description: null,
      area: areaFromGroup(item._group, file),
      status: mapMelhoriaStatus(item['Status']),
      priority: mapPriority(item['Prioridade']),
      assigned_to: resolveUser(responsavel, userMap),
      data_abertura: dateOpen || new Date().toISOString().slice(0, 10),
      data_conclusao: dateClose,
      _subitems: item.subitems.map((si, idx) => ({
        title: (si['Name'] || '').toString().trim(),
        status: mapMelhoriaStatus(si['Status']),
        priority: mapPriority(si['Prioridade']),
        assigned_to: resolveUser(si['Owner'] || '', userMap),
        due_date: excelDateToISO(si['Date']),
        position: idx,
      })).filter(si => si.title),
    };

    if (melhoria.title) allMelhorias.push(melhoria);
  }
  console.log(`  → ${groups.length} items, ${groups.reduce((s, g) => s + g.subitems.length, 0)} subitems`);
}

// Filter out items with old dates (keep 2026+ and items without dates)
const melhoriasBefore = allMelhorias.length;
allMelhorias = allMelhorias.filter(m => {
  if (!m.data_abertura || m.data_abertura >= CUTOFF) return true;
  // Keep if it has ongoing status
  if (m.status === 'open' || m.status === 'in_progress') return true;
  return false;
});
console.log(`\nFiltro: ${melhoriasBefore} → ${allMelhorias.length} (removidos ${melhoriasBefore - allMelhorias.length} antigos/concluídos)`);
console.log(`Total subitens: ${allMelhorias.reduce((s, m) => s + m._subitems.length, 0)}`);

// ===================================================================
// CONTEÚDO
// ===================================================================
console.log('\n=== CONTEÚDO ===\n');

function splitPipeTitle(raw) {
  const parts = String(raw || '').split(/\s+\|\s+/).map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  return { category: parts[0], title: parts.slice(1).join(' | ') };
}

const conteudoFiles = [
  'Programacao_MOOUI_Kids_1780430295.xlsx',
  'Programacao_MOOUI_Home_1780430305.xlsx',
  'Programacao_Amo_MOOUI_1780430275.xlsx',
  'Programacao_MOOUI_Barcelona_1780430285.xlsx',
  'Programacao_Outras_Redes_1780430314.xlsx',
];

let allConteudo = [];
for (const file of conteudoFiles) {
  const filePath = path.join(process.cwd(), file);
  console.log(`Parsing ${file}...`);
  const { groups } = parseMondayBoard(filePath);
  const channel = channelFromFile(file);

  for (const item of groups) {
    const responsavel = item['Responsável'] || item['Pessoas'] || item['Pessoa'] || '';
    const scheduledDate = excelDateToISO(item['Data']);
    const isRepost = (item['Novo/Repost'] || '').toString().toLowerCase().includes('repost');
    const fotoVideo = item['Foto/Vídeo'] || item['Foto/Video'] || '';
    const tipo = item['Tipo'] || '';
    const rawName = (item['Name'] || '').toString().trim();
    const splitName = splitPipeTitle(rawName);
    const category = splitName?.category || rawName;
    const visibleTitle = (item['Subitems'] || item['Subelementos'] || '').toString().trim() || splitName?.title || category;

    const conteudoItem = {
      organization_id: ORG_ID,
      created_by: USER_ID,
      title: visibleTitle,
      channel,
      scheduled_date: scheduledDate,
      time_slot: (item['Horário'] || '').toString().trim() || null,
      status: mapConteudoStatus(item['Status']),
      content_type: tipo ? mapConteudoType(tipo) : mapFotoVideo(fotoVideo),
      is_repost: isRepost,
      content_category: tipo ? tipo.toString().trim() : category || null,
      photo_url: (item['Foto Principal'] || '').toString().trim() || null,
      notes: null,
      assigned_to: resolveUser(responsavel, userMap),
      _group: item._group,
      _subitems: item.subitems.map((si, idx) => ({
        title: (si['Name'] || '').toString().trim(),
        status: 'pendente',
        priority: mapPriority(si['Prioridade'] || si['Status']),
        assigned_to: resolveUser(si['Owner'] || si['Pessoas'] || '', userMap),
        due_date: excelDateToISO(si['Date'] || si['Data']),
        position: idx,
      })).filter(si => si.title),
    };

    if (conteudoItem.title) allConteudo.push(conteudoItem);
  }
  console.log(`  → ${groups.length} items (${channel}), ${groups.reduce((s, g) => s + g.subitems.length, 0)} subitems`);
}

// Filter old
const conteudoBefore = allConteudo.length;
allConteudo = allConteudo.filter(c => {
  if (!c.scheduled_date || c.scheduled_date >= CUTOFF) return true;
  return false;
});
console.log(`\nFiltro: ${conteudoBefore} → ${allConteudo.length} (removidos ${conteudoBefore - allConteudo.length} antigos)`);

// ===================================================================
// PREVIEW
// ===================================================================
console.log('\n=== PREVIEW ===\n');

const existingMelhorias = await restGet('melhorias', `select=id&organization_id=eq.${ORG_ID}`);
const existingConteudo = await restGet('conteudo_items', `select=id&organization_id=eq.${ORG_ID}`);

console.log(`Melhorias atuais no banco: ${existingMelhorias.length} → serão DELETADAS`);
console.log(`Melhorias a importar: ${allMelhorias.length} items + ${allMelhorias.reduce((s, m) => s + m._subitems.length, 0)} subitems`);
console.log(`Conteúdo atual no banco: ${existingConteudo.length} → serão DELETADOS`);
console.log(`Conteúdo a importar: ${allConteudo.length} items + ${allConteudo.reduce((s, c) => s + c._subitems.length, 0)} subitems`);

if (!autoConfirm) {
  console.log('\nPara confirmar, rode com --yes no final.');
  process.exit(0);
}

// ===================================================================
// EXECUTE
// ===================================================================
console.log('\n=== DELETANDO DADOS ATUAIS ===\n');

// Delete melhorias (cascade deletes subitems, comments, attachments, activity)
const delMel = await restDelete('melhorias', `organization_id=eq.${ORG_ID}`);
console.log(`  Melhorias deletadas: ${delMel.length}`);

// Delete conteudo (cascade deletes checklist_items, attachments, activity)
const delCont = await restDelete('conteudo_items', `organization_id=eq.${ORG_ID}`);
console.log(`  Conteúdo deletados: ${delCont.length}`);

// Reset code sequences
try {
  await fetch(`${BASE_URL}/rest/v1/melhoria_code_seq?organization_id=eq.${ORG_ID}`, {
    method: 'DELETE', headers: hdrs(),
  });
  await fetch(`${BASE_URL}/rest/v1/conteudo_code_seq?organization_id=eq.${ORG_ID}`, {
    method: 'DELETE', headers: hdrs(),
  });
  console.log('  Code sequences resetados');
} catch (e) { console.warn('  Aviso: não conseguiu resetar code sequences'); }

// ===================================================================
// INSERT MELHORIAS
// ===================================================================
console.log('\n=== INSERINDO MELHORIAS ===\n');

const melhoriaRows = allMelhorias.map(m => {
  const { _subitems, ...row } = m;
  return row;
});

const melInserted = await insertBatch('melhorias', melhoriaRows);
console.log(`  Melhorias inseridas: ${melInserted}`);

// Fetch back with IDs for subitem linking
const insertedMelhorias = await restGet('melhorias', `select=id,title&organization_id=eq.${ORG_ID}&order=created_at.asc`);
const melhoriaIdMap = new Map(insertedMelhorias.map(m => [m.title, m.id]));

// Insert subitems
let totalSubitems = 0;
const subitemRows = [];
for (const m of allMelhorias) {
  const melhoriaId = melhoriaIdMap.get(m.title);
  if (!melhoriaId || m._subitems.length === 0) continue;
  for (const si of m._subitems) {
    subitemRows.push({ ...si, melhoria_id: melhoriaId });
  }
}
if (subitemRows.length > 0) {
  totalSubitems = await insertBatch('melhoria_subitems', subitemRows);
}
console.log(`  Subitems inseridos: ${totalSubitems}`);

// ===================================================================
// INSERT CONTEÚDO
// ===================================================================
console.log('\n=== INSERINDO CONTEÚDO ===\n');

const conteudoRows = allConteudo.map(c => {
  const { _subitems, _group, ...row } = c;
  return row;
});

const contInserted = await insertBatch('conteudo_items', conteudoRows);
console.log(`  Conteúdo inseridos: ${contInserted}`);

// Fetch back for subitem linking
const insertedConteudo = await restGet('conteudo_items', `select=id,title&organization_id=eq.${ORG_ID}&order=created_at.asc`);
const conteudoIdMap = new Map(insertedConteudo.map(c => [c.title, c.id]));

let totalContSubitems = 0;
const contSubRows = [];
for (const c of allConteudo) {
  const conteudoId = conteudoIdMap.get(c.title);
  if (!conteudoId || c._subitems.length === 0) continue;
  for (const si of c._subitems) {
    contSubRows.push({ ...si, conteudo_item_id: conteudoId });
  }
}
if (contSubRows.length > 0) {
  totalContSubitems = await insertBatch('conteudo_checklist_items', contSubRows);
}
console.log(`  Checklist items inseridos: ${totalContSubitems}`);

// ===================================================================
// SUMMARY
// ===================================================================
console.log('\n=== RESULTADO FINAL ===\n');

const finalMel = await restGet('melhorias', `select=id&organization_id=eq.${ORG_ID}`);
const finalSub = await restGet('melhoria_subitems', 'select=id');
const finalCont = await restGet('conteudo_items', `select=id&organization_id=eq.${ORG_ID}`);
let finalCheck = [];
try { finalCheck = await restGet('conteudo_checklist_items', 'select=id'); } catch {}

console.log(`  Melhorias: ${finalMel.length}`);
console.log(`  Melhoria subitems: ${finalSub.length}`);
console.log(`  Conteúdo items: ${finalCont.length}`);
console.log(`  Conteúdo checklist items: ${finalCheck.length}`);
console.log('\nImportação concluída!');
