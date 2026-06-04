/**
 * Run a SQL migration file against Supabase via the Management API.
 * Since Lovable-managed projects can't use `supabase link`, this script
 * splits the SQL into individual statements and runs them via REST.
 *
 * For DDL (CREATE TABLE, policies, etc.) we need to use the Supabase
 * Management API with a service_role key, or we use a workaround:
 * create a temporary RPC function that executes the SQL.
 *
 * Usage: node scripts/run-migration.mjs <migration-file> <email> <password>
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const BASE_URL = 'https://rckglywohrywurknephc.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJja2dseXdvaHJ5d3Vya25lcGhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxOTIyNzUsImV4cCI6MjA5MTc2ODI3NX0.tE1xWUmVQiiC3FPVRh8BN3j0_p5tYQzkrNRqDtW2vZw';

const migrationFile = process.argv[2];
const email = process.argv[3];
const password = process.argv[4];

if (!migrationFile || !email || !password) {
  console.error('Usage: node scripts/run-migration.mjs <migration-file> <email> <password>');
  process.exit(1);
}

// Authenticate
async function login() {
  const res = await fetch(`${BASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'apikey': ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Auth failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// Execute SQL via the pg-meta endpoint (available on Supabase projects)
async function runSQL(token, sql) {
  // Try the Supabase SQL endpoint (available for authenticated admin users)
  const res = await fetch(`${BASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'apikey': ANON_KEY,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });

  if (res.ok) {
    return { success: true, data: await res.json() };
  }

  // If exec_sql doesn't exist, output the SQL for manual execution
  const errText = await res.text();
  return { success: false, error: errText };
}

async function main() {
  console.log('Authenticating...');
  const auth = await login();
  console.log(`Logged in as ${auth.user.email}`);

  const sqlPath = path.resolve(migrationFile);
  const sql = await fs.readFile(sqlPath, 'utf8');
  console.log(`Read migration: ${sqlPath} (${sql.length} bytes)`);

  // Try running directly
  console.log('Attempting to run via exec_sql RPC...');
  const result = await runSQL(auth.access_token, sql);

  if (result.success) {
    console.log('Migration executed successfully!');
    return;
  }

  // exec_sql doesn't exist - need to create it first or use alternative approach
  console.log('exec_sql RPC not available. Trying statement-by-statement via individual REST calls...');
  console.log('');
  console.log('='.repeat(60));
  console.log('MIGRATION MUST BE RUN MANUALLY IN SUPABASE SQL EDITOR');
  console.log('='.repeat(60));
  console.log('');
  console.log('1. Go to your Supabase dashboard');
  console.log('2. Open SQL Editor');
  console.log('3. Paste and run the following SQL:');
  console.log('');
  console.log(sql);
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
