/**
 * Phase 1 items 1.4 + 1.6 — Migrate dedicated comments/attachments/activity
 * to task_comments/task_attachments and remap module_links.
 *
 * Dry-run (default):
 *   node scripts/migrate-dedicated-to-sunday.mjs
 *
 * Write:
 *   node scripts/migrate-dedicated-to-sunday.mjs --yes
 *
 * Matching: for each dedicated entity (melhoria, conteudo_item, sessao, produto,
 * newsletter, pauta), finds the corresponding Sunday task in "Modulo | ..."
 * projects by normalized title matching.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const ORG_ID = '0d32934f-9628-4bd5-b3f4-1bc74f9227de';
const BASE_URL = 'https://rckglywohrywurknephc.supabase.co';
const WRITE = process.argv.includes('--yes');

const envText = await fs.readFile(path.join(ROOT, '.env'), 'utf8');
const ANON_KEY = /VITE_SUPABASE_PUBLISHABLE_KEY="([^"]+)"/.exec(envText)?.[1];
if (!ANON_KEY) throw new Error('Missing VITE_SUPABASE_PUBLISHABLE_KEY in .env');

// ── Auth ──────────────────────────────────────────────

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

function hdrs(prefer = 'return=representation') {
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
    headers: hdrs(options.prefer),
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) throw new Error(`${options.method || 'GET'} ${table}: ${res.status} ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

async function restAll(table, params = '') {
  const rows = [];
  let offset = 0;
  const limit = 1000;
  while (true) {
    const batch = await rest(table, `${params}${params ? '&' : ''}offset=${offset}&limit=${limit}`);
    rows.push(...batch);
    if (batch.length < limit) break;
    offset += limit;
  }
  return rows;
}

function norm(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

// ── Module definitions ────────────────────────────────

const MODULES = [
  {
    key: 'melhorias',
    entityTable: 'melhorias',
    titleField: 'title',
    idField: 'id',
    projectPrefix: 'Modulo | Melhorias',
    commentTable: 'melhoria_comments',
    commentFK: 'melhoria_id',
    attachmentTable: 'melhoria_attachments',
    attachmentFK: 'melhoria_id',
    activityTable: 'melhoria_activity',
    activityFK: 'melhoria_id',
    linkType: 'melhoria',
  },
  {
    key: 'conteudo',
    entityTable: 'conteudo_items',
    titleField: 'title',
    idField: 'id',
    projectPrefix: 'Modulo | Programacao',
    commentTable: 'conteudo_comments',
    commentFK: 'conteudo_item_id',
    attachmentTable: 'conteudo_attachments',
    attachmentFK: 'conteudo_item_id',
    activityTable: 'conteudo_activity',
    activityFK: 'conteudo_item_id',
    linkType: 'conteudo',
  },
  {
    key: 'sessoes',
    entityTable: 'sessoes',
    titleField: 'title',
    idField: 'id',
    projectPrefix: 'Modulo | Sessoes',
    commentTable: 'sessao_comments',
    commentFK: 'sessao_id',
    attachmentTable: 'sessao_attachments',
    attachmentFK: 'sessao_id',
    activityTable: 'sessao_activity',
    activityFK: 'sessao_id',
    linkType: 'sessao',
  },
  {
    key: 'produtos',
    entityTable: 'produtos',
    titleField: 'name',
    idField: 'id',
    projectPrefix: 'Modulo | Produtos',
    commentTable: 'produto_comments',
    commentFK: 'produto_id',
    attachmentTable: 'produto_attachments',
    attachmentFK: 'produto_id',
    activityTable: 'produto_activity',
    activityFK: 'produto_id',
    linkType: 'produto',
  },
  {
    key: 'newsletters',
    entityTable: 'newsletters',
    titleField: 'title',
    idField: 'id',
    projectPrefix: 'Modulo | Newsletters',
    commentTable: 'newsletter_comments',
    commentFK: 'newsletter_id',
    attachmentTable: null,
    attachmentFK: null,
    activityTable: 'newsletter_activity',
    activityFK: 'newsletter_id',
    linkType: null, // no link type for newsletters
  },
  {
    key: 'pautas',
    entityTable: 'pautas',
    titleField: 'title',
    idField: 'id',
    projectPrefix: 'Modulo | Demandas',
    commentTable: 'pauta_comments',
    commentFK: 'pauta_id',
    attachmentTable: null,
    attachmentFK: null,
    activityTable: 'pauta_activity',
    activityFK: 'pauta_id',
    linkType: null,
  },
];

// ── Main ──────────────────────────────────────────────

async function main() {
  const auth = await loadAuth();
  globalThis.TOKEN = auth.access_token;
  const userId = auth.user.id;
  console.log(`\n🔐 Authenticated as ${auth.user.email}`);
  console.log(`   Mode: ${WRITE ? '✏️  WRITE' : '👀 DRY-RUN (add --yes to write)'}\n`);

  // 1. Load all module projects
  const allProjects = await restAll('projects', `organization_id=eq.${ORG_ID}&name=ilike.Modulo | *&select=id,name`);
  console.log(`📂 Found ${allProjects.length} module projects`);

  // 2. Load all tasks in module projects (parent-only for matching)
  const projectIds = allProjects.map((p) => p.id);
  const allTasks = await restAll(
    'tasks',
    `project_id=in.(${projectIds.join(',')})&parent_task_id=is.null&select=id,title,project_id`,
  );
  console.log(`📋 Found ${allTasks.length} parent tasks across module projects\n`);

  // Build matching index: project_id → Map<normalizedTitle, task_id>
  const taskIndexByProject = new Map();
  for (const task of allTasks) {
    if (!taskIndexByProject.has(task.project_id)) {
      taskIndexByProject.set(task.project_id, new Map());
    }
    const key = norm(task.title);
    if (key) taskIndexByProject.get(task.project_id).set(key, task.id);
  }

  const stats = {
    commentsMigrated: 0,
    commentsOrphaned: 0,
    commentsSkipped: 0,
    attachmentsMigrated: 0,
    attachmentsOrphaned: 0,
    attachmentsSkipped: 0,
    linksMigrated: 0,
    linksOrphaned: 0,
    linksSkipped: 0,
  };
  const orphanLog = [];

  // ── Process each module ───────────────────────────
  for (const mod of MODULES) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`📦 Module: ${mod.key}`);

    // Find projects for this module
    const modProjects = allProjects.filter((p) =>
      p.name.toLowerCase().startsWith(mod.projectPrefix.toLowerCase()),
    );
    if (modProjects.length === 0) {
      console.log(`   ⚠️  No projects found for prefix "${mod.projectPrefix}". Skipping.`);
      continue;
    }
    console.log(`   Projects: ${modProjects.map((p) => p.name).join(', ')}`);

    // Load dedicated entities for matching
    const entities = await restAll(mod.entityTable, `select=id,${mod.titleField}`);
    console.log(`   Dedicated entities: ${entities.length}`);

    // Build entity → task mapping
    const entityToTask = new Map();
    const modProjectIds = modProjects.map((p) => p.id);
    let unmatchedEntities = 0;

    for (const entity of entities) {
      const titleNorm = norm(entity[mod.titleField]);
      if (!titleNorm) { unmatchedEntities++; continue; }

      let matchedTaskId = null;
      for (const pid of modProjectIds) {
        const idx = taskIndexByProject.get(pid);
        if (idx?.has(titleNorm)) {
          matchedTaskId = idx.get(titleNorm);
          break;
        }
      }
      if (matchedTaskId) {
        entityToTask.set(entity.id, matchedTaskId);
      } else {
        unmatchedEntities++;
      }
    }
    console.log(`   Matched: ${entityToTask.size} / ${entities.length} (${unmatchedEntities} unmatched)`);

    // ── Comments ──
    const comments = await restAll(mod.commentTable, `select=id,${mod.commentFK},user_id,content,created_at`);
    console.log(`   Comments in ${mod.commentTable}: ${comments.length}`);

    if (comments.length > 0) {
      // Check for already-migrated (avoid duplicates)
      const existingComments = await restAll(
        'task_comments',
        `task_id=in.(${[...new Set([...entityToTask.values()])].join(',')})&select=id,content,created_at`,
      );
      const existingKeys = new Set(existingComments.map((c) => `${norm(c.content)}_${c.created_at}`));

      const toInsert = [];
      for (const c of comments) {
        const taskId = entityToTask.get(c[mod.commentFK]);
        if (!taskId) {
          stats.commentsOrphaned++;
          orphanLog.push(`[comment] ${mod.key} entity=${c[mod.commentFK]} — no matching task`);
          continue;
        }
        const key = `${norm(c.content)}_${c.created_at}`;
        if (existingKeys.has(key)) {
          stats.commentsSkipped++;
          continue;
        }
        toInsert.push({
          task_id: taskId,
          user_id: c.user_id,
          content: c.content,
          created_at: c.created_at,
        });
      }

      console.log(`   → Comments to migrate: ${toInsert.length} (${stats.commentsSkipped} already exist, ${stats.commentsOrphaned} orphaned)`);

      if (WRITE && toInsert.length > 0) {
        for (let i = 0; i < toInsert.length; i += 50) {
          const batch = toInsert.slice(i, i + 50);
          await rest('task_comments', '', { method: 'POST', body: batch, prefer: 'return=minimal' });
        }
        console.log(`   ✅ Inserted ${toInsert.length} comments into task_comments`);
      }
      stats.commentsMigrated += toInsert.length;
    }

    // ── Attachments ──
    if (mod.attachmentTable) {
      const attachments = await restAll(
        mod.attachmentTable,
        `select=id,${mod.attachmentFK},user_id,file_name,file_url,file_type,file_size,created_at`,
      );
      console.log(`   Attachments in ${mod.attachmentTable}: ${attachments.length}`);

      if (attachments.length > 0) {
        const taskIdsForAttachments = [...new Set([...entityToTask.values()])];
        const existingAttachments = taskIdsForAttachments.length > 0
          ? await restAll(
              'task_attachments',
              `task_id=in.(${taskIdsForAttachments.join(',')})&select=id,file_url`,
            )
          : [];
        const existingUrls = new Set(existingAttachments.map((a) => a.file_url));

        const toInsert = [];
        for (const a of attachments) {
          const taskId = entityToTask.get(a[mod.attachmentFK]);
          if (!taskId) {
            stats.attachmentsOrphaned++;
            orphanLog.push(`[attachment] ${mod.key} entity=${a[mod.attachmentFK]} file=${a.file_name} — no matching task`);
            continue;
          }
          if (existingUrls.has(a.file_url)) {
            stats.attachmentsSkipped++;
            continue;
          }
          toInsert.push({
            task_id: taskId,
            user_id: a.user_id,
            file_name: a.file_name,
            file_url: a.file_url,
            file_type: a.file_type,
            file_size: a.file_size,
            created_at: a.created_at,
          });
        }

        console.log(`   → Attachments to migrate: ${toInsert.length} (${stats.attachmentsSkipped} already exist, ${stats.attachmentsOrphaned} orphaned)`);

        if (WRITE && toInsert.length > 0) {
          for (let i = 0; i < toInsert.length; i += 50) {
            const batch = toInsert.slice(i, i + 50);
            await rest('task_attachments', '', { method: 'POST', body: batch, prefer: 'return=minimal' });
          }
          console.log(`   ✅ Inserted ${toInsert.length} attachments into task_attachments`);
        }
        stats.attachmentsMigrated += toInsert.length;
      }
    }
  }

  // ── 1.6: Module Links ───────────────────────────────
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`🔗 Module Links remapping`);

  const dedicatedTypes = MODULES.filter((m) => m.linkType).map((m) => m.linkType);
  const allLinks = await restAll(
    'module_links',
    `organization_id=eq.${ORG_ID}&select=id,source_type,source_id,target_type,target_id`,
  );
  console.log(`   Total module_links: ${allLinks.length}`);

  // Find links that reference dedicated entity types
  const linksToRemap = allLinks.filter(
    (l) => dedicatedTypes.includes(l.source_type) || dedicatedTypes.includes(l.target_type),
  );
  console.log(`   Links referencing dedicated types: ${linksToRemap.length}`);

  if (linksToRemap.length > 0) {
    // Build a global entity→task map across all modules
    const globalEntityToTask = new Map();
    for (const mod of MODULES) {
      if (!mod.linkType) continue;
      const modProjects = allProjects.filter((p) =>
        p.name.toLowerCase().startsWith(mod.projectPrefix.toLowerCase()),
      );
      const entities = await restAll(mod.entityTable, `select=id,${mod.titleField}`);
      const modProjectIds = modProjects.map((p) => p.id);
      for (const entity of entities) {
        const titleNorm = norm(entity[mod.titleField]);
        if (!titleNorm) continue;
        for (const pid of modProjectIds) {
          const idx = taskIndexByProject.get(pid);
          if (idx?.has(titleNorm)) {
            globalEntityToTask.set(`${mod.linkType}:${entity.id}`, idx.get(titleNorm));
            break;
          }
        }
      }
    }

    const updates = [];
    for (const link of linksToRemap) {
      let newSource = { type: link.source_type, id: link.source_id };
      let newTarget = { type: link.target_type, id: link.target_id };

      if (dedicatedTypes.includes(link.source_type)) {
        const taskId = globalEntityToTask.get(`${link.source_type}:${link.source_id}`);
        if (taskId) {
          newSource = { type: 'task', id: taskId };
        } else {
          stats.linksOrphaned++;
          orphanLog.push(`[link] id=${link.id} source ${link.source_type}:${link.source_id} — no matching task`);
          continue;
        }
      }

      if (dedicatedTypes.includes(link.target_type)) {
        const taskId = globalEntityToTask.get(`${link.target_type}:${link.target_id}`);
        if (taskId) {
          newTarget = { type: 'task', id: taskId };
        } else {
          stats.linksOrphaned++;
          orphanLog.push(`[link] id=${link.id} target ${link.target_type}:${link.target_id} — no matching task`);
          continue;
        }
      }

      // Skip if nothing changed
      if (newSource.type === link.source_type && newTarget.type === link.target_type) {
        stats.linksSkipped++;
        continue;
      }

      updates.push({
        id: link.id,
        source_type: newSource.type,
        source_id: newSource.id,
        target_type: newTarget.type,
        target_id: newTarget.id,
      });
    }

    console.log(`   → Links to remap: ${updates.length} (${stats.linksOrphaned} orphaned, ${stats.linksSkipped} unchanged)`);

    if (WRITE && updates.length > 0) {
      for (const upd of updates) {
        await rest(
          'module_links',
          `id=eq.${upd.id}`,
          {
            method: 'PATCH',
            body: {
              source_type: upd.source_type,
              source_id: upd.source_id,
              target_type: upd.target_type,
              target_id: upd.target_id,
            },
            prefer: 'return=minimal',
          },
        );
      }
      console.log(`   ✅ Remapped ${updates.length} module_links`);
    }
    stats.linksMigrated += updates.length;

    // Delete orphaned links
    if (WRITE && stats.linksOrphaned > 0) {
      const orphanLinkIds = orphanLog
        .filter((l) => l.startsWith('[link]'))
        .map((l) => /id=([^ ]+)/.exec(l)?.[1])
        .filter(Boolean);
      for (const id of orphanLinkIds) {
        await rest('module_links', `id=eq.${id}`, { method: 'DELETE', prefer: 'return=minimal' });
      }
      console.log(`   🗑️  Deleted ${orphanLinkIds.length} orphaned links`);
    }
  }

  // ── Summary ─────────────────────────────────────────
  console.log(`\n${'═'.repeat(60)}`);
  console.log('📊 Summary');
  console.log(`   Comments:    ${stats.commentsMigrated} to migrate, ${stats.commentsSkipped} already exist, ${stats.commentsOrphaned} orphaned`);
  console.log(`   Attachments: ${stats.attachmentsMigrated} to migrate, ${stats.attachmentsSkipped} already exist, ${stats.attachmentsOrphaned} orphaned`);
  console.log(`   Links:       ${stats.linksMigrated} to remap, ${stats.linksSkipped} unchanged, ${stats.linksOrphaned} orphaned → delete`);

  if (orphanLog.length > 0) {
    console.log(`\n⚠️  Orphaned entries (${orphanLog.length}):`);
    for (const line of orphanLog) console.log(`   ${line}`);
  }

  if (!WRITE) {
    console.log(`\n👀 Dry-run complete. Add --yes to apply changes.\n`);
  } else {
    console.log(`\n✅ Migration complete.\n`);
  }
}

main().catch((e) => {
  console.error('\n❌ Fatal:', e.message);
  process.exit(1);
});
