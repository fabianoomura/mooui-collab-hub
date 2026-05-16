import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ORG_BCN = "66d7b347-7708-4ef0-9655-6c129d124596";
const ORG_BR  = "0d32934f-9628-4bd5-b3f4-1bc74f9227de";

const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });

const USERS = [
  { email: "marta.garcia@mooui.bcn",  name: "Marta García",  dept: "Diretoria",  position: "Diretora Geral",         org_role: "admin",  app_role: "director", dept_role: null },
  { email: "pau.ferrer@mooui.bcn",    name: "Pau Ferrer",    dept: "TI",         position: "Gerente de TI",          org_role: "member", app_role: "it_support", dept_name: "TI",        dept_role: "manager"  },
  { email: "nuria.vidal@mooui.bcn",   name: "Núria Vidal",   dept: "Marketing",  position: "Gerente de Marketing",   org_role: "member", app_role: "manager",    dept_name: "Marketing", dept_role: "manager"  },
  { email: "jordi.soler@mooui.bcn",   name: "Jordi Soler",   dept: "Vendas",     position: "Operador de Vendas",     org_role: "member", app_role: null,         dept_name: "Vendas",    dept_role: "operator" },
  { email: "laia.puig@mooui.bcn",     name: "Laia Puig",     dept: "Design",     position: "Designer",               org_role: "member", app_role: null,         dept_name: "Design",    dept_role: "operator" },
  { email: "arnau.roig@mooui.bcn",    name: "Arnau Roig",    dept: "Operações",  position: "Operador de Logística",  org_role: "member", app_role: null,         dept_name: "Operações", dept_role: "operator" },
];

async function ensureUser(u) {
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  let existing = list?.users.find((x) => x.email === u.email);
  let id;
  if (!existing) {
    const { data, error } = await admin.auth.admin.createUser({
      email: u.email,
      password: "Mooui!2026",
      email_confirm: true,
      user_metadata: { full_name: u.name },
    });
    if (error) throw error;
    id = data.user.id;
    console.log("created", u.email, id);
  } else {
    id = existing.id;
    console.log("exists", u.email, id);
  }
  await admin.from("profiles").upsert({ id, full_name: u.name, department: u.dept, position: u.position }, { onConflict: "id" });
  await admin.from("organization_members").upsert({ organization_id: ORG_BCN, user_id: id, role: u.org_role }, { onConflict: "organization_id,user_id" });
  if (u.app_role) {
    await admin.from("user_roles").upsert({ user_id: id, role: u.app_role }, { onConflict: "user_id,role" });
  }
  if (u.dept_name && u.dept_role) {
    const { data: dept } = await admin.from("org_departments").select("id").eq("organization_id", ORG_BCN).eq("name", u.dept_name).maybeSingle();
    if (dept) {
      await admin.from("department_members").upsert({ department_id: dept.id, user_id: id, role: u.dept_role }, { onConflict: "department_id,user_id" });
    }
  }
  return id;
}

// Promote Fabiano to global admin + admin both orgs + TI manager both
const FAB = "494e75ad-2c33-4d4b-b447-811fde001319";
await admin.from("user_roles").upsert({ user_id: FAB, role: "admin" }, { onConflict: "user_id,role" });
for (const org of [ORG_BR, ORG_BCN]) {
  await admin.from("organization_members").upsert({ organization_id: org, user_id: FAB, role: "admin" }, { onConflict: "organization_id,user_id" });
  const { data: ti } = await admin.from("org_departments").select("id").eq("organization_id", org).eq("name", "TI").maybeSingle();
  if (ti) await admin.from("department_members").upsert({ department_id: ti.id, user_id: FAB, role: "manager" }, { onConflict: "department_id,user_id" });
}
console.log("Fabiano promoted to Master");

for (const u of USERS) await ensureUser(u);
console.log("done");
