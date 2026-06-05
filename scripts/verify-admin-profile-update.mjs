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

function headers(prefer = 'return=representation') {
  return {
    apikey: ANON_KEY,
    Authorization: `Bearer ${globalThis.TOKEN}`,
    'Content-Type': 'application/json',
    Prefer: prefer,
  };
}

async function rest(table, params = '', options = {}) {
  const res = await fetch(`${BASE_URL}/rest/v1/${table}${params ? `?${params}` : ''}`, {
    method: options.method || 'GET',
    headers: headers(options.prefer),
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) throw new Error(`${options.method || 'GET'} ${table}: ${res.status} ${await res.text()}`);
  if (res.status === 204) return [];
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

const auth = await loadAuth();
globalThis.TOKEN = auth.access_token;
const members = await rest('organization_members', `select=user_id&organization_id=eq.${ORG_ID}`);
const targetId = members.map((member) => member.user_id).find((id) => id !== auth.user.id) || auth.user.id;
const [profile] = await rest('profiles', `select=id,full_name&id=eq.${targetId}`);
if (!profile) throw new Error('No profile found to verify.');
const name = profile.full_name || 'Sem nome';
const [updated] = await rest('profiles', `id=eq.${profile.id}`, {
  method: 'PATCH',
  body: { full_name: name },
});
if (!updated?.id) throw new Error('Profile update returned no row.');
console.log(`OK: profile ${updated.id} accepted admin name update (${name}).`);
