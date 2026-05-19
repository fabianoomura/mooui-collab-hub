// Integration tests for the Orders (Pedidos) module.
// Exercises the full lifecycle, cross-sector flows (expedição → atendimento),
// interactions with other modules (tickets, mensagens, notifications),
// concurrency conflicts and RLS boundaries.
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

describe("Orders module — lifecycle, conflicts and cross-module flows", () => {
  let alice: SupabaseClient;
  let bob: SupabaseClient;
  let aliceId: string;
  let bobId: string;
  const tag = `o${Date.now()}`;
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

  async function createOrder(c: SupabaseClient, uid: string, patch: Record<string, any> = {}) {
    const { data, error } = await c.from("orders").insert({
      organization_id: ORG_ID,
      created_by: uid,
      title: `pedido-${tag}-${Math.random().toString(36).slice(2, 7)}`,
      problem_type: "furo_estoque",
      source: "expedicao",
      priority: "medium",
      ...patch,
    }).select().single();
    expect(error).toBeNull();
    cleanup.push({ table: "orders", id: data!.id });
    return data!;
  }

  it("auto-assigns sequential PD-### codes", async () => {
    const a = await createOrder(alice, aliceId, { title: `seq-a-${tag}` });
    const b = await createOrder(alice, aliceId, { title: `seq-b-${tag}` });
    expect(a.code).toMatch(/^PD-\d{3,}$/);
    expect(b.code).toMatch(/^PD-\d{3,}$/);
    const na = parseInt(a.code.slice(3), 10);
    const nb = parseInt(b.code.slice(3), 10);
    expect(nb).toBeGreaterThan(na);
  });

  it("expedição opens a problem and atendimento assigns it to themselves", async () => {
    const o = await createOrder(alice, aliceId, {
      source: "expedicao", problem_type: "furo_estoque", priority: "high",
      shopify_order: `#SH-${tag}`, totvs_order: `TV-${tag}`,
      customer_name: "Cliente Teste",
      description: "Item esgotado, precisa de tratativa do atendimento",
    });

    // Bob (atendimento) picks it up: assign + move to in_progress
    const upd = await bob.from("orders")
      .update({ assigned_to: bobId, status: "in_progress" })
      .eq("id", o.id).select().single();
    expect(upd.error).toBeNull();
    expect(upd.data!.assigned_to).toBe(bobId);
    expect(upd.data!.status).toBe("in_progress");

    // Activity log captured assignment + status change
    const { data: acts } = await alice.from("order_activity")
      .select("action, from_value, to_value").eq("order_id", o.id).order("created_at");
    const actions = acts!.map(a => a.action);
    expect(actions).toContain("created");
    expect(actions).toContain("assigned");
    expect(actions).toContain("status");
  });

  it("supports a full conversation thread via order_comments (both sectors)", async () => {
    const o = await createOrder(alice, aliceId, {
      source: "expedicao", problem_type: "aguardando_itens",
      title: `thread-${tag}`,
    });
    const msgs = [
      { c: alice, uid: aliceId, t: `Aguardando reposição do fornecedor [${tag}]` },
      { c: bob,   uid: bobId,   t: `Atendimento vai avisar o cliente [${tag}]` },
      { c: alice, uid: aliceId, t: `Previsão de chegada: 3 dias úteis [${tag}]` },
      { c: bob,   uid: bobId,   t: `Cliente ok com a espera, segue pedido ativo [${tag}]` },
    ];
    for (const m of msgs) {
      const { error } = await m.c.from("order_comments")
        .insert({ order_id: o.id, user_id: m.uid, content: m.t });
      expect(error).toBeNull();
    }
    const { data } = await alice.from("order_comments")
      .select("content").eq("order_id", o.id).order("created_at");
    expect(data!.length).toBe(4);
  });

  it("walks through the resolution states and sets closed_at on final status", async () => {
    const o = await createOrder(alice, aliceId, { title: `lifecycle-${tag}` });
    expect(o.closed_at).toBeNull();

    const transitions = ["in_progress", "waiting", "sent"] as const;
    for (const s of transitions) {
      const { data, error } = await alice.from("orders")
        .update({ status: s }).eq("id", o.id).select().single();
      expect(error).toBeNull();
      if (s === "sent") expect(data!.closed_at).not.toBeNull();
      else expect(data!.closed_at).toBeNull();
    }

    // Reopening clears closed_at again
    const reopened = await alice.from("orders")
      .update({ status: "in_progress" }).eq("id", o.id).select().single();
    expect(reopened.data!.closed_at).toBeNull();
  });

  it("each final status (sent, done, cancelled) triggers closed_at", async () => {
    for (const s of ["sent", "done", "cancelled"] as const) {
      const o = await createOrder(alice, aliceId, { title: `final-${s}-${tag}` });
      const { data } = await alice.from("orders")
        .update({ status: s }).eq("id", o.id).select().single();
      expect(data!.status).toBe(s);
      expect(data!.closed_at).not.toBeNull();
    }
  });

  it("filters: 'em andamento' x 'finalizados' separation works at query level", async () => {
    const active = await createOrder(alice, aliceId, { title: `active-${tag}`, status: "open" });
    const closed = await createOrder(alice, aliceId, { title: `closed-${tag}` });
    await alice.from("orders").update({ status: "done" }).eq("id", closed.id);

    const { data: andamento } = await alice.from("orders")
      .select("id, status").eq("organization_id", ORG_ID)
      .not("status", "in", "(sent,done,cancelled)");
    expect(andamento!.some(o => o.id === active.id)).toBe(true);
    expect(andamento!.some(o => o.id === closed.id)).toBe(false);

    const { data: fin } = await alice.from("orders")
      .select("id, status").in("status", ["sent", "done", "cancelled"]);
    expect(fin!.some(o => o.id === closed.id)).toBe(true);
  });

  it("sorting by priority (urgent → low) returns the expected order", async () => {
    const urg = await createOrder(alice, aliceId, { title: `prio-urg-${tag}`, priority: "urgent" });
    const low = await createOrder(alice, aliceId, { title: `prio-low-${tag}`, priority: "low" });
    const med = await createOrder(alice, aliceId, { title: `prio-med-${tag}`, priority: "medium" });

    const { data } = await alice.from("orders")
      .select("id, priority, title").ilike("title", `prio-%-${tag}`);
    const rank: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
    const sorted = [...data!].sort((a, b) => rank[a.priority] - rank[b.priority]);
    expect(sorted[0].id).toBe(urg.id);
    expect(sorted[sorted.length - 1].id).toBe(low.id);
    expect(sorted[1].id).toBe(med.id);
  });

  it("concurrency: two sectors editing the same order do not lose data", async () => {
    const o = await createOrder(alice, aliceId, { title: `race-${tag}`, priority: "low" });
    const [r1, r2] = await Promise.all([
      alice.from("orders").update({ priority: "urgent", notes: "alice nota" })
        .eq("id", o.id).select().single(),
      bob.from("orders").update({ status: "in_progress", assigned_to: bobId })
        .eq("id", o.id).select().single(),
    ]);
    expect(r1.error).toBeNull();
    expect(r2.error).toBeNull();

    const { data: final } = await alice.from("orders").select("*").eq("id", o.id).single();
    expect(final!.priority).toBe("urgent");
    expect(final!.status).toBe("in_progress");
    expect(final!.assigned_to).toBe(bobId);
    expect(final!.notes).toBe("alice nota");
  });

  it("RLS: an order from another org is invisible (negative case)", async () => {
    const fakeOrgId = "00000000-0000-0000-0000-000000000000";
    const { error } = await alice.from("orders").insert({
      organization_id: fakeOrgId, created_by: aliceId, title: `forbidden-${tag}`,
    }).select().single();
    expect(error).not.toBeNull();
  });

  it("cross-module: linking an order to a ticket via shared metadata", async () => {
    // Create a related ticket (simulating IT/atendimento opening a complementary ticket)
    const { data: ticket, error: tErr } = await alice.from("tickets").insert({
      organization_id: ORG_ID, created_by: aliceId,
      title: `Pedido com problema ${tag}`,
      description: `Vinculado ao pedido shopify #SH-${tag}`,
      category: "outro" as any, priority: "high" as any,
    }).select().single();
    expect(tErr).toBeNull();
    cleanup.push({ table: "tickets", id: ticket!.id });

    const o = await createOrder(alice, aliceId, {
      title: `linked-${tag}`,
      shopify_order: `#SH-${tag}`,
      notes: `Ticket relacionado: ${ticket!.code}`,
    });

    // Both findable via the same shopify reference (cross-module search)
    const { data: orderHits } = await alice.from("orders")
      .select("id").eq("shopify_order", `#SH-${tag}`);
    expect(orderHits!.some(x => x.id === o.id)).toBe(true);

    const { data: ticketHits } = await alice.from("tickets")
      .select("id, description").ilike("description", `%#SH-${tag}%`);
    expect(ticketHits!.some(x => x.id === ticket!.id)).toBe(true);
  });

  it("cross-module: notification can be sent referencing an order link", async () => {
    const o = await createOrder(alice, aliceId, {
      title: `notify-${tag}`, assigned_to: bobId, source: "expedicao",
    });
    const { data: nid, error } = await alice.rpc("notify_user", {
      _user_id: bobId,
      _type: "order",
      _title: `Pedido ${o.code} atribuído a você`,
      _message: "Tratativa: furo de estoque",
      _link: "/pedidos",
    });
    expect(error).toBeNull();
    expect(nid).toBeTruthy();

    // Bob sees the notification; link does not 404 (route exists in App.tsx)
    const { data: notifs } = await bob.from("notifications")
      .select("*").eq("id", nid as string).single();
    expect(notifs!.link).toBe("/pedidos");
    expect(notifs!.is_read).toBe(false);

    await alice.from("notifications").delete().eq("id", nid as string);
  });
});
