/**
 * Ensures integration-test users have profiles and MOOUI Brasil membership.
 *
 * Uses the generated admin auth token already used by import scripts, then
 * signs in Alice/Bob with the public anon key to discover their auth IDs.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const BASE_URL = 'https://rckglywohrywurknephc.supabase.co';
const ORG_ID = '0d32934f-9628-4bd5-b3f4-1bc74f9227de';
const envText = await fs.readFile(path.join(ROOT, '.env'), 'utf8');
const ANON_KEY = /VITE_SUPABASE_PUBLISHABLE_KEY="?([^"\r\n]+)"?/.exec(envText)?.[1];

if (!ANON_KEY) throw new Error('Missing VITE_SUPABASE_PUBLISHABLE_KEY in .env');

const USERS = [
  { email: 'alice.test@mooui.test', password: 'TestPass!2026', full_name: 'Alice Teste', role: 'admin', appRoles: ['admin'] },
  { email: 'bob.test@mooui.test', password: 'TestPass!2026', full_name: 'Bob Teste', role: 'member', appRoles: ['it_support'] },
];

async function loadAdminAuth() {
  for (const name of ['.auth2.json', '.auth_response.json', '.auth.json']) {
    try {
      const file = path.join(ROOT, 'generated', name);
      const auth = JSON.parse(await fs.readFile(file, 'utf8'));
      if (auth.access_token && auth.user?.id) return auth;
    } catch {
      // Try the next generated auth file.
    }
  }
  throw new Error('No generated admin auth file found.');
}

async function signIn(email, password) {
  const res = await fetch(`${BASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Failed to sign in ${email}: ${res.status} ${JSON.stringify(json)}`);
  if (!json.user?.id || !json.access_token) throw new Error(`Missing auth data for ${email}`);
  return { user: json.user, access_token: json.access_token };
}

async function rest(table, query, { method = 'GET', body, token = globalThis.ADMIN_TOKEN } = {}) {
  const url = `${BASE_URL}/rest/v1/${table}${query ? `?${query}` : ''}`;
  const res = await fetch(url, {
    method,
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`${method} ${table} failed: ${res.status} ${text}`);
  return json;
}

const adminAuth = await loadAdminAuth();
globalThis.ADMIN_TOKEN = adminAuth.access_token;

const result = {};
for (const testUser of USERS) {
  const auth = await signIn(testUser.email, testUser.password);
  const user = auth.user;
  await rest('profiles', 'on_conflict=id', {
    method: 'POST',
    token: auth.access_token,
    body: [{
      id: user.id,
      email: testUser.email,
      full_name: testUser.full_name,
    }],
  });
  await rest('organization_members', 'on_conflict=organization_id,user_id', {
    method: 'POST',
    body: [{
      organization_id: ORG_ID,
      user_id: user.id,
      role: testUser.role,
    }],
  });
  for (const role of testUser.appRoles) {
    await rest('user_roles', 'on_conflict=user_id,role', {
      method: 'POST',
      body: [{ user_id: user.id, role }],
    });
  }
  result[testUser.email] = { id: user.id, role: testUser.role };
}

console.log(JSON.stringify({ ok: true, org_id: ORG_ID, users: result }, null, 2));
