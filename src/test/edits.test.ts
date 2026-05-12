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

describe("Edits & saves: all modules", () => {
  let c: SupabaseClient;
  let userId: string;
  const tag = `e${Date.now()}`;
  const created: Array<{ table: string; id: string }> = [];

  beforeAll(async () => {
    c = newClient();
    const { data, error } = await c.auth.signInWithPassword(ALICE);
    if (error) throw error;
    userId = data.user!.id;
  }, 30_000);

  afterAll(async () => {
    // Best-effort cleanup in reverse order
    for (const r of [...created].reverse()) {
      await c.from(r.table).delete().eq("id", r.id);
    }
    await c.auth.signOut();
  });

  it("Projects: create, edit, save", async () => {
    const ins = await c.from("projects").insert({
      name: `proj-${tag}`, organization_id: ORG_ID, created_by: userId,
    }).select().single();
    expect(ins.error).toBeNull();
    created.push({ table: "projects", id: ins.data!.id });

    const upd = await c.from("projects")
      .update({ name: `proj-${tag}-edited`, description: "ok" })
      .eq("id", ins.data!.id).select().single();
    expect(upd.error).toBeNull();
    expect(upd.data!.name).toBe(`proj-${tag}-edited`);
  });

  it("Tasks (Monday): create, edit status, save", async () => {
    const proj = await c.from("projects").insert({
      name: `tp-${tag}`, organization_id: ORG_ID, created_by: userId,
    }).select().single();
    created.push({ table: "projects", id: proj.data!.id });

    const ins = await c.from("tasks").insert({
      project_id: proj.data!.id, title: `task-${tag}`, created_by: userId,
    }).select().single();
    expect(ins.error).toBeNull();
    created.push({ table: "tasks", id: ins.data!.id });

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
    created.push({ table: "annual_events", id: ins.data!.id });

    const upd = await c.from("annual_events")
      .update({ title: `ev-${tag}-x`, color: "#3B82F6" })
      .eq("id", ins.data!.id).select().single();
    expect(upd.error).toBeNull();
    expect(upd.data!.color).toBe("#3B82F6");
  });

  it("Doc pages: create, edit content, save", async () => {
    const ins = await c.from("doc_pages").insert({
      organization_id: ORG_ID, created_by: userId, title: `doc-${tag}`,
    }).select().single();
    expect(ins.error).toBeNull();
    created.push({ table: "doc_pages", id: ins.data!.id });

    const upd = await c.from("doc_pages")
      .update({ title: `doc-${tag}-x`, content: "# Olá\nconteúdo", updated_by: userId })
      .eq("id", ins.data!.id).select().single();
    expect(upd.error).toBeNull();
    expect(upd.data!.content).toContain("conteúdo");
  });

  it("Launches: create, edit status, save", async () => {
    const ins = await c.from("launches").insert({
      organization_id: ORG_ID, created_by: userId,
      name: `lan-${tag}`, start_date: "2026-07-01",
    }).select().single();
    expect(ins.error).toBeNull();
    created.push({ table: "launches", id: ins.data!.id });

    const upd = await c.from("launches")
      .update({ name: `lan-${tag}-x`, description: "edit" })
      .eq("id", ins.data!.id).select().single();
    expect(upd.error).toBeNull();
    expect(upd.data!.name).toBe(`lan-${tag}-x`);
  });

  it("CRM: create deal, edit (move stage / value), save", async () => {
    const { data: pipes } = await c.from("crm_pipelines").select("id")
      .eq("organization_id", ORG_ID).limit(1);
    if (!pipes?.length) {
      console.warn("Sem pipeline CRM — pulando");
      return;
    }
    const pipelineId = pipes[0].id;
    const { data: stages } = await c.from("crm_stages").select("id").eq("pipeline_id", pipelineId).order("position");
    expect(stages && stages.length >= 1).toBe(true);

    const ins = await c.from("crm_deals").insert({
      organization_id: ORG_ID, created_by: userId,
      pipeline_id: pipelineId, stage_id: stages![0].id,
      title: `deal-${tag}`, value_cents: 10000, currency: "BRL", status: "open",
    }).select().single();
    expect(ins.error).toBeNull();
    created.push({ table: "crm_deals", id: ins.data!.id });

    const targetStage = stages!.length > 1 ? stages![1].id : stages![0].id;
    const upd = await c.from("crm_deals")
      .update({ title: `deal-${tag}-x`, value_cents: 25000, stage_id: targetStage })
      .eq("id", ins.data!.id).select().single();
    expect(upd.error).toBeNull();
    expect(upd.data!.value_cents).toBe(25000);
    expect(upd.data!.stage_id).toBe(targetStage);
  });

  it("Channels: create, rename, save", async () => {
    const ins = await c.from("channels").insert({
      organization_id: ORG_ID, created_by: userId,
      name: `canal-${tag}`, is_private: false,
    }).select().single();
    expect(ins.error).toBeNull();
    created.push({ table: "channels", id: ins.data!.id });
    await c.from("channel_members").insert({ channel_id: ins.data!.id, user_id: userId });

    const upd = await c.from("channels")
      .update({ name: `canal-${tag}-x`, description: "renomeado" })
      .eq("id", ins.data!.id).select().single();
    expect(upd.error).toBeNull();
    expect(upd.data!.name).toBe(`canal-${tag}-x`);
  });

  it("Stress: 20 task creates + edits in parallel", async () => {
    const proj = await c.from("projects").insert({
      name: `stress-${tag}`, organization_id: ORG_ID, created_by: userId,
    }).select().single();
    created.push({ table: "projects", id: proj.data!.id });

    const ids: string[] = [];
    const inserts = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        c.from("tasks").insert({
          project_id: proj.data!.id, title: `s-${tag}-${i}`, created_by: userId,
        }).select().single()
      )
    );
    for (const r of inserts) {
      expect(r.error).toBeNull();
      ids.push(r.data!.id);
      created.push({ table: "tasks", id: r.data!.id });
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
  }, 30_000);
});
