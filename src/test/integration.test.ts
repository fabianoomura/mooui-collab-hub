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

describe("Integration: channel messaging with @mentions", () => {
  let alice: SupabaseClient;
  let bob: SupabaseClient;
  let aliceId: string;
  let bobId: string;
  let channelId: string;
  const tag = `t${Date.now()}`;

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

  it("alice creates a channel and both join", async () => {
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
    await alice.from("channel_members").insert({ channel_id: channelId, user_id: aliceId });
    await bob.from("channel_members").insert({ channel_id: channelId, user_id: bobId });
  });

  it("they exchange messages with @mentions", async () => {
    const msgs = [
      { from: alice, uid: aliceId, text: `Bom dia time! @Bob consegue revisar o PR de hoje? [${tag}]` },
      { from: bob,   uid: bobId,   text: `Claro @Alice, vou olhar agora 👀 [${tag}]` },
      { from: alice, uid: aliceId, text: `Obrigada @Bob! Depois marcamos a sync. [${tag}]` },
      { from: bob,   uid: bobId,   text: `@Alice combinado, te chamo no DM 🚀 [${tag}]` },
    ];
    for (const m of msgs) {
      const { error } = await m.from
        .from("messages")
        .insert({ channel_id: channelId, user_id: m.uid, content: m.text });
      expect(error).toBeNull();
    }
    const { data } = await bob.from("messages").select("content").eq("channel_id", channelId).order("created_at");
    expect(data!.length).toBe(4);
    expect(data!.every(m => /@(Alice|Bob)/.test(m.content))).toBe(true);
  });
});

describe("Integration: direct message between Alice and Bob", () => {
  let alice: SupabaseClient;
  let bob: SupabaseClient;
  let aliceId: string;
  let bobId: string;
  let dmChannelId: string;
  const tag = `dm${Date.now()}`;

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

  it("alice opens a DM with bob via get_or_create_dm", async () => {
    const { data, error } = await alice.rpc("get_or_create_dm", {
      _other_user_id: bobId,
      _org_id: ORG_ID,
    });
    expect(error).toBeNull();
    expect(data).toBeTruthy();
    dmChannelId = data as string;
  });

  it("they have a back-and-forth DM conversation", async () => {
    const convo = [
      { from: alice, uid: aliceId, text: `Oi Bob, conversa rápida aqui no privado 😉 [${tag}]` },
      { from: bob,   uid: bobId,   text: `Manda ver Alice [${tag}]` },
      { from: alice, uid: aliceId, text: `Sobre o cliente novo: podemos começar segunda? [${tag}]` },
      { from: bob,   uid: bobId,   text: `Pode contar comigo, alinho com o time 👍 [${tag}]` },
      { from: alice, uid: aliceId, text: `Perfeito! Te mando o briefing por aqui mesmo. [${tag}]` },
    ];
    for (const m of convo) {
      const { error } = await m.from
        .from("messages")
        .insert({ channel_id: dmChannelId, user_id: m.uid, content: m.text });
      expect(error).toBeNull();
    }
    const { data: aliceView } = await alice.from("messages").select("content").eq("channel_id", dmChannelId).order("created_at");
    const { data: bobView }   = await bob.from("messages").select("content").eq("channel_id", dmChannelId).order("created_at");
    expect(aliceView!.length).toBeGreaterThanOrEqual(5);
    expect(aliceView!.map(m => m.content)).toEqual(bobView!.map(m => m.content));
  });

  it("bob can reopen the same DM (idempotent)", async () => {
    const { data } = await bob.rpc("get_or_create_dm", { _other_user_id: aliceId, _org_id: ORG_ID });
    expect(data).toBe(dmChannelId);
  });

  it("alice sends a DM message with a file attachment", async () => {  // eslint-disable-line
    // upload a small text file to chat-attachments bucket
    const fileContent = `Notas da reunião — ${tag}\n\n- Validar onboarding\n- Subir build até sexta`;
    const blob = new Blob([fileContent], { type: "text/plain" });
    const path = `${aliceId}/dm-${tag}/notas-${tag}.txt`;
    const { error: upErr } = await alice.storage
      .from("chat-attachments")
      .upload(path, blob, { upsert: true, contentType: "text/plain" });
    expect(upErr).toBeNull();
    const { data: pub } = alice.storage.from("chat-attachments").getPublicUrl(path);

    // create the message
    const { data: msg, error: mErr } = await alice
      .from("messages")
      .insert({
        channel_id: dmChannelId,
        user_id: aliceId,
        content: `Segue o arquivo de notas 📎 [${tag}]`,
      })
      .select().single();
    expect(mErr).toBeNull();

    // attach
    const { error: attErr } = await alice.from("message_attachments").insert({
      message_id: msg!.id,
      file_name: `notas-${tag}.txt`,
      file_url: pub.publicUrl,
      file_type: "text/plain",
      file_size: fileContent.length,
    });
    expect(attErr).toBeNull();

    // bob can see message AND attachment
    const { data: bobView } = await bob
      .from("messages")
      .select("id, content, message_attachments(file_name, file_url)")
      .eq("id", msg!.id).single();
    expect(bobView!.content).toContain(tag);
    expect((bobView as any).message_attachments.length).toBe(1);
    expect((bobView as any).message_attachments[0].file_name).toBe(`notas-${tag}.txt`);
  });
});

describe("Integration: documentation organized by department folders", () => {
  let alice: SupabaseClient;
  let aliceId: string;
  const tag = `d${Date.now()}`;

  const departments: Array<{ name: string; icon: string; pages: Array<{ title: string; icon: string; content: string }> }> = [
    {
      name: "Engenharia",
      icon: "💻",
      pages: [
        {
          title: "Padrões de código",
          icon: "📐",
          content: `# Padrões de código

## Convenções gerais
- TypeScript estrito em todo o monorepo
- ESLint + Prettier obrigatórios antes do commit
- Nomes de componentes em PascalCase, hooks em camelCase com prefixo "use"

## Pull Requests
1. Branch a partir de \`main\` no formato \`feat/\`, \`fix/\` ou \`chore/\`
2. PR deve ter descrição, screenshots e checklist
3. Mínimo de 1 aprovação do time

## Testes
- Cobertura mínima de 70% em código novo
- Vitest para unidade, Playwright para e2e`,
        },
        {
          title: "Setup do ambiente",
          icon: "⚙️",
          content: `# Setup do ambiente

\`\`\`bash
git clone git@github.com:mooui/app.git
cd app
bun install
bun dev
\`\`\`

Variáveis de ambiente em \`.env.local\` — peça as credenciais ao @Alice.`,
        },
        {
          title: "Arquitetura",
          icon: "🏗️",
          content: `# Visão geral

- **Frontend:** React 18 + Vite + Tailwind
- **Backend:** Supabase (Postgres + RLS + Edge Functions)
- **CI/CD:** GitHub Actions → deploy em Vercel

## Decisões importantes
- RLS ativo em todas as tabelas
- Roles em tabela separada (\`user_roles\`) para evitar privilege escalation`,
        },
      ],
    },
    {
      name: "Produto",
      icon: "🎯",
      pages: [
        {
          title: "Roadmap Q2 2026",
          icon: "🗺️",
          content: `# Roadmap Q2 2026

## Abril
- ✅ Lançamento do módulo de Mensagens
- ✅ Avatares e perfis

## Maio
- 🚧 Notificações com @menções
- 🚧 Documentação colaborativa

## Junho
- 🔜 Integração com Google Calendar
- 🔜 Relatórios customizados`,
        },
        {
          title: "Pesquisa de usuários",
          icon: "🔍",
          content: `# Insights da pesquisa de Maio

Entrevistamos 12 clientes B2B. Principais descobertas:

1. **Onboarding** — 8/12 acharam confuso o primeiro acesso
2. **Mobile** — todos pediram melhor experiência no celular
3. **Permissões** — necessidade clara de Admin vs Membro

Próximos passos: redesenhar onboarding e validar com 5 usuários.`,
        },
      ],
    },
    {
      name: "Marketing",
      icon: "📣",
      pages: [
        {
          title: "Calendário editorial",
          icon: "📅",
          content: `# Conteúdos da semana

| Dia | Canal | Conteúdo |
|-----|-------|----------|
| Seg | Blog | "5 dicas de gestão ágil" |
| Qua | LinkedIn | Case do cliente Acme |
| Sex | Newsletter | Resumo do mês |

Responsável: @Alice`,
        },
        {
          title: "Tom de voz",
          icon: "🎙️",
          content: `# Tom de voz MOOUI

- **Próximo:** falamos como amigos do time
- **Direto:** sem jargão corporativo
- **Brasileiro:** linguagem natural, com bom humor moderado

Evitamos: "sinergia", "leverage", "deep dive".`,
        },
      ],
    },
    {
      name: "Recursos Humanos",
      icon: "🤝",
      pages: [
        {
          title: "Manual do colaborador",
          icon: "📘",
          content: `# Bem-vindo à MOOUI!

Este manual reúne tudo o que você precisa nos primeiros 30 dias.

## Benefícios
- Vale-refeição/alimentação flexível
- Plano de saúde Bradesco Top
- Day off no aniversário

## Horário
Trabalho remoto com horas flexíveis. Sync diário às 10h.`,
        },
        {
          title: "Política de férias",
          icon: "🏖️",
          content: `# Férias

- Solicitar com pelo menos 30 dias de antecedência
- Mínimo de 5 dias corridos por solicitação
- Pode ser parcelada em até 3 períodos

Solicitações em: rh@mooui.com`,
        },
      ],
    },
  ];

  beforeAll(async () => {
    alice = newClient();
    aliceId = await signIn(alice, ALICE);
  }, 30_000);

  afterAll(async () => {
    await alice.auth.signOut();
  });

  it("creates department folders with real documentation pages inside", async () => {
    let totalPages = 0;
    for (let i = 0; i < departments.length; i++) {
      const dept = departments[i];
      const { data: folder, error: fErr } = await alice
        .from("doc_pages")
        .insert({
          organization_id: ORG_ID,
          title: `${dept.name} [${tag}]`,
          icon: dept.icon,
          content: `# ${dept.name}\n\nPasta com a documentação do setor de ${dept.name}.`,
          position: i,
          created_by: aliceId,
        })
        .select()
        .single();
      expect(fErr).toBeNull();
      totalPages++;

      for (let j = 0; j < dept.pages.length; j++) {
        const p = dept.pages[j];
        const { error: pErr } = await alice.from("doc_pages").insert({
          organization_id: ORG_ID,
          parent_id: folder!.id,
          title: p.title,
          icon: p.icon,
          content: p.content,
          position: j,
          created_by: aliceId,
        });
        expect(pErr).toBeNull();
        totalPages++;
      }
    }
    expect(totalPages).toBe(departments.reduce((s, d) => s + 1 + d.pages.length, 0));
  });

  it("can read back the full tree with parents and children", async () => {
    const { data: folders } = await alice
      .from("doc_pages").select("id, title")
      .ilike("title", `%[${tag}]%`).is("parent_id", null);
    expect(folders!.length).toBe(departments.length);
    const { data: children } = await alice
      .from("doc_pages").select("id, parent_id")
      .in("parent_id", folders!.map(f => f.id));
    expect(children!.length).toBe(departments.reduce((s, d) => s + d.pages.length, 0));
  });
});
