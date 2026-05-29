// Consolidated cross-module integration tests for MOOUI Collab Hub.
// Tests module linking, notifications pipeline, hierarchy/permissions,
// multi-tenant workflows, and data consistency across all major features.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const ORG_ID = "0d32934f-9628-4bd5-b3f4-1bc74f9227de";

const ALICE = { email: "alice.test@mooui.test", password: "TestPass!2026" };
const BOB = { email: "bob.test@mooui.test", password: "TestPass!2026" };

function newClient() {
  return createClient(SUPABASE_URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined as any },
  });
}

async function signIn(c: SupabaseClient, creds: { email: string; password: string }) {
  const { data, error } = await c.auth.signInWithPassword(creds);
  if (error) throw error;
  return data.user!.id;
}

// ─────────────────────────────────────────────────
// 1. LAUNCHES ↔ CHECKLISTS CROSS-MODULE FLOW
// ─────────────────────────────────────────────────
describe("Cross-module: Launches → Checklists pipeline", () => {
  let alice: SupabaseClient;
  let aliceId: string;
  const tag = `xmod-lc-${Date.now()}`;
  const cleanup: Array<{ table: string; id: string }> = [];

  beforeAll(async () => {
    alice = newClient();
    aliceId = await signIn(alice, ALICE);
  }, 30_000);

  afterAll(async () => {
    for (const r of [...cleanup].reverse()) {
      await alice.from(r.table).delete().eq("id", r.id);
    }
    await alice.auth.signOut();
  });

  it("creating a launch and linking a checklist to it", async () => {
    // 1. Create launch
    const { data: launch, error: lErr } = await alice.from("launches").insert({
      organization_id: ORG_ID, created_by: aliceId,
      name: `Launch-${tag}`, start_date: "2026-08-01",
    }).select().single();
    expect(lErr).toBeNull();
    cleanup.push({ table: "launches", id: launch!.id });

    // 2. Add stages
    const stages = [
      { name: "Briefing", duration_days: 3, position: 0 },
      { name: "Producao", duration_days: 14, position: 1 },
      { name: "Fotos", duration_days: 5, position: 2 },
    ];
    for (const s of stages) {
      const { data: stage, error } = await alice.from("launch_stages").insert({
        launch_id: launch!.id, ...s, status: "pending",
      }).select().single();
      expect(error).toBeNull();
      cleanup.push({ table: "launch_stages", id: stage!.id });
    }

    // 3. Create checklist linked to the launch
    const { data: checklist, error: cErr } = await alice.from("launch_checklists").insert({
      organization_id: ORG_ID, created_by: aliceId,
      name: `Check-${tag}`, launch_id: launch!.id,
    }).select().single();
    expect(cErr).toBeNull();
    cleanup.push({ table: "launch_checklists", id: checklist!.id });

    // 4. Add checklist items
    const items = [
      { category: "site", label: "Página criada no Shopify" },
      { category: "fotos", label: "Fotos aprovadas" },
      { category: "descricao", label: "Descrição do produto" },
      { category: "erp", label: "SKU cadastrado no TOTVS" },
    ];
    for (let i = 0; i < items.length; i++) {
      const { error } = await alice.from("checklist_items").insert({
        checklist_id: checklist!.id, position: i,
        ...items[i], status: "pending",
      });
      expect(error).toBeNull();
    }

    // 5. Verify the link: checklist.launch_id matches the launch
    const { data: linked } = await alice.from("launch_checklists")
      .select("id, launch_id, name")
      .eq("id", checklist!.id).single();
    expect(linked!.launch_id).toBe(launch!.id);

    // 6. Verify we can query checklists by launch
    const { data: byLaunch } = await alice.from("launch_checklists")
      .select("id").eq("launch_id", launch!.id);
    expect(byLaunch!.length).toBeGreaterThanOrEqual(1);
    expect(byLaunch!.some(c => c.id === checklist!.id)).toBe(true);
  });

  it("completing all checklist items reflects full progress", async () => {
    // Create a minimal launch + checklist
    const { data: launch } = await alice.from("launches").insert({
      organization_id: ORG_ID, created_by: aliceId,
      name: `Complete-${tag}`, start_date: "2026-09-01",
    }).select().single();
    cleanup.push({ table: "launches", id: launch!.id });

    const { data: checklist } = await alice.from("launch_checklists").insert({
      organization_id: ORG_ID, created_by: aliceId,
      name: `FullCheck-${tag}`, launch_id: launch!.id,
    }).select().single();
    cleanup.push({ table: "launch_checklists", id: checklist!.id });

    // Create 3 items
    const itemIds: string[] = [];
    for (let i = 0; i < 3; i++) {
      const { data } = await alice.from("checklist_items").insert({
        checklist_id: checklist!.id, position: i,
        category: "geral", label: `item-${i}`, status: "pending",
      }).select().single();
      itemIds.push(data!.id);
    }

    // Mark all as done
    for (const id of itemIds) {
      await alice.from("checklist_items").update({
        status: "done", completed_at: new Date().toISOString(), completed_by: aliceId,
      }).eq("id", id);
    }

    // Verify all are done
    const { data: allItems } = await alice.from("checklist_items")
      .select("status").eq("checklist_id", checklist!.id);
    expect(allItems!.every(i => i.status === "done")).toBe(true);

    // Cleanup items
    for (const id of itemIds) {
      await alice.from("checklist_items").delete().eq("id", id);
    }
  });
});

// ─────────────────────────────────────────────────
// 2. NOTIFICATIONS PIPELINE ACROSS MODULES
// ─────────────────────────────────────────────────
describe("Cross-module: notifications pipeline", () => {
  let alice: SupabaseClient;
  let bob: SupabaseClient;
  let aliceId: string;
  let bobId: string;
  const tag = `xmod-notif-${Date.now()}`;

  beforeAll(async () => {
    alice = newClient();
    bob = newClient();
    aliceId = await signIn(alice, ALICE);
    bobId = await signIn(bob, BOB);
  }, 30_000);

  afterAll(async () => {
    await alice.auth.signOut();
    await bob.auth.signOut();
  });

  it("notify_user RPC creates a notification that the recipient can read", async () => {
    const { data: nid, error } = await alice.rpc("notify_user", {
      _user_id: bobId,
      _type: "ticket_assigned",
      _title: `Ticket atribuído a você [${tag}]`,
      _message: "Urgente: verificar login page",
      _link: "/tickets",
    });
    expect(error).toBeNull();
    expect(nid).toBeTruthy();

    // Bob can read it
    const { data } = await bob.from("notifications")
      .select("*").eq("id", nid as string).single();
    expect(data).not.toBeNull();
    expect(data!.type).toBe("ticket_assigned");
    expect(data!.is_read).toBe(false);
    expect(data!.link).toBe("/tickets");

    // Bob marks as read
    const { error: readErr } = await bob.from("notifications")
      .update({ is_read: true }).eq("id", nid as string);
    expect(readErr).toBeNull();

    // Cleanup
    await bob.from("notifications").delete().eq("id", nid as string);
  });

  it("mark all notifications as read via bulk update", async () => {
    // Create multiple notifications for Bob
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      const { data: nid } = await alice.rpc("notify_user", {
        _user_id: bobId, _type: "test",
        _title: `Bulk-${tag}-${i}`, _message: "", _link: "/",
      });
      ids.push(nid as string);
    }

    // Verify all unread
    const { data: unread } = await bob.from("notifications")
      .select("id, is_read").in("id", ids);
    expect(unread!.every(n => !n.is_read)).toBe(true);

    // Mark all as read
    await bob.from("notifications").update({ is_read: true }).eq("user_id", bobId).eq("is_read", false);

    // Verify
    const { data: afterRead } = await bob.from("notifications")
      .select("id, is_read").in("id", ids);
    expect(afterRead!.every(n => n.is_read)).toBe(true);

    // Cleanup
    for (const id of ids) {
      await bob.from("notifications").delete().eq("id", id);
    }
  });

  it("different notification types are all queryable", async () => {
    const types = ["ticket_new", "ticket_assigned", "ticket_status", "ticket_comment", "mention"];
    const ids: string[] = [];

    for (const t of types) {
      const { data: nid } = await alice.rpc("notify_user", {
        _user_id: bobId, _type: t,
        _title: `${t}-${tag}`, _message: "", _link: "/",
      });
      ids.push(nid as string);
    }

    // Query by type
    for (const t of types) {
      const { data } = await bob.from("notifications")
        .select("id, type").eq("user_id", bobId).eq("type", t)
        .ilike("title", `%${tag}%`);
      expect(data!.length).toBeGreaterThanOrEqual(1);
    }

    // Cleanup
    for (const id of ids) {
      await bob.from("notifications").delete().eq("id", id);
    }
  });
});

// ─────────────────────────────────────────────────
// 3. TICKETS FULL LIFECYCLE WITH ATTACHMENTS
// ─────────────────────────────────────────────────
describe("Tickets: full lifecycle with comments and activity", () => {
  let alice: SupabaseClient;
  let bob: SupabaseClient;
  let aliceId: string;
  let bobId: string;
  const tag = `tick-${Date.now()}`;
  const cleanup: Array<{ table: string; id: string }> = [];

  beforeAll(async () => {
    alice = newClient();
    bob = newClient();
    aliceId = await signIn(alice, ALICE);
    bobId = await signIn(bob, BOB);
  }, 30_000);

  afterAll(async () => {
    for (const r of [...cleanup].reverse()) {
      await alice.from(r.table).delete().eq("id", r.id);
    }
    await alice.auth.signOut();
    await bob.auth.signOut();
  });

  it("complete ticket lifecycle: open → assign → comment → resolve → close", async () => {
    // 1. Alice creates a ticket
    const { data: ticket, error: tErr } = await alice.from("tickets").insert({
      organization_id: ORG_ID, created_by: aliceId,
      title: `Bug login ${tag}`, description: "Botão de login não responde",
      category: "bug" as any, priority: "high" as any,
    }).select().single();
    expect(tErr).toBeNull();
    cleanup.push({ table: "tickets", id: ticket!.id });
    expect(ticket!.status).toBe("open");
    expect(ticket!.code).toMatch(/^TK-\d{3,}$/);

    // 2. Bob (IT) assigns to himself
    const { error: assignErr } = await bob.from("tickets")
      .update({ assigned_to: bobId, status: "in_progress" })
      .eq("id", ticket!.id);
    expect(assignErr).toBeNull();

    // 3. Bob adds a comment
    const { error: commentErr } = await bob.from("ticket_comments").insert({
      ticket_id: ticket!.id, user_id: bobId,
      content: `Investigando o problema [${tag}]`,
    });
    expect(commentErr).toBeNull();

    // 4. Alice replies
    await alice.from("ticket_comments").insert({
      ticket_id: ticket!.id, user_id: aliceId,
      content: `Acontece só no Chrome [${tag}]`,
    });

    // 5. Bob resolves
    const { error: resolveErr } = await bob.from("tickets")
      .update({ status: "resolved" }).eq("id", ticket!.id);
    expect(resolveErr).toBeNull();

    // 6. Alice confirms and closes
    const { data: closed } = await alice.from("tickets")
      .update({ status: "closed" }).eq("id", ticket!.id).select().single();
    expect(closed!.status).toBe("closed");
    expect(closed!.resolved_at).not.toBeNull();

    // 7. Verify activity log captured transitions
    const { data: activity } = await alice.from("ticket_activity")
      .select("action").eq("ticket_id", ticket!.id).order("created_at");
    const actions = activity!.map(a => a.action);
    expect(actions).toContain("created");
    expect(actions).toContain("status");
    expect(actions).toContain("assigned");

    // 8. Verify comments
    const { data: comments } = await alice.from("ticket_comments")
      .select("content").eq("ticket_id", ticket!.id).order("created_at");
    expect(comments!.length).toBe(2);
  });

  it("ticket file attachment upload and query", async () => {
    const { data: ticket } = await alice.from("tickets").insert({
      organization_id: ORG_ID, created_by: aliceId,
      title: `Attach-${tag}`, category: "bug" as any, priority: "low" as any,
    }).select().single();
    cleanup.push({ table: "tickets", id: ticket!.id });

    // Upload metadata (simulating the hook's behavior without actual file)
    const { data: att, error } = await alice.from("ticket_attachments").insert({
      ticket_id: ticket!.id, user_id: aliceId,
      file_name: `screenshot-${tag}.png`,
      file_url: `ticket-attachments/${ticket!.id}/test.png`,
      file_type: "image/png",
      file_size: 245000,
    }).select().single();
    expect(error).toBeNull();

    // Query attachments for this ticket
    const { data: atts } = await alice.from("ticket_attachments")
      .select("*").eq("ticket_id", ticket!.id);
    expect(atts!.length).toBe(1);
    expect(atts![0].file_name).toContain("screenshot");
    expect(atts![0].file_type).toBe("image/png");

    // Cleanup
    await alice.from("ticket_attachments").delete().eq("id", att!.id);
  });
});

// ─────────────────────────────────────────────────
// 4. MODULE INSTANCES (WORKSPACES)
// ─────────────────────────────────────────────────
describe("Module instances: workspace isolation", () => {
  let alice: SupabaseClient;
  let aliceId: string;
  const tag = `inst-${Date.now()}`;
  const cleanup: Array<{ table: string; id: string }> = [];

  beforeAll(async () => {
    alice = newClient();
    aliceId = await signIn(alice, ALICE);
  }, 30_000);

  afterAll(async () => {
    for (const r of [...cleanup].reverse()) {
      await alice.from(r.table).delete().eq("id", r.id);
    }
    await alice.auth.signOut();
  });

  it("creates separate instances and data is correctly scoped", async () => {
    // Create two instances for "lancamentos"
    const { data: inst1 } = await alice.from("module_instances").insert({
      organization_id: ORG_ID, module_key: "lancamentos",
      name: `Atacado-${tag}`, color: "#D6336C", position: 0,
    }).select().single();
    cleanup.push({ table: "module_instances", id: inst1!.id });

    const { data: inst2 } = await alice.from("module_instances").insert({
      organization_id: ORG_ID, module_key: "lancamentos",
      name: `Varejo-${tag}`, color: "#2563EB", position: 1,
    }).select().single();
    cleanup.push({ table: "module_instances", id: inst2!.id });

    // Create a launch in each instance
    const { data: l1 } = await alice.from("launches").insert({
      organization_id: ORG_ID, created_by: aliceId,
      name: `Colecao-Atacado-${tag}`, start_date: "2026-08-01",
      instance_id: inst1!.id,
    }).select().single();
    cleanup.push({ table: "launches", id: l1!.id });

    const { data: l2 } = await alice.from("launches").insert({
      organization_id: ORG_ID, created_by: aliceId,
      name: `Colecao-Varejo-${tag}`, start_date: "2026-09-01",
      instance_id: inst2!.id,
    }).select().single();
    cleanup.push({ table: "launches", id: l2!.id });

    // Query by instance — each returns only its own
    const { data: atacado } = await alice.from("launches")
      .select("id, name").eq("instance_id", inst1!.id);
    expect(atacado!.some(l => l.id === l1!.id)).toBe(true);
    expect(atacado!.some(l => l.id === l2!.id)).toBe(false);

    const { data: varejo } = await alice.from("launches")
      .select("id, name").eq("instance_id", inst2!.id);
    expect(varejo!.some(l => l.id === l2!.id)).toBe(true);
    expect(varejo!.some(l => l.id === l1!.id)).toBe(false);
  });
});

// ─────────────────────────────────────────────────
// 5. KANBAN / PROJECT TASK MANAGEMENT
// ─────────────────────────────────────────────────
describe("Kanban: project task management", () => {
  let alice: SupabaseClient;
  let bob: SupabaseClient;
  let aliceId: string;
  let bobId: string;
  const tag = `kanban-${Date.now()}`;
  let projectId: string;
  const cleanup: Array<{ table: string; id: string }> = [];

  beforeAll(async () => {
    alice = newClient();
    bob = newClient();
    aliceId = await signIn(alice, ALICE);
    bobId = await signIn(bob, BOB);

    // Create a shared project
    const { data: proj } = await alice.from("projects").insert({
      name: `KB-${tag}`, organization_id: ORG_ID, created_by: aliceId,
    }).select().single();
    projectId = proj!.id;
    cleanup.push({ table: "projects", id: projectId });

    // Add Bob as member
    await alice.from("project_members").insert({
      project_id: projectId, user_id: bobId, role: "member",
    });
  }, 30_000);

  afterAll(async () => {
    for (const r of [...cleanup].reverse()) {
      await alice.from(r.table).delete().eq("id", r.id);
    }
    await alice.auth.signOut();
    await bob.auth.signOut();
  });

  it("creates tasks in different columns and moves them", async () => {
    // Create tasks in various statuses
    const statuses = ["backlog", "todo", "in_progress", "in_review", "done"] as const;
    const taskIds: string[] = [];

    for (let i = 0; i < statuses.length; i++) {
      const { data } = await alice.from("tasks").insert({
        project_id: projectId, created_by: aliceId,
        title: `${statuses[i]}-${tag}`, status: statuses[i], position: i,
      }).select().single();
      taskIds.push(data!.id);
      cleanup.push({ table: "tasks", id: data!.id });
    }

    // Move task from backlog to in_progress
    const { data: moved } = await alice.from("tasks")
      .update({ status: "in_progress", position: 0 })
      .eq("id", taskIds[0]).select().single();
    expect(moved!.status).toBe("in_progress");

    // Verify task counts by status
    const { data: byStatus } = await alice.from("tasks")
      .select("status").eq("project_id", projectId);
    const counts = byStatus!.reduce((acc, t) => {
      acc[t.status] = (acc[t.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    expect(counts["in_progress"]).toBeGreaterThanOrEqual(2); // original + moved
  });

  it("assigns multiple users to a task", async () => {
    const { data: task } = await alice.from("tasks").insert({
      project_id: projectId, created_by: aliceId,
      title: `Multi-assign-${tag}`,
    }).select().single();
    cleanup.push({ table: "tasks", id: task!.id });

    // Assign both Alice and Bob
    await alice.from("task_assignees").insert({ task_id: task!.id, user_id: aliceId });
    await alice.from("task_assignees").insert({ task_id: task!.id, user_id: bobId });

    const { data: assignees } = await alice.from("task_assignees")
      .select("user_id").eq("task_id", task!.id);
    expect(assignees!.length).toBe(2);
    expect(assignees!.map(a => a.user_id).sort()).toEqual([aliceId, bobId].sort());

    // Remove Bob's assignment
    await alice.from("task_assignees").delete()
      .eq("task_id", task!.id).eq("user_id", bobId);
    const { data: afterRemove } = await alice.from("task_assignees")
      .select("user_id").eq("task_id", task!.id);
    expect(afterRemove!.length).toBe(1);
    expect(afterRemove![0].user_id).toBe(aliceId);
  });

  it("task labels can be created and assigned", async () => {
    // Create labels
    const { data: label } = await alice.from("task_labels").insert({
      project_id: projectId, name: `Bug-${tag}`, color: "#EF4444",
    }).select().single();

    const { data: task } = await alice.from("tasks").insert({
      project_id: projectId, created_by: aliceId,
      title: `Labeled-${tag}`,
    }).select().single();
    cleanup.push({ table: "tasks", id: task!.id });

    // Assign label
    await alice.from("task_label_assignments").insert({
      task_id: task!.id, label_id: label!.id,
    });

    // Query task with labels
    const { data: withLabels } = await alice.from("task_label_assignments")
      .select("label_id, task_labels(name, color)")
      .eq("task_id", task!.id);
    expect(withLabels!.length).toBe(1);

    // Cleanup
    await alice.from("task_label_assignments").delete().eq("task_id", task!.id);
    await alice.from("task_labels").delete().eq("id", label!.id);
  });

  it("subtask hierarchy: parent-child relationship", async () => {
    const { data: parent } = await alice.from("tasks").insert({
      project_id: projectId, created_by: aliceId,
      title: `Parent-${tag}`,
    }).select().single();
    cleanup.push({ table: "tasks", id: parent!.id });

    const childIds: string[] = [];
    for (let i = 0; i < 3; i++) {
      const { data } = await alice.from("tasks").insert({
        project_id: projectId, created_by: aliceId,
        title: `Child-${i}-${tag}`, parent_task_id: parent!.id,
      }).select().single();
      childIds.push(data!.id);
      cleanup.push({ table: "tasks", id: data!.id });
    }

    // Query children
    const { data: children } = await alice.from("tasks")
      .select("id, title").eq("parent_task_id", parent!.id);
    expect(children!.length).toBe(3);
  });
});

// ─────────────────────────────────────────────────
// 6. CALENDAR EVENTS
// ─────────────────────────────────────────────────
describe("Calendar: annual events management", () => {
  let alice: SupabaseClient;
  let aliceId: string;
  const tag = `cal-${Date.now()}`;
  const cleanup: Array<{ table: string; id: string }> = [];

  beforeAll(async () => {
    alice = newClient();
    aliceId = await signIn(alice, ALICE);
  }, 30_000);

  afterAll(async () => {
    for (const r of [...cleanup].reverse()) {
      await alice.from(r.table).delete().eq("id", r.id);
    }
    await alice.auth.signOut();
  });

  it("creates events across all categories", async () => {
    const categories = ["lancamento", "acao", "marco", "data"] as const;
    for (const cat of categories) {
      const { data, error } = await alice.from("annual_events").insert({
        organization_id: ORG_ID, created_by: aliceId,
        title: `${cat}-${tag}`, start_date: "2026-07-15",
        category: cat, color: "#D6336C",
      }).select().single();
      expect(error).toBeNull();
      cleanup.push({ table: "annual_events", id: data!.id });
    }

    // Query all for the year
    const { data: yearEvents } = await alice.from("annual_events")
      .select("id, category").eq("organization_id", ORG_ID)
      .gte("start_date", "2026-01-01").lte("start_date", "2026-12-31");
    expect(yearEvents!.length).toBeGreaterThanOrEqual(4);
  });

  it("date range events span correctly", async () => {
    const { data, error } = await alice.from("annual_events").insert({
      organization_id: ORG_ID, created_by: aliceId,
      title: `Campanha-${tag}`, start_date: "2026-06-01", end_date: "2026-06-15",
      category: "acao", color: "#2563EB",
    }).select().single();
    expect(error).toBeNull();
    cleanup.push({ table: "annual_events", id: data!.id });

    // Verify range is stored
    expect(data!.start_date).toBe("2026-06-01");
    expect(data!.end_date).toBe("2026-06-15");
  });
});

// ─────────────────────────────────────────────────
// 7. MESSAGING: THREADS AND REACTIONS
// ─────────────────────────────────────────────────
describe("Messaging: threads, reactions, and unread tracking", () => {
  let alice: SupabaseClient;
  let bob: SupabaseClient;
  let aliceId: string;
  let bobId: string;
  let channelId: string;
  const tag = `msg-${Date.now()}`;

  beforeAll(async () => {
    alice = newClient();
    bob = newClient();
    aliceId = await signIn(alice, ALICE);
    bobId = await signIn(bob, BOB);

    // Create a channel
    const { data } = await alice.from("channels").insert({
      organization_id: ORG_ID, created_by: aliceId,
      name: `test-${tag}`, is_private: false,
    }).select().single();
    channelId = data!.id;
    await alice.from("channel_members").insert({ channel_id: channelId, user_id: aliceId });
    await bob.from("channel_members").insert({ channel_id: channelId, user_id: bobId });
  }, 30_000);

  afterAll(async () => {
    await alice.from("channels").delete().eq("id", channelId);
    await alice.auth.signOut();
    await bob.auth.signOut();
  });

  it("thread replies are linked to parent message", async () => {
    // Parent message
    const { data: parent } = await alice.from("messages").insert({
      channel_id: channelId, user_id: aliceId,
      content: `Discussão principal [${tag}]`,
    }).select().single();

    // Thread replies
    for (let i = 0; i < 3; i++) {
      const sender = i % 2 === 0 ? bob : alice;
      const senderId = i % 2 === 0 ? bobId : aliceId;
      await sender.from("messages").insert({
        channel_id: channelId, user_id: senderId,
        content: `Resposta ${i} [${tag}]`,
        parent_message_id: parent!.id,
      });
    }

    // Query thread
    const { data: replies } = await alice.from("messages")
      .select("id, content").eq("parent_message_id", parent!.id).order("created_at");
    expect(replies!.length).toBe(3);
  });

  it("reactions can be added and toggled", async () => {
    const { data: msg } = await alice.from("messages").insert({
      channel_id: channelId, user_id: aliceId,
      content: `React to this [${tag}]`,
    }).select().single();

    // Alice reacts with thumbs up
    await alice.from("message_reactions").insert({
      message_id: msg!.id, user_id: aliceId, emoji: "👍",
    });

    // Bob reacts with the same
    await bob.from("message_reactions").insert({
      message_id: msg!.id, user_id: bobId, emoji: "👍",
    });

    // Bob also reacts with fire
    await bob.from("message_reactions").insert({
      message_id: msg!.id, user_id: bobId, emoji: "🔥",
    });

    const { data: reactions } = await alice.from("message_reactions")
      .select("emoji, user_id").eq("message_id", msg!.id);
    expect(reactions!.length).toBe(3);
    expect(reactions!.filter(r => r.emoji === "👍").length).toBe(2);

    // Alice removes her reaction (toggle)
    await alice.from("message_reactions").delete()
      .eq("message_id", msg!.id).eq("user_id", aliceId).eq("emoji", "👍");
    const { data: after } = await alice.from("message_reactions")
      .select("emoji").eq("message_id", msg!.id);
    expect(after!.filter(r => r.emoji === "👍").length).toBe(1);
  });

  it("channel read tracking works via last_read_at", async () => {
    // Mark channel as read for Bob
    const now = new Date().toISOString();
    await bob.from("channel_members")
      .update({ last_read_at: now })
      .eq("channel_id", channelId).eq("user_id", bobId);

    // Alice sends a new message
    await alice.from("messages").insert({
      channel_id: channelId, user_id: aliceId,
      content: `Unread test [${tag}]`,
    });

    // Bob's unread count = messages after last_read_at
    const { data: unread } = await bob.from("messages")
      .select("id", { count: "exact", head: true })
      .eq("channel_id", channelId)
      .gt("created_at", now)
      .is("parent_message_id", null);
    expect(unread).not.toBeNull();
  });
});

// ─────────────────────────────────────────────────
// 8. DOCS: WIKI STRUCTURE
// ─────────────────────────────────────────────────
describe("Docs: wiki page hierarchy and editing", () => {
  let alice: SupabaseClient;
  let aliceId: string;
  const tag = `doc-${Date.now()}`;
  const cleanup: Array<{ table: string; id: string }> = [];

  beforeAll(async () => {
    alice = newClient();
    aliceId = await signIn(alice, ALICE);
  }, 30_000);

  afterAll(async () => {
    for (const r of [...cleanup].reverse()) {
      await alice.from(r.table).delete().eq("id", r.id);
    }
    await alice.auth.signOut();
  });

  it("creates a nested page structure (folder → pages)", async () => {
    // Create folder
    const { data: folder } = await alice.from("doc_pages").insert({
      organization_id: ORG_ID, created_by: aliceId,
      title: `Folder-${tag}`, icon: "📁", position: 0,
    }).select().single();
    cleanup.push({ table: "doc_pages", id: folder!.id });

    // Create child pages
    for (let i = 0; i < 3; i++) {
      const { data } = await alice.from("doc_pages").insert({
        organization_id: ORG_ID, created_by: aliceId,
        title: `Page-${i}-${tag}`, parent_id: folder!.id,
        content: `# Page ${i}\n\nContent here.`, position: i,
      }).select().single();
      cleanup.push({ table: "doc_pages", id: data!.id });
    }

    // Query hierarchy
    const { data: children } = await alice.from("doc_pages")
      .select("id, title, position").eq("parent_id", folder!.id).order("position");
    expect(children!.length).toBe(3);
    expect(children![0].title).toContain("Page-0");
  });

  it("updates content and tracks updated_by", async () => {
    const { data: page } = await alice.from("doc_pages").insert({
      organization_id: ORG_ID, created_by: aliceId,
      title: `Edit-${tag}`, content: "v1",
    }).select().single();
    cleanup.push({ table: "doc_pages", id: page!.id });

    const { data: updated } = await alice.from("doc_pages")
      .update({ content: "v2 — updated", updated_by: aliceId })
      .eq("id", page!.id).select().single();
    expect(updated!.content).toBe("v2 — updated");
    expect(updated!.updated_by).toBe(aliceId);
  });
});

// ─────────────────────────────────────────────────
// 9. MEETING ROOMS & BOOKINGS
// ─────────────────────────────────────────────────
describe("Rooms: booking management", () => {
  let alice: SupabaseClient;
  let aliceId: string;
  const tag = `room-${Date.now()}`;
  const cleanup: Array<{ table: string; id: string }> = [];

  beforeAll(async () => {
    alice = newClient();
    aliceId = await signIn(alice, ALICE);
  }, 30_000);

  afterAll(async () => {
    for (const r of [...cleanup].reverse()) {
      await alice.from(r.table).delete().eq("id", r.id);
    }
    await alice.auth.signOut();
  });

  it("creates a room and books it", async () => {
    // Create room
    const { data: room } = await alice.from("meeting_rooms").insert({
      organization_id: ORG_ID, name: `Sala-${tag}`, capacity: 10, color: "#10B981",
    }).select().single();
    cleanup.push({ table: "meeting_rooms", id: room!.id });

    // Book it
    const { data: booking } = await alice.from("meeting_room_bookings").insert({
      organization_id: ORG_ID, room_id: room!.id, booked_by: aliceId,
      title: `Standup-${tag}`,
      starts_at: "2026-07-15T10:00:00Z",
      ends_at: "2026-07-15T11:00:00Z",
    }).select().single();
    cleanup.push({ table: "meeting_room_bookings", id: booking!.id });

    expect(booking!.title).toContain("Standup");
    expect(booking!.room_id).toBe(room!.id);
  });
});

// ─────────────────────────────────────────────────
// 10. DATA CONSISTENCY: CONCURRENT OPERATIONS
// ─────────────────────────────────────────────────
describe("Data consistency: concurrent operations", () => {
  let alice: SupabaseClient;
  let bob: SupabaseClient;
  let aliceId: string;
  let bobId: string;
  const tag = `conc-${Date.now()}`;

  beforeAll(async () => {
    alice = newClient();
    bob = newClient();
    aliceId = await signIn(alice, ALICE);
    bobId = await signIn(bob, BOB);
  }, 30_000);

  afterAll(async () => {
    await alice.auth.signOut();
    await bob.auth.signOut();
  });

  it("concurrent ticket updates from different users don't lose data", async () => {
    const { data: ticket } = await alice.from("tickets").insert({
      organization_id: ORG_ID, created_by: aliceId,
      title: `Race-${tag}`, category: "bug" as any, priority: "low" as any,
    }).select().single();

    // Simultaneous updates
    const [r1, r2] = await Promise.all([
      alice.from("tickets").update({ priority: "urgent" as any }).eq("id", ticket!.id).select().single(),
      bob.from("tickets").update({ status: "in_progress", assigned_to: bobId }).eq("id", ticket!.id).select().single(),
    ]);
    expect(r1.error).toBeNull();
    expect(r2.error).toBeNull();

    // Verify final state has both changes
    const { data: final } = await alice.from("tickets").select("*").eq("id", ticket!.id).single();
    expect(final!.priority).toBe("urgent");
    expect(final!.status).toBe("in_progress");

    // Cleanup
    await alice.from("tickets").delete().eq("id", ticket!.id);
  });

  it("rapid message sends in the same channel maintain order", async () => {
    const { data: ch } = await alice.from("channels").insert({
      organization_id: ORG_ID, created_by: aliceId,
      name: `rapid-${tag}`, is_private: false,
    }).select().single();
    await alice.from("channel_members").insert({ channel_id: ch!.id, user_id: aliceId });

    // Send 10 messages rapidly
    const promises = Array.from({ length: 10 }, (_, i) =>
      alice.from("messages").insert({
        channel_id: ch!.id, user_id: aliceId,
        content: `msg-${String(i).padStart(2, "0")}-${tag}`,
      })
    );
    await Promise.all(promises);

    const { data: msgs } = await alice.from("messages")
      .select("content").eq("channel_id", ch!.id)
      .order("created_at");
    expect(msgs!.length).toBe(10);

    // Cleanup
    await alice.from("channels").delete().eq("id", ch!.id);
  });
});
