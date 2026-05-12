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

describe("Integration: messaging between Alice and Bob", () => {
  let alice: SupabaseClient;
  let bob: SupabaseClient;
  let aliceId: string;
  let bobId: string;
  let channelId: string;
  const createdMessageIds: string[] = [];
  const tag = `t${Date.now()}`;

  beforeAll(async () => {
    alice = newClient();
    bob = newClient();
    aliceId = await signIn(alice, ALICE);
    bobId = await signIn(bob, BOB);
  }, 30_000);

  afterAll(async () => {
    // Keep data visible in the UI for inspection.
    await alice.auth.signOut();
    await bob.auth.signOut();
  });

  it("alice creates a channel", async () => {
    const { data, error } = await alice
      .from("channels")
      .insert({
        organization_id: ORG_ID,
        name: `equipe-${tag}`,
        is_private: false,
        created_by: aliceId,
      })
      .select()
      .single();
    expect(error).toBeNull();
    channelId = data!.id;
  });

  it("both join the channel", async () => {
    const r1 = await alice.from("channel_members").insert({ channel_id: channelId, user_id: aliceId });
    const r2 = await bob.from("channel_members").insert({ channel_id: channelId, user_id: bobId });
    expect(r1.error).toBeNull();
    expect(r2.error).toBeNull();
  });

  it("alice and bob exchange messages and both can read them", async () => {
    const msgs = [
      { from: alice, uid: () => aliceId, text: `Oi Bob! [${tag}]` },
      { from: bob,   uid: () => bobId,   text: `E aí Alice, tudo bem? [${tag}]` },
      { from: alice, uid: () => aliceId, text: `Tudo ótimo, vamos fechar a sprint. [${tag}]` },
      { from: bob,   uid: () => bobId,   text: `Combinado 🚀 [${tag}]` },
    ];
    for (const m of msgs) {
      const { data, error } = await m.from
        .from("messages")
        .insert({ channel_id: channelId, user_id: m.uid(), content: m.text })
        .select()
        .single();
      expect(error).toBeNull();
      createdMessageIds.push(data!.id);
    }

    const { data: aliceView, error: e1 } = await alice
      .from("messages").select("id, content, user_id")
      .eq("channel_id", channelId).order("created_at");
    const { data: bobView, error: e2 } = await bob
      .from("messages").select("id, content, user_id")
      .eq("channel_id", channelId).order("created_at");
    expect(e1).toBeNull();
    expect(e2).toBeNull();
    expect(aliceView!.length).toBe(4);
    expect(bobView!.length).toBe(4);
    expect(aliceView!.map(m => m.content)).toEqual(bobView!.map(m => m.content));
  });

  it("non-members cannot read the messages of a private channel", async () => {
    // make channel private and remove bob
    await alice.from("channels").update({ is_private: true }).eq("id", channelId);
    await alice.from("channel_members").delete().eq("channel_id", channelId).eq("user_id", bobId);
    const { data } = await bob.from("messages").select("id").eq("channel_id", channelId);
    expect(data ?? []).toHaveLength(0);
    // restore for cleanup
    await alice.from("channels").update({ is_private: false }).eq("id", channelId);
  });
});

describe("Integration: Alice creates 3 doc pages", () => {
  let alice: SupabaseClient;
  let aliceId: string;
  const pageIds: string[] = [];
  const tag = `d${Date.now()}`;

  beforeAll(async () => {
    alice = newClient();
    aliceId = await signIn(alice, ALICE);
  }, 30_000);

  afterAll(async () => {
    // Keep doc pages visible in the UI for inspection.
    await alice.auth.signOut();
  });

  it("creates 3 doc pages and reads them back", async () => {
    const titles = [`Onboarding ${tag}`, `Roadmap ${tag}`, `Reuniões ${tag}`];
    for (let i = 0; i < titles.length; i++) {
      const { data, error } = await alice
        .from("doc_pages")
        .insert({
          organization_id: ORG_ID,
          title: titles[i],
          content: `Conteúdo inicial da página ${i + 1}`,
          position: i,
          created_by: aliceId,
        })
        .select()
        .single();
      expect(error).toBeNull();
      pageIds.push(data!.id);
    }
    const { data, error } = await alice
      .from("doc_pages").select("id, title")
      .in("id", pageIds);
    expect(error).toBeNull();
    expect(data!.length).toBe(3);
    expect(data!.map(p => p.title).sort()).toEqual(titles.slice().sort());
  });

  it("updates a page title", async () => {
    const target = pageIds[0];
    const { error } = await alice.from("doc_pages").update({ title: `Atualizado ${tag}` }).eq("id", target);
    expect(error).toBeNull();
    const { data } = await alice.from("doc_pages").select("title").eq("id", target).single();
    expect(data!.title).toBe(`Atualizado ${tag}`);
  });
});
