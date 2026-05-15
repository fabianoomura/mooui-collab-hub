import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const ORG_ID = "0d32934f-9628-4bd5-b3f4-1bc74f9227de";
const ALICE = { email: "alice.test@mooui.test", password: "TestPass!2026" };

function newClient() {
  return createClient(SUPABASE_URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined as any },
  });
}

async function createProject(c: SupabaseClient, userId: string, name: string) {
  // Trigger add_project_creator_as_owner makes the row visible to the creator
  // immediately, so .select().single() works on the same call.
  const { data, error } = await c.from("projects").insert({
    name, organization_id: ORG_ID, created_by: userId,
  }).select().single();
  expect(error).toBeNull();
  return data!.id as string;
}

describe("Edits & saves: all modules", () => {
  let c: SupabaseClient;
  let userId: string;
  const tag = `e${Date.now()}`;
  const cleanup: Array<{ table: string; id: string }> = [];

  beforeAll(async () => {
    c = newClient();
    const { data, error } = await c.auth.signInWithPassword(ALICE);
    if (error) throw error;
    userId = data.user!.id;
  }, 30_000);

  afterAll(async () => {
    for (const r of [...cleanup].reverse()) {
      await c.from(r.table).delete().eq("id", r.id);
    }
    await c.auth.signOut();
  });

  it("Projects: create, edit, save", async () => {
    const id = await createProject(c, userId, `proj-${tag}`);
    cleanup.push({ table: "projects", id });

    const upd = await c.from("projects")
      .update({ name: `proj-${tag}-edited`, description: "ok" })
      .eq("id", id).select().single();
    expect(upd.error).toBeNull();
    expect(upd.data!.name).toBe(`proj-${tag}-edited`);
    expect(upd.data!.description).toBe("ok");
  });

  it("Tasks (Monday): create, edit status, save", async () => {
    const projectId = await createProject(c, userId, `tp-${tag}`);
    cleanup.push({ table: "projects", id: projectId });

    const ins = await c.from("tasks").insert({
      project_id: projectId, title: `task-${tag}`, created_by: userId,
    }).select().single();
    expect(ins.error).toBeNull();
    cleanup.push({ table: "tasks", id: ins.data!.id });

    const upd = await c.from("tasks")
      .update({ title: `task-${tag}-x`, status: "done", priority: "high" })
      .eq("id", ins.data!.id).select().single();
    expect(upd.error).toBeNull();
    expect(upd.data!.status).toBe("done");
    expect(upd.data!.priority).toBe("high");
  });

  it("Annual events: create, edit, save", async () => {
    const ins = await c.from("annual_events").insert({
      organization_id: ORG_ID, created_by: userId,
      title: `ev-${tag}`, start_date: "2026-06-15", category: "acao", color: "#D6336C",
    }).select().single();
    expect(ins.error).toBeNull();
    cleanup.push({ table: "annual_events", id: ins.data!.id });

    const upd = await c.from("annual_events")
      .update({ title: `ev-${tag}-x`, color: "#3B82F6" })
      .eq("id", ins.data!.id).select().single();
    expect(upd.error).toBeNull();
    expect(upd.data!.color).toBe("#3B82F6");
  });

  it("Doc pages: create, edit content, save", async () => {
    const ins = await c.from("doc_pages").insert({
      organization_id: ORG_ID, created_by: userId, title: `doc-${tag}`,
    }).select().maybeSingle();
    // Doc pages may have stricter SELECT policy; recover by name if needed.
    let id = ins.data?.id as string | undefined;
    if (!id) {
      const { data } = await c.from("doc_pages").select("id").eq("title", `doc-${tag}`).maybeSingle();
      id = data?.id;
    }
    expect(id).toBeTruthy();
    cleanup.push({ table: "doc_pages", id: id! });

    const upd = await c.from("doc_pages")
      .update({ title: `doc-${tag}-x`, content: "# Olá\nconteúdo", updated_by: userId })
      .eq("id", id!).select().single();
    expect(upd.error).toBeNull();
    expect(upd.data!.content).toContain("conteúdo");
  });

  it("Launches: create, edit, save", async () => {
    const ins = await c.from("launches").insert({
      organization_id: ORG_ID, created_by: userId,
      name: `lan-${tag}`, start_date: "2026-07-01",
    }).select().single();
    expect(ins.error).toBeNull();
    cleanup.push({ table: "launches", id: ins.data!.id });

    const upd = await c.from("launches")
      .update({ name: `lan-${tag}-x`, description: "edit" })
      .eq("id", ins.data!.id).select().single();
    expect(upd.error).toBeNull();
    expect(upd.data!.name).toBe(`lan-${tag}-x`);
  });

  // CRM removido — teste descontinuado.

  it("Channels: create, rename, save", async () => {
    const ins = await c.from("channels").insert({
      organization_id: ORG_ID, created_by: userId,
      name: `canal-${tag}`, is_private: false,
    }).select().single();
    expect(ins.error).toBeNull();
    cleanup.push({ table: "channels", id: ins.data!.id });
    await c.from("channel_members").insert({ channel_id: ins.data!.id, user_id: userId });

    const upd = await c.from("channels")
      .update({ name: `canal-${tag}-x`, description: "renomeado" })
      .eq("id", ins.data!.id).select().single();
    expect(upd.error).toBeNull();
    expect(upd.data!.name).toBe(`canal-${tag}-x`);
  });

  it("Stress: 20 concurrent task creates + edits", async () => {
    const projectId = await createProject(c, userId, `stress-${tag}`);
    cleanup.push({ table: "projects", id: projectId });

    const ids: string[] = [];
    const inserts = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        c.from("tasks").insert({
          project_id: projectId, title: `s-${tag}-${i}`, created_by: userId,
        }).select().single()
      )
    );
    for (const r of inserts) {
      expect(r.error).toBeNull();
      ids.push(r.data!.id);
      cleanup.push({ table: "tasks", id: r.data!.id });
    }
    const updates = await Promise.all(
      ids.map((id, i) =>
        c.from("tasks").update({
          title: `s-${tag}-${i}-x`,
          status: i % 2 === 0 ? "in_progress" : "done",
        }).eq("id", id).select().single()
      )
    );
    for (const u of updates) expect(u.error).toBeNull();
  }, 60_000);
});
