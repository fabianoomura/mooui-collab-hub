#!/usr/bin/env node
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const printSql = process.argv.includes('--print-sql');
const writeSql = process.argv.includes('--write-sql');

const migrations = [
  '20260630_board_preferences.sql',
  '20260630_board_task_reminders.sql',
  '20260630_org_member_status.sql',
  '20260630_permission_audit_log.sql',
  '20260630_process_board_task_reminders.sql',
  '20260630_task_group_key.sql',
  '20260701_member_status_governance.sql',
  '20260701_invites_access_expiration.sql',
  '20260701_member_access_telemetry.sql',
  '20260701_process_access_governance_alerts.sql',
];

const functions = [
  'admin-set-member-status',
  'admin-resend-invite',
  'admin-renew-member-access',
  'record-member-access',
  'process-board-reminders',
  'process-access-governance-alerts',
];

const secrets = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_PUBLISHABLE_KEY ou SUPABASE_ANON_KEY',
  'ALLOWED_ORIGIN',
  'RESEND_API_KEY',
  'EMAIL_FROM',
  'BOARD_REMINDERS_CRON_SECRET',
  'ACCESS_GOVERNANCE_CRON_SECRET',
];

async function exists(relativePath) {
  try {
    await access(path.join(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

const configPath = path.join(root, 'supabase', 'config.toml');
const config = await readFile(configPath, 'utf8').catch(() => '');
const projectId = config.match(/project_id\s*=\s*"([^"]+)"/)?.[1] ?? null;

const missingMigrations = [];
for (const migration of migrations) {
  if (!(await exists(path.join('supabase', 'migrations', migration)))) missingMigrations.push(migration);
}

const missingFunctions = [];
for (const fn of functions) {
  if (!(await exists(path.join('supabase', 'functions', fn, 'index.ts')))) missingFunctions.push(fn);
}

if (printSql || writeSql) {
  if (missingMigrations.length) {
    console.error(`Missing migrations: ${missingMigrations.join(', ')}`);
    process.exit(1);
  }

  const parts = [
    '-- MOOUI governance release SQL bundle',
    `-- Generated from local migrations on ${new Date().toISOString()}`,
    '-- Run this in Supabase SQL Editor. Edge Functions still need deploy separately.',
    '',
  ];

  for (const migration of migrations) {
    const fullPath = path.join(root, 'supabase', 'migrations', migration);
    const sql = await readFile(fullPath, 'utf8');
    parts.push('');
    parts.push('-- ============================================================================');
    parts.push(`-- ${migration}`);
    parts.push('-- ============================================================================');
    parts.push('');
    parts.push(sql.trim());
    parts.push('');
  }

  const bundle = parts.join('\n');
  if (writeSql) {
    const outDir = path.join(root, 'generated');
    const outPath = path.join(outDir, 'governance-release.sql');
    await mkdir(outDir, { recursive: true });
    await writeFile(outPath, `${bundle}\n`, 'utf8');
    console.log(outPath);
  } else {
    console.log(bundle);
  }

  process.exit(0);
}

console.log('Governance release check');
console.log(`Project ref: ${projectId ?? 'not found in supabase/config.toml'}`);
console.log(`Migrations: ${migrations.length - missingMigrations.length}/${migrations.length}`);
console.log(`Functions: ${functions.length - missingFunctions.length}/${functions.length}`);

if (missingMigrations.length) {
  console.log('\nMissing migrations:');
  for (const migration of missingMigrations) console.log(`- ${migration}`);
}

if (missingFunctions.length) {
  console.log('\nMissing functions:');
  for (const fn of missingFunctions) console.log(`- ${fn}`);
}

console.log('\nPublish commands:');
console.log('supabase db push');
for (const fn of functions) console.log(`supabase functions deploy ${fn}`);

console.log('\nRequired secrets:');
for (const secret of secrets) console.log(`- ${secret}`);

console.log('\nSmoke payloads:');
console.log('supabase functions invoke process-board-reminders --body \'{"limit":25}\'');
console.log('supabase functions invoke process-access-governance-alerts --body \'{"limit":25}\'');

if (missingMigrations.length || missingFunctions.length || !projectId) process.exit(1);
