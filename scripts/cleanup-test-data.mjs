#!/usr/bin/env node

/**
 * cleanup-test-data.mjs
 *
 * Removes all data associated with test users (email matching @mooui.test).
 * Must be run with the SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/cleanup-test-data.mjs
 *
 * Safety:
 *   - Only deletes users whose email ends in "@mooui.test"
 *   - Requires manual confirmation before proceeding
 *   - Does NOT delete organization structures, just user data
 */

import { createClient } from '@supabase/supabase-js';
import readline from 'readline';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TEST_DOMAIN = '@mooui.test';

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('ERROR: Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function confirm(msg) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${msg} (y/N) `, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}

async function main() {
  console.log('=== MOOUI Test Data Cleanup ===\n');

  // 1. List all test users via admin API
  const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) {
    console.error('Error listing users:', listErr.message);
    process.exit(1);
  }

  const testUsers = users.filter(u => u.email?.endsWith(TEST_DOMAIN));
  if (testUsers.length === 0) {
    console.log(`No users found with domain "${TEST_DOMAIN}". Nothing to clean.`);
    process.exit(0);
  }

  console.log(`Found ${testUsers.length} test user(s):\n`);
  for (const u of testUsers) {
    console.log(`  - ${u.email} (${u.id})`);
  }
  console.log('');

  const ok = await confirm(`Delete all data for these ${testUsers.length} users?`);
  if (!ok) {
    console.log('Aborted.');
    process.exit(0);
  }

  const ids = testUsers.map(u => u.id);

  // 2. Delete user-associated data (order matters for FK constraints)
  const tables = [
    { table: 'order_comments', column: 'user_id' },
    { table: 'messages', column: 'user_id' },
    { table: 'task_assignees', column: 'user_id' },
    { table: 'ticket_attachments', column: 'user_id' },
    { table: 'notifications', column: 'user_id' },
    { table: 'email_preferences', column: 'user_id' },
    { table: 'module_links', column: 'created_by' },
    { table: 'meeting_room_bookings', column: 'user_id' },
    { table: 'user_roles', column: 'user_id' },
    { table: 'organization_members', column: 'user_id' },
    { table: 'profiles', column: 'id' },
  ];

  for (const { table, column } of tables) {
    const { error, count } = await supabase
      .from(table)
      .delete({ count: 'exact' })
      .in(column, ids);
    if (error) {
      console.warn(`  [WARN] ${table}: ${error.message}`);
    } else {
      console.log(`  ${table}: deleted ${count ?? 0} row(s)`);
    }
  }

  // 3. Delete auth users
  console.log('\nDeleting auth users...');
  for (const u of testUsers) {
    const { error } = await supabase.auth.admin.deleteUser(u.id);
    if (error) {
      console.warn(`  [WARN] Could not delete ${u.email}: ${error.message}`);
    } else {
      console.log(`  Deleted ${u.email}`);
    }
  }

  console.log('\nDone! All test data cleaned up.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
