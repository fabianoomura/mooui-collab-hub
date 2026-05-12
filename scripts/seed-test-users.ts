// Creates 2 test users (idempotent) and ensures they are members of the test org.
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ORG_ID = "0d32934f-9628-4bd5-b3f4-1bc74f9227de"; // MOOUI Brasil

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const USERS = [
  { email: "alice.test@mooui.test", password: "TestPass!2026", full_name: "Alice Teste", role: "admin" as const },
  { email: "bob.test@mooui.test",   password: "TestPass!2026", full_name: "Bob Teste",   role: "member" as const },
];

async function ensureUser(u: typeof USERS[number]) {
  // Try to find existing
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  let existing = list?.users.find((x) => x.email === u.email);
  let id = existing?.id;
  if (!existing) {
    const { data, error } = await admin.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { full_name: u.full_name },
    });
    if (error) throw error;
    id = data.user!.id;
    console.log("created", u.email, id);
  } else {
    // ensure password is current
    await admin.auth.admin.updateUserById(existing.id, { password: u.password, email_confirm: true });
    console.log("exists", u.email, id);
  }
  // ensure membership
  await admin.from("organization_members").upsert(
    { organization_id: ORG_ID, user_id: id!, role: u.role },
    { onConflict: "organization_id,user_id" } as any,
  );
  return id!;
}

const ids: Record<string, string> = {};
for (const u of USERS) ids[u.email] = await ensureUser(u);
console.log(JSON.stringify({ org_id: ORG_ID, ids }, null, 2));
