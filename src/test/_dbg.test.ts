import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
const c = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false }});
describe("dbg2", () => {
  it("alice", async () => {
    const { data: s } = await c.auth.signInWithPassword({ email: 'alice.test@mooui.test', password: 'TestPass!2026' });
    const uid = s.user!.id;
    console.log("uid", uid);
    const r1 = await c.from('projects').insert({ name: 'dbgA', organization_id: '0d32934f-9628-4bd5-b3f4-1bc74f9227de', created_by: uid }).select();
    console.log("select-no-single:", r1);
    const r2 = await c.from('projects').insert({ name: 'dbgB', organization_id: '0d32934f-9628-4bd5-b3f4-1bc74f9227de', created_by: uid }).select().single();
    console.log("select-single:", r2);
    // Cleanup
    if (r1.data?.[0]?.id) await c.from('projects').delete().eq('id', r1.data[0].id);
    if (r2.data?.id) await c.from('projects').delete().eq('id', r2.data.id);
    await c.from('projects').delete().eq('name', 'dbgA');
    await c.from('projects').delete().eq('name', 'dbgB');
  }, 30000);
});
