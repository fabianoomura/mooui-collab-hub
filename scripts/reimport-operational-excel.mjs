/**
 * Re-import Conteudo, Sessoes and Melhorias from the Monday.com Excel exports.
 *
 * Default mode is a dry-run preview.
 * Execute writes with:
 *   node scripts/reimport-operational-excel.mjs --yes
 *
 * The script uses generated/.auth2.json or generated/.auth_response.json.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';

const ROOT = process.cwd();
const BASE_URL = 'https://rckglywohrywurknephc.supabase.co';
const envText = await fs.readFile(path.join(ROOT, '.env'), 'utf8');
const ANON_KEY = /VITE_SUPABASE_PUBLISHABLE_KEY="([^"]+)"/.exec(envText)?.[1];
const ORG_ID = '0d32934f-9628-4bd5-b3f4-1bc74f9227de';
const CUTOFF = '2026-01-01';
const WRITE = process.argv.includes('--yes');

if (!ANON_KEY) throw new Error('Missing VITE_SUPABASE_PUBLISHABLE_KEY in .env');

const FILES = {
  melhorias: [
    ['6_Site_1780430139.xlsx', 'site_melhorias'],
    ['6_1_Site_Shopify_Novo_1780430149.xlsx', 'shopify'],
    ['NP_SEO_On_Page_1780430199.xlsx', 'seo_onpage'],
    ['NP_SEO_Tecnico_1780430208.xlsx', 'seo_tecnico'],
  ],
  conteudo: [
    ['Programacao_MOOUI_Kids_1780430295.xlsx', 'mooui_kids'],
    ['Programacao_MOOUI_Home_1780430305.xlsx', 'mooui_home'],
    ['Programacao_Amo_MOOUI_1780430275.xlsx', 'amo_mooui'],
    ['Programacao_MOOUI_Barcelona_1780430285.xlsx', 'barcelona'],
    ['Programacao_Outras_Redes_1780430314.xlsx', 'outras_redes'],
  ],
  newsletters: [
    ['Newsletter_Mooui_Brasil_1780430246.xlsx', 'brasil'],
    ['Newsletter_Barcelona_1780430265.xlsx', 'barcelona'],
  ],
  pautas: [['Marketing_Demandas_1780430326.xlsx', null]],
  sessoes: [['Calendario_de_Fotos_e_Videos_1780430231.xlsx', null]],
};

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

function value(row, ...keys) {
  for (const key of keys) {
    const hit = row[norm(key)];
    if (hit !== undefined && hit !== null && String(hit).trim() !== '') return hit;
  }
  return '';
}

function text(row, ...keys) {
  const hit = value(row, ...keys);
  return hit === null || hit === undefined ? '' : String(hit).trim();
}

function validName(name) {
  const s = String(name ?? '').trim();
  if (!s) return false;
  if (/monday\.com|try it free|spreadsheet/i.test(s)) return false;
  return true;
}

async function readXlsxRows(file) {
  const zip = await JSZip.loadAsync(await fs.readFile(path.join(ROOT, file)));
  const sharedXml = await zip.file('xl/sharedStrings.xml')?.async('string');
  const shared = [];
  if (sharedXml) {
    for (const match of sharedXml.matchAll(/<si[\s\S]*?<\/si>/g)) {
      const parts = [...match[0].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => decode(m[1]));
      shared.push(parts.join(''));
    }
  }

  const workbook = await zip.file('xl/workbook.xml').async('string');
  const rels = await zip.file('xl/_rels/workbook.xml.rels').async('string');
  const relMap = new Map([...rels.matchAll(/<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)].map((m) => [m[1], m[2]]));
  const sheetId = /<sheet[^>]*r:id="([^"]+)"/.exec(workbook)?.[1];
  const target = relMap.get(sheetId);
  const sheetXml = await zip.file(`xl/${target.replace(/^\//, '').replace(/^xl\//, '')}`).async('string');

  return [...sheetXml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map((rowMatch) => {
    const row = [];
    for (const cellMatch of rowMatch[1].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = cellMatch[1];
      const body = cellMatch[2];
      const ref = /r="([A-Z]+)\d+"/.exec(attrs)?.[1];
      const col = ref ? ref.split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1 : row.length;
      const type = /t="([^"]+)"/.exec(attrs)?.[1];
      let cell = '';
      if (type === 's') {
        const idx = /<v>(.*?)<\/v>/.exec(body)?.[1];
        cell = idx == null ? '' : shared[Number(idx)] ?? '';
      } else if (type === 'inlineStr') {
        cell = [...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => decode(m[1])).join('');
      } else {
        cell = decode(/<v>(.*?)<\/v>/.exec(body)?.[1] ?? '');
      }
      row[col] = cell.trim();
    }
    return row;
  });
}

function objectFrom(headers, row) {
  const out = {};
  headers.forEach((header, index) => {
    if (header) out[norm(header)] = row[index] || '';
  });
  return out;
}

function parseBoard(rows) {
  const main = [];
  const subitems = [];
  let headers = null;
  let subHeaders = null;
  let group = null;
  let parent = null;

  for (const row of rows) {
    const nonEmpty = row.filter(Boolean).length;
    const first = row[0] || '';
    if (!nonEmpty || /try it free|monday\.com/i.test(first)) continue;

    if (first === 'Name') {
      headers = row;
      subHeaders = null;
      continue;
    }

    if (/^Subitems$|^Subelementos$/i.test(first)) {
      subHeaders = row;
      continue;
    }

    if (!headers) {
      if (first && nonEmpty <= 2) group = first;
      continue;
    }

    if (first && nonEmpty <= 1) {
      group = first;
      parent = null;
      subHeaders = null;
      continue;
    }

    if (subHeaders && !first && parent) {
      const item = objectFrom(subHeaders, row);
      item._group = group;
      item._parent = parent.name;
      if (validName(item.name || value(item, 'Owner', 'Status'))) subitems.push(item);
      continue;
    }

    const item = objectFrom(headers, row);
    item._group = group;
    if (validName(item.name)) {
      main.push(item);
      parent = item;
    }
  }

  return { main, subitems };
}

function excelDate(value) {
  if (!value) return null;
  const raw = String(value).trim();
  if (/^\d+(\.\d+)?$/.test(raw)) {
    const date = new Date(Date.UTC(1899, 11, 30 + Number(raw)));
    return date.toISOString().slice(0, 10);
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function pct(value) {
  const raw = String(value || '').replace('%', '').replace(',', '.').trim();
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function mapPriority(input) {
  const s = norm(input);
  if (['baixa', 'low'].includes(s)) return 'low';
  if (['alta', 'high'].includes(s)) return 'high';
  if (['critica', 'critical', 'urgente'].includes(s)) return 'critical';
  return 'medium';
}

function mapMelhoriaStatus(input) {
  const s = norm(input);
  if (['feito', 'done', 'concluido', 'finalizado'].includes(s)) return 'done';
  if (['emandamento', 'workingonit', 'necessitarevisao', 'stuck'].includes(s)) return 'in_progress';
  if (['rejeitado', 'rejected'].includes(s)) return 'rejected';
  return 'open';
}

function mapConteudoStatus(input) {
  const s = norm(input);
  if (['postada', 'publicado', 'publicada', 'done', 'feito', 'enviado', 'enviada'].includes(s)) return 'publicado';
  if (['aprovado', 'aprovada', 'approved'].includes(s)) return 'aprovado';
  if (['emrevisao'].includes(s)) return 'em_revisao';
  if (['emandamento', 'workingonit', 'rascunho'].includes(s)) return 'em_andamento';
  return 'nao_iniciado';
}

function mapNewsletterStatus(input) {
  const status = mapConteudoStatus(input);
  if (status === 'publicado') return 'enviado';
  if (status === 'em_andamento' || status === 'em_revisao' || status === 'aprovado') return 'em_andamento';
  return 'nao_iniciado';
}

function mapPautaStatus(input) {
  const status = mapConteudoStatus(input);
  if (status === 'publicado' || status === 'aprovado') return 'concluida';
  if (status === 'em_andamento' || status === 'em_revisao') return 'em_andamento';
  return 'pendente';
}

function mapSubStatus(input) {
  const status = mapConteudoStatus(input);
  if (status === 'publicado' || status === 'aprovado') return 'concluido';
  if (status === 'em_andamento' || status === 'em_revisao') return 'em_andamento';
  return 'pendente';
}

function mapShotStatus(input) {
  const s = norm(input);
  if (['feito', 'done', 'concluido', 'finalizado', 'postada'].includes(s)) return 'feito';
  if (['emandamento', 'workingonit', 'aprovado', 'aprovada'].includes(s)) return 'em_andamento';
  if (['cancelado', 'cancelada'].includes(s)) return 'cancelado';
  return 'nao_iniciado';
}

function mapSessaoStatus(input) {
  const s = norm(input);
  if (['feito', 'done', 'concluido', 'finalizado', 'entregue'].includes(s)) return 'entregue';
  if (['emandamento', 'workingonit', 'aprovado', 'aprovada'].includes(s)) return 'em_producao';
  if (['emedicao', 'edicao'].includes(s)) return 'em_edicao';
  if (['cancelado', 'cancelada'].includes(s)) return 'cancelada';
  return 'planejada';
}

function mapContentType(input) {
  const s = norm(input);
  if (s.includes('carrossel')) return 'carrossel';
  if (s.includes('reel')) return 'reels';
  if (s.includes('stor')) return 'stories';
  if (s.includes('video')) return 'video';
  return 'foto';
}

function mapShotTipo(input) {
  return norm(input).includes('video') ? 'video' : 'foto';
}

function note(pairs) {
  const lines = pairs.filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '').map(([k, v]) => `${k}: ${String(v).trim()}`);
  return lines.length ? lines.join('\n') : null;
}

function isRecent(date) {
  return !date || date >= CUTOFF;
}

function authHeaders(prefer = 'return=representation') {
  return {
    apikey: ANON_KEY,
    Authorization: `Bearer ${globalThis.TOKEN}`,
    'Content-Type': 'application/json',
    Prefer: prefer,
  };
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
  throw new Error('No generated auth file found. Run an auth/import login first.');
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

async function rest(table, params = '', options = {}) {
  const query = params ? `?${params}` : '';
  const res = await fetch(`${BASE_URL}/rest/v1/${table}${query}`, {
    method: options.method || 'GET',
    headers: authHeaders(options.prefer),
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) throw new Error(`${options.method || 'GET'} ${table}: ${res.status} ${await res.text()}`);
  if (res.status === 204) return [];
  const txt = await res.text();
  return txt ? JSON.parse(txt) : [];
}

async function insertBatch(table, rows, batchSize = 100) {
  let count = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    await rest(table, '', { method: 'POST', body: batch });
    count += batch.length;
  }
  return count;
}

async function loadBoards(entries) {
  const out = [];
  for (const [file, meta] of entries) {
    const rows = await readXlsxRows(file);
    out.push({ file, meta, ...parseBoard(rows) });
  }
  return out;
}

function byParent(subitems) {
  const map = new Map();
  for (const item of subitems) {
    if (!map.has(item._parent)) map.set(item._parent, []);
    map.get(item._parent).push(item);
  }
  return map;
}

async function buildPayloads() {
  const [melBoards, contBoards, nlBoards, pautaBoards, sessBoards] = await Promise.all([
    loadBoards(FILES.melhorias),
    loadBoards(FILES.conteudo),
    loadBoards(FILES.newsletters),
    loadBoards(FILES.pautas),
    loadBoards(FILES.sessoes),
  ]);

  const melhorias = [];
  for (const board of melBoards) {
    const subs = byParent(board.subitems);
    for (const item of board.main) {
      const abertura = excelDate(value(item, 'Abertura', 'Date', 'Due date', 'Data'));
      const conclusao = excelDate(value(item, 'Conclusao', 'Conclusão'));
      const status = mapMelhoriaStatus(value(item, 'Status'));
      if (!isRecent(abertura) && status === 'done') continue;
      melhorias.push({
        organization_id: ORG_ID,
        created_by: globalThis.USER_ID,
        title: text(item, 'Name'),
        description: note([
          ['Grupo Monday', item._group],
          ['Responsavel original', text(item, 'Responsavel', 'Owner', 'Pessoa')],
          ['Numero Ticket', text(item, 'Numero Ticket')],
          ['Mes Ref.', text(item, 'Mes Ref.')],
        ]),
        area: board.meta,
        status,
        priority: mapPriority(value(item, 'Prioridade')),
        assigned_to: null,
        data_abertura: abertura || new Date().toISOString().slice(0, 10),
        data_conclusao: conclusao,
        _subitems: (subs.get(item.name) || []).filter((sub) => validName(sub.name)).map((sub, index) => ({
          title: text(sub, 'Name'),
          status: mapMelhoriaStatus(value(sub, 'Status')),
          priority: mapPriority(value(sub, 'Prioridade')),
          assigned_to: null,
          due_date: excelDate(value(sub, 'Date', 'Data', 'Due date')),
          position: index,
        })),
      });
    }
  }

  const conteudo = [];
  for (const board of contBoards) {
    const subs = byParent(board.subitems);
    for (const item of board.main) {
      const date = excelDate(value(item, 'Data'));
      if (!isRecent(date)) continue;
      const fotoVideo = value(item, 'Foto/Video', 'Foto/Video');
      const tipo = value(item, 'Tipo');
      conteudo.push({
        organization_id: ORG_ID,
        created_by: globalThis.USER_ID,
        title: text(item, 'Name'),
        channel: board.meta,
        scheduled_date: date,
        time_slot: text(item, 'Horario') || null,
        status: mapConteudoStatus(value(item, 'Status')),
        content_type: tipo ? mapContentType(tipo) : mapContentType(fotoVideo),
        is_repost: /repost/i.test(text(item, 'Novo/Repost')),
        content_category: text(item, 'Tipo') || null,
        photo_url: text(item, 'Foto Principal') || null,
        notes: note([
          ['Grupo Monday', item._group],
          ['Responsavel original', text(item, 'Pessoas', 'Responsavel', 'Pessoa')],
          ['Novo/Repost', text(item, 'Novo/Repost')],
        ]),
        assigned_to: null,
        _subitems: (subs.get(item.name) || []).filter((sub) => validName(sub.name)).map((sub, index) => ({
          title: text(sub, 'Name'),
          status: mapSubStatus(value(sub, 'Status')),
          priority: mapPriority(value(sub, 'Prioridade', 'Status')),
          assigned_to: null,
          due_date: excelDate(value(sub, 'Date', 'Data')),
          position: index,
        })),
      });
    }
  }

  const newsletters = [];
  for (const board of nlBoards) {
    for (const item of board.main) {
      const date = excelDate(value(item, 'Data'));
      if (!date || date < CUTOFF) continue;
      newsletters.push({
        organization_id: ORG_ID,
        created_by: globalThis.USER_ID,
        title: text(item, 'Name'),
        scheduled_date: date,
        status: mapNewsletterStatus(value(item, 'Status')),
        tema: text(item, 'Tema') || null,
        base: text(item, 'Base') || null,
        hora: text(item, 'Hora') || null,
        titulo_email: text(item, 'Titulo') || null,
        open_rate: pct(value(item, 'Abertura')),
        click_rate: pct(value(item, 'Clique')),
        channel: board.meta,
        notes: note([['Grupo Monday', item._group]]),
      });
    }
  }

  const pautas = [];
  const pautaItems = [];
  for (const board of pautaBoards) {
    const subs = byParent(board.subitems);
    for (const item of board.main) {
      const date = excelDate(value(item, 'Data', 'Date'));
      if (!isRecent(date)) continue;
      pautas.push({
        organization_id: ORG_ID,
        created_by: globalThis.USER_ID,
        title: text(item, 'Name'),
        assigned_to: null,
        priority: mapPriority(value(item, 'Prioridade')),
        status: mapPautaStatus(value(item, 'Status')),
        scheduled_date: date,
        notes: note([
          ['Grupo Monday', item._group],
          ['Pessoa original', text(item, 'Pessoa')],
        ]),
        _subitems: (subs.get(item.name) || []).filter((sub) => validName(sub.name)).map((sub, index) => ({
          title: text(sub, 'Name'),
          status: mapPautaStatus(value(sub, 'Status')),
          assigned_to: null,
          position: index,
        })),
      });
    }
  }

  const sessoes = [];
  for (const board of sessBoards) {
    const subs = byParent(board.subitems);
    for (const item of board.main) {
      const date = excelDate(value(item, 'Data'));
      if (!isRecent(date)) continue;
      sessoes.push({
        organization_id: ORG_ID,
        created_by: globalThis.USER_ID,
        title: text(item, 'Name'),
        scheduled_date: date,
        professional: text(item, 'Profissional') || null,
        status: mapSessaoStatus(value(item, 'Status')),
        responsaveis: [],
        notes: note([
          ['Grupo Monday', item._group],
          ['Responsaveis originais', text(item, 'Responsaveis')],
          ['Subir e Renomear', text(item, 'Subir e Renomear')],
          ['Postagens', text(item, 'Postagens')],
        ]),
        _subitems: (subs.get(item.name) || []).filter((sub) => validName(sub.name)).map((sub, index) => ({
          title: [text(sub, 'Name'), text(sub, 'Curtidas')].filter(Boolean).join(' | '),
          tipo: mapShotTipo(value(sub, 'Foto/Video')),
          status: mapShotStatus(value(sub, 'Status')),
          local: text(sub, 'Local') || null,
          funil: text(sub, 'Funil') || null,
          content_type: text(sub, 'Tipo') || null,
          modelo: text(sub, 'Modelo') || null,
          data_entrega: excelDate(value(sub, 'Data de Entrega')),
          position: index,
        })),
      });
    }
  }

  return { melhorias, conteudo, newsletters, pautas, pautaItems, sessoes };
}

function stripPrivate(rows) {
  return rows.map((row) => {
    const { _subitems, ...clean } = row;
    return clean;
  });
}

async function existingCounts() {
  const [melhorias, conteudo, newsletters, pautas, sessoes] = await Promise.all([
    rest('melhorias', `select=id&organization_id=eq.${ORG_ID}`),
    rest('conteudo_items', `select=id&organization_id=eq.${ORG_ID}`),
    rest('newsletters', `select=id&organization_id=eq.${ORG_ID}`),
    rest('pautas', `select=id&organization_id=eq.${ORG_ID}`),
    rest('sessoes', `select=id&organization_id=eq.${ORG_ID}`),
  ]);
  return {
    melhorias: melhorias.length,
    conteudo: conteudo.length,
    newsletters: newsletters.length,
    pautas: pautas.length,
    sessoes: sessoes.length,
  };
}

async function deleteCurrent() {
  await Promise.all([
    rest('melhorias', `organization_id=eq.${ORG_ID}`, { method: 'DELETE' }),
    rest('conteudo_items', `organization_id=eq.${ORG_ID}`, { method: 'DELETE' }),
    rest('newsletters', `organization_id=eq.${ORG_ID}`, { method: 'DELETE' }),
    rest('pautas', `organization_id=eq.${ORG_ID}`, { method: 'DELETE' }),
    rest('sessoes', `organization_id=eq.${ORG_ID}`, { method: 'DELETE' }),
  ]);

  await Promise.allSettled([
    rest('melhoria_code_seq', `organization_id=eq.${ORG_ID}`, { method: 'DELETE' }),
    rest('conteudo_code_seq', `organization_id=eq.${ORG_ID}`, { method: 'DELETE' }),
    rest('sessao_code_seq', `organization_id=eq.${ORG_ID}`, { method: 'DELETE' }),
  ]);
}

async function main() {
  const auth = await loadAuth();
  globalThis.TOKEN = auth.access_token;
  globalThis.USER_ID = auth.user.id;

  const payloads = await buildPayloads();
  const summary = {
    cutoff: CUTOFF,
    write: WRITE,
    existing: await existingCounts(),
    incoming: {
      melhorias: payloads.melhorias.length,
      melhoriaSubitems: payloads.melhorias.reduce((sum, item) => sum + item._subitems.length, 0),
      conteudo: payloads.conteudo.length,
      conteudoSubitems: payloads.conteudo.reduce((sum, item) => sum + item._subitems.length, 0),
      newsletters: payloads.newsletters.length,
      pautas: payloads.pautas.length,
      pautaItems: payloads.pautas.reduce((sum, item) => sum + item._subitems.length, 0),
      sessoes: payloads.sessoes.length,
      sessaoShots: payloads.sessoes.reduce((sum, item) => sum + item._subitems.length, 0),
    },
  };

  console.log(JSON.stringify(summary, null, 2));
  if (!WRITE) {
    console.log('\nDry-run only. Re-run with --yes to delete current data and import these rows.');
    return;
  }

  await deleteCurrent();

  await insertBatch('melhorias', stripPrivate(payloads.melhorias));
  const melRows = await rest('melhorias', `select=id,title,area&organization_id=eq.${ORG_ID}`);
  const melMap = new Map(melRows.map((row) => [`${row.area}::${row.title}`, row.id]));
  const melSubs = payloads.melhorias.flatMap((item) =>
    item._subitems.map((sub) => ({ ...sub, melhoria_id: melMap.get(`${item.area}::${item.title}`) })).filter((row) => row.melhoria_id),
  );
  if (melSubs.length) await insertBatch('melhoria_subitems', melSubs);

  await insertBatch('conteudo_items', stripPrivate(payloads.conteudo));
  const contRows = await rest('conteudo_items', `select=id,title,channel,scheduled_date&organization_id=eq.${ORG_ID}`);
  const contMap = new Map(contRows.map((row) => [`${row.channel}::${row.title}::${row.scheduled_date || ''}`, row.id]));
  const contSubs = payloads.conteudo.flatMap((item) =>
    item._subitems.map((sub) => ({ ...sub, conteudo_item_id: contMap.get(`${item.channel}::${item.title}::${item.scheduled_date || ''}`) })).filter((row) => row.conteudo_item_id),
  );
  if (contSubs.length) await insertBatch('conteudo_checklist_items', contSubs);

  if (payloads.newsletters.length) await insertBatch('newsletters', payloads.newsletters);

  await insertBatch('pautas', stripPrivate(payloads.pautas));
  const pautaRows = await rest('pautas', `select=id,title,scheduled_date&organization_id=eq.${ORG_ID}`);
  const pautaMap = new Map(pautaRows.map((row) => [`${row.title}::${row.scheduled_date || ''}`, row.id]));
  const pautaSubs = payloads.pautas.flatMap((item) =>
    item._subitems.map((sub) => ({ ...sub, pauta_id: pautaMap.get(`${item.title}::${item.scheduled_date || ''}`) })).filter((row) => row.pauta_id),
  );
  if (pautaSubs.length) await insertBatch('pauta_items', pautaSubs);

  await insertBatch('sessoes', stripPrivate(payloads.sessoes));
  const sessRows = await rest('sessoes', `select=id,title,scheduled_date&organization_id=eq.${ORG_ID}`);
  const sessMap = new Map(sessRows.map((row) => [`${row.title}::${row.scheduled_date || ''}`, row.id]));
  const shots = payloads.sessoes.flatMap((item) =>
    item._subitems.map((sub) => ({ ...sub, sessao_id: sessMap.get(`${item.title}::${item.scheduled_date || ''}`) })).filter((row) => row.sessao_id),
  );
  if (shots.length) await insertBatch('sessao_shots', shots);

  console.log('\nImport completed.');
  console.log(JSON.stringify({ before: summary.existing, after: await existingCounts() }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
