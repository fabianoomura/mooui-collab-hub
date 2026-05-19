import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });

const ORG_BR  = "0d32934f-9628-4bd5-b3f4-1bc74f9227de";
const ORG_BCN = "66d7b347-7708-4ef0-9655-6c129d124596";

const PWD = "Mooui!2026";

// ---------- USERS to ensure ----------
const NEW_USERS = [
  // BRASIL - 12 novos
  { email: "ricardo.almeida@mooui.br", name: "Ricardo Almeida", org: ORG_BR, dept: "Diretoria",  pos: "Diretor de Operações", org_role: "admin",  app: "director" },
  { email: "camila.santos@mooui.br",   name: "Camila Santos",   org: ORG_BR, dept: "Marketing",  pos: "Gerente de Marketing", org_role: "member", app: "manager", dept_role: "manager" },
  { email: "lucas.pereira@mooui.br",   name: "Lucas Pereira",   org: ORG_BR, dept: "TI",         pos: "Gerente de TI",        org_role: "member", app: "it_support", dept_role: "manager" },
  { email: "amanda.costa@mooui.br",    name: "Amanda Costa",    org: ORG_BR, dept: "Vendas",     pos: "Gerente Comercial",    org_role: "member", app: "manager", dept_role: "manager" },
  { email: "rafael.lima@mooui.br",     name: "Rafael Lima",     org: ORG_BR, dept: "Design",     pos: "Designer Sênior",      org_role: "member", app: "operator", dept_role: "operator" },
  { email: "juliana.rocha@mooui.br",   name: "Juliana Rocha",   org: ORG_BR, dept: "Marketing",  pos: "Social Media",         org_role: "member", app: "operator", dept_role: "operator" },
  { email: "bruno.melo@mooui.br",      name: "Bruno Melo",      org: ORG_BR, dept: "TI",         pos: "Desenvolvedor",        org_role: "member", app: "it_support", dept_role: "operator" },
  { email: "patricia.alves@mooui.br",  name: "Patrícia Alves",  org: ORG_BR, dept: "Financeiro", pos: "Analista Financeiro",  org_role: "member", app: "operator", dept_role: "operator" },
  { email: "diego.fernandes@mooui.br", name: "Diego Fernandes", org: ORG_BR, dept: "Vendas",     pos: "Operador de Vendas",   org_role: "member", app: "operator", dept_role: "operator" },
  { email: "fernanda.gomes@mooui.br",  name: "Fernanda Gomes",  org: ORG_BR, dept: "Operações",  pos: "Logística",            org_role: "member", app: "operator", dept_role: "operator" },
  { email: "thiago.barbosa@mooui.br",  name: "Thiago Barbosa",  org: ORG_BR, dept: "Design",     pos: "Designer Jr",          org_role: "member", app: "operator", dept_role: "operator" },
  { email: "renata.cardoso@mooui.br",  name: "Renata Cardoso",  org: ORG_BR, dept: "Financeiro", pos: "Gerente Financeiro",   org_role: "member", app: "manager", dept_role: "manager" },

  // BARCELONA - 4 adicionais
  { email: "oriol.mas@mooui.bcn",      name: "Oriol Mas",       org: ORG_BCN, dept: "Financeiro", pos: "Gerente Financeiro",  org_role: "member", app: "manager", dept_role: "manager" },
  { email: "elena.serra@mooui.bcn",    name: "Elena Serra",     org: ORG_BCN, dept: "Marketing",  pos: "Social Media",        org_role: "member", app: "operator", dept_role: "operator" },
  { email: "marc.bosch@mooui.bcn",     name: "Marc Bosch",      org: ORG_BCN, dept: "TI",         pos: "Desenvolvedor",       org_role: "member", app: "it_support", dept_role: "operator" },
  { email: "clara.miro@mooui.bcn",     name: "Clara Miró",      org: ORG_BCN, dept: "Vendas",     pos: "Gerente Comercial",   org_role: "member", app: "manager", dept_role: "manager" },
];

async function ensureUser(u) {
  let id;
  // try find via listing pages
  let page = 1, found = null;
  while (true) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    found = data?.users.find((x) => x.email === u.email);
    if (found || !data?.users?.length || data.users.length < 200) break;
    page++;
  }
  if (!found) {
    const { data, error } = await admin.auth.admin.createUser({
      email: u.email, password: PWD, email_confirm: true,
      user_metadata: { full_name: u.name },
    });
    if (error) throw new Error(`${u.email}: ${error.message}`);
    id = data.user.id;
    console.log("  + created", u.email);
  } else {
    id = found.id;
  }
  await admin.from("profiles").upsert({ id, full_name: u.name, department: u.dept, position: u.pos }, { onConflict: "id" });
  await admin.from("organization_members").upsert({ organization_id: u.org, user_id: id, role: u.org_role }, { onConflict: "organization_id,user_id" });
  if (u.app) {
    await admin.from("user_roles").upsert({ user_id: id, role: u.app }, { onConflict: "user_id,role" });
  }
  if (u.dept && u.dept_role) {
    const { data: dept } = await admin.from("org_departments").select("id").eq("organization_id", u.org).eq("name", u.dept).maybeSingle();
    if (dept) await admin.from("department_members").upsert({ department_id: dept.id, user_id: id, role: u.dept_role }, { onConflict: "department_id,user_id" });
  }
  return id;
}

console.log("== Users ==");
const userIds = {};
for (const u of NEW_USERS) userIds[u.email] = await ensureUser(u);

// Helper: list all members per org
async function orgMembers(orgId) {
  const { data } = await admin.from("organization_members").select("user_id, role").eq("organization_id", orgId);
  const ids = data.map(d => d.user_id);
  const { data: profs } = await admin.from("profiles").select("id, full_name, department, position").in("id", ids);
  return profs.map(p => ({ ...p, role: data.find(d => d.user_id === p.id).role }));
}

const brMembers  = await orgMembers(ORG_BR);
const bcnMembers = await orgMembers(ORG_BCN);
console.log(`Brasil: ${brMembers.length} | Barcelona: ${bcnMembers.length}`);

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const daysAgo = (n) => new Date(Date.now() - n * 86400e3).toISOString();

// ---------- TICKET LABELS ----------
console.log("== Ticket labels ==");
const LABELS = [
  { name: "urgente",  color: "#ef4444" },
  { name: "bug",      color: "#f59e0b" },
  { name: "melhoria", color: "#3b82f6" },
  { name: "duvida",   color: "#8b5cf6" },
  { name: "hardware", color: "#10b981" },
];
const labelMap = { [ORG_BR]: {}, [ORG_BCN]: {} };
for (const org of [ORG_BR, ORG_BCN]) {
  for (const l of LABELS) {
    const { data: ex } = await admin.from("ticket_labels").select("id").eq("organization_id", org).eq("name", l.name).maybeSingle();
    if (ex) { labelMap[org][l.name] = ex.id; continue; }
    const { data } = await admin.from("ticket_labels").insert({ organization_id: org, name: l.name, color: l.color }).select("id").single();
    labelMap[org][l.name] = data.id;
  }
}

// ---------- TICKETS ----------
console.log("== Tickets ==");
const TICKET_TPLS = [
  { title: "Notebook não liga", cat: "hardware", pri: "high",   desc: "Pressionei o botão e nada acontece. Já testei outra tomada." },
  { title: "Erro 500 ao salvar pedido", cat: "bug", pri: "critical", desc: "Acontece no checkout quando o cliente é internacional." },
  { title: "Acesso ao Shopify expirado", cat: "access", pri: "medium", desc: "Pediram para resetar a senha do time de Marketing." },
  { title: "Impressora fiscal travando", cat: "hardware", pri: "high", desc: "Travou durante a emissão do cupom." },
  { title: "Dúvida sobre relatório financeiro", cat: "question", pri: "low", desc: "Como exportar o relatório consolidado mensal?" },
  { title: "Solicito novo monitor", cat: "request", pri: "medium", desc: "Para a estação do designer junior." },
  { title: "VPN caindo durante o dia", cat: "bug", pri: "high", desc: "Acontece principalmente entre 14h-17h." },
  { title: "Criar usuário para nova funcionária", cat: "request", pri: "medium", desc: "Início na próxima segunda." },
  { title: "Lentidão no ERP", cat: "bug", pri: "medium", desc: "Lista de produtos demora >10s para carregar." },
  { title: "Backup falhou ontem", cat: "bug", pri: "high", desc: "Notificação automática às 03:00." },
  { title: "Troca de teclado", cat: "request", pri: "low", desc: "Tecla F travada." },
  { title: "Habilitar 2FA para todos", cat: "improvement", pri: "medium", desc: "Política de segurança nova." },
];
const TICKET_COMMENTS = [
  "Pode reiniciar e me avisar?",
  "Já reproduzi aqui, escalei para o time.",
  "Tentei pelo navegador anônimo, mesmo erro.",
  "Vou abrir um chamado paralelo com o fornecedor.",
  "Resolvido temporariamente, monitorando.",
  "Reabri porque voltou a acontecer.",
  "Obrigado, pode fechar.",
  "Aguardando aprovação do gestor.",
];

async function seedTicketsFor(orgId, members) {
  const it = members.filter(m => ["TI", "Marketing", "Vendas", "Financeiro"].includes(m.department) || m.role === "admin");
  const support = members.filter(m => m.department === "TI");
  for (let i = 0; i < 14; i++) {
    const tpl = TICKET_TPLS[i % TICKET_TPLS.length];
    const author = pick(members);
    const assignee = pick(support.length ? support : it);
    const status = pick(["open", "open", "in_progress", "in_progress", "waiting", "resolved", "closed"]);
    const { data: t, error } = await admin.from("tickets").insert({
      organization_id: orgId,
      title: tpl.title + (i > 6 ? ` (#${i})` : ""),
      description: tpl.desc,
      category: tpl.cat,
      priority: tpl.pri,
      status,
      created_by: author.id,
      assigned_to: assignee.id,
      resolved_at: status === "resolved" || status === "closed" ? daysAgo(1 + (i%5)) : null,
      created_at: daysAgo(15 - i),
    }).select("id").single();
    if (error) { console.log("ticket err", error.message); continue; }
    // labels (1-2)
    const labelNames = LABELS.map(l => l.name).sort(() => Math.random() - 0.5).slice(0, 1 + (i % 2));
    for (const n of labelNames) {
      await admin.from("ticket_label_assignments").insert({ ticket_id: t.id, label_id: labelMap[orgId][n] }).then(() => {}, () => {});
    }
    // comments
    const nComments = 1 + (i % 4);
    for (let c = 0; c < nComments; c++) {
      const u = c % 2 === 0 ? assignee : author;
      await admin.from("ticket_comments").insert({ ticket_id: t.id, user_id: u.id, content: pick(TICKET_COMMENTS) });
    }
    // activity
    await admin.from("ticket_activity").insert({ ticket_id: t.id, user_id: author.id, action: "created", to_value: tpl.title });
    if (status !== "open") {
      await admin.from("ticket_activity").insert({ ticket_id: t.id, user_id: assignee.id, action: "status", from_value: "open", to_value: status });
    }
  }
}
await seedTicketsFor(ORG_BR, brMembers);
await seedTicketsFor(ORG_BCN, bcnMembers);

// ---------- CHANNELS + MESSAGES ----------
console.log("== Channels & messages ==");
const CHANNELS = [
  { name: "geral",       desc: "Anúncios e tudo o mais" },
  { name: "marketing",   desc: "Campanhas, social, conteúdo" },
  { name: "ti-suporte",  desc: "Chamados rápidos e dicas" },
  { name: "vendas",      desc: "Pipeline, parcerias, atacado" },
  { name: "lancamentos", desc: "Coordenação de coleções" },
];
const TXT = [
  "Bom dia time! Como foi o final de semana?",
  "Alguém pode revisar a campanha de hoje? 🙌",
  "Subiu uma nova versão no staging, podem testar.",
  "Fechei mais um pedido grande de atacado 🎉",
  "Reunião às 15h, sala azul.",
  "Acabei de enviar o brief no email.",
  "Quem fica responsável pela arte do Black Friday?",
  "Achei um bug na home, abri ticket.",
  "Pessoal, vamos almoçar juntos hoje?",
  "Resultado de ontem ficou ótimo, parabéns!",
  "Preciso de ajuda com o Shopify, alguém disponível?",
  "Vou tirar férias semana que vem, qualquer coisa fala com a Camila.",
  "Subi o relatório no Drive.",
  "Atualizei a página de runbook lá nos Docs.",
];
const EMOJIS = ["👍", "❤️", "🎉", "🙌", "😂", "🔥"];

async function seedChannelsFor(orgId, members) {
  const admin0 = members.find(m => m.role === "admin") || members[0];
  for (const ch of CHANNELS) {
    let { data: existing } = await admin.from("channels").select("id").eq("organization_id", orgId).eq("name", ch.name).maybeSingle();
    let channelId;
    if (existing) channelId = existing.id;
    else {
      const { data } = await admin.from("channels").insert({
        organization_id: orgId, name: ch.name, description: ch.desc,
        is_private: false, is_dm: false, created_by: admin0.id,
      }).select("id").single();
      channelId = data.id;
    }
    // add all members
    for (const m of members) {
      await admin.from("channel_members").insert({ channel_id: channelId, user_id: m.id }).then(() => {}, () => {});
    }
    // skip if already has messages
    const { count } = await admin.from("messages").select("id", { count: "exact", head: true }).eq("channel_id", channelId);
    if ((count ?? 0) > 5) continue;
    // post messages
    const created = [];
    for (let i = 0; i < 18; i++) {
      const u = pick(members);
      const { data: msg } = await admin.from("messages").insert({
        channel_id: channelId, user_id: u.id, content: pick(TXT),
        created_at: daysAgo(10 - i / 2),
      }).select("id").single();
      if (msg) created.push({ id: msg.id, user_id: u.id });
    }
    // threads
    for (let i = 0; i < 4; i++) {
      const parent = pick(created);
      const u = pick(members.filter(m => m.id !== parent.user_id));
      await admin.from("messages").insert({
        channel_id: channelId, user_id: u.id, content: pick(TXT),
        parent_message_id: parent.id,
      });
    }
    // reactions
    for (let i = 0; i < 12; i++) {
      const m = pick(created);
      const u = pick(members);
      await admin.from("message_reactions").insert({ message_id: m.id, user_id: u.id, emoji: pick(EMOJIS) }).then(() => {}, () => {});
    }
  }
}
await seedChannelsFor(ORG_BR, brMembers);
await seedChannelsFor(ORG_BCN, bcnMembers);

// ---------- MEETING ROOMS + BOOKINGS ----------
console.log("== Meeting rooms ==");
async function seedRoomsFor(orgId, members) {
  const admin0 = members.find(m => m.role === "admin") || members[0];
  const rooms = [
    { name: "Sala Azul",     capacity: 8,  color: "#3b82f6" },
    { name: "Sala Verde",    capacity: 4,  color: "#10b981" },
    { name: "Sala Reunião Diretoria", capacity: 12, color: "#D6336C" },
  ];
  for (const r of rooms) {
    const { data: ex } = await admin.from("meeting_rooms").select("id").eq("organization_id", orgId).eq("name", r.name).maybeSingle();
    let id = ex?.id;
    if (!id) {
      const { data } = await admin.from("meeting_rooms").insert({ organization_id: orgId, ...r, created_by: admin0.id }).select("id").single();
      id = data.id;
    }
    // bookings
    const { count } = await admin.from("meeting_room_bookings").select("id", { count: "exact", head: true }).eq("room_id", id);
    if ((count ?? 0) > 2) continue;
    for (let d = 0; d < 5; d++) {
      const start = new Date(); start.setDate(start.getDate() + d); start.setHours(10 + d, 0, 0, 0);
      const end   = new Date(start); end.setHours(start.getHours() + 1);
      const u = pick(members);
      await admin.from("meeting_room_bookings").insert({
        organization_id: orgId, room_id: id, user_id: u.id,
        title: pick(["Reunião semanal", "Planejamento Q2", "1:1", "Review de campanha", "Daily"]),
        description: "Reunião agendada via seed",
        starts_at: start.toISOString(), ends_at: end.toISOString(),
      }).then(() => {}, () => {});
    }
  }
}
await seedRoomsFor(ORG_BR, brMembers);
await seedRoomsFor(ORG_BCN, bcnMembers);

// ---------- ANNUAL EVENTS ----------
console.log("== Annual events ==");
async function seedEvents(orgId, members) {
  const admin0 = members.find(m => m.role === "admin") || members[0];
  const today = new Date();
  const evs = [
    { title: "Lançamento Coleção Verão", cat: "lancamento", color: "#D6336C", offset: -10, end: -5 },
    { title: "Black Friday", cat: "acao", color: "#000000", offset: 30, end: 32 },
    { title: "Feira do setor", cat: "evento", color: "#3b82f6", offset: 45, end: 47 },
    { title: "Campanha Dia das Mães", cat: "acao", color: "#ec4899", offset: 60, end: 65 },
    { title: "Inventário anual", cat: "operacional", color: "#10b981", offset: 90, end: 92 },
  ];
  for (const e of evs) {
    const start = new Date(today); start.setDate(start.getDate() + e.offset);
    const end = new Date(today); end.setDate(end.getDate() + e.end);
    await admin.from("annual_events").insert({
      organization_id: orgId, title: e.title, category: e.cat, color: e.color,
      start_date: start.toISOString().slice(0,10),
      end_date: end.toISOString().slice(0,10),
      created_by: admin0.id,
    }).then(() => {}, () => {});
  }
}
await seedEvents(ORG_BR, brMembers);
await seedEvents(ORG_BCN, bcnMembers);

// ---------- LAUNCHES ----------
console.log("== Launches ==");
async function seedLaunches(orgId, members) {
  const admin0 = members.find(m => m.role === "admin") || members[0];
  const launches = [
    { name: "Coleção Outono 2026", offset: -20 },
    { name: "Cápsula Vintage",     offset: -5 },
  ];
  for (const L of launches) {
    const start = new Date(); start.setDate(start.getDate() + L.offset);
    const { data: l } = await admin.from("launches").insert({
      organization_id: orgId, name: L.name,
      description: "Lançamento de coleção sazonal",
      status: "active", start_date: start.toISOString().slice(0,10),
      created_by: admin0.id,
    }).select("id").single();
    const stages = ["Briefing", "Desenvolvimento", "Aprovação", "Produção", "Marketing", "Lançamento"];
    for (let i = 0; i < stages.length; i++) {
      const s = new Date(start); s.setDate(s.getDate() + i * 7);
      const e = new Date(s); e.setDate(e.getDate() + 6);
      await admin.from("launch_stages").insert({
        launch_id: l.id, name: stages[i], position: i, duration_days: 7,
        planned_start: s.toISOString().slice(0,10),
        planned_end: e.toISOString().slice(0,10),
        status: i < 2 ? "done" : i === 2 ? "in_progress" : "pending",
        assignee_id: pick(members).id,
      });
    }
  }
}
await seedLaunches(ORG_BR, brMembers);
await seedLaunches(ORG_BCN, bcnMembers);

// ---------- DOC PAGES (limpa demos antigas de Brasil que poluem? não, só adiciona) ----------
console.log("== Doc pages ==");
async function seedDocs(orgId, members) {
  const admin0 = members.find(m => m.role === "admin") || members[0];
  const pages = [
    { title: "🏠 Wiki da Empresa", icon: "🏠", content: "# Bem-vindo!\n\nEste é o ponto central de documentação da organização." },
    { title: "📋 Onboarding novos colaboradores", icon: "📋", content: "## Primeiro dia\n- Receber notebook\n- Configurar VPN\n- Acessar Slack\n\n## Primeira semana\n- 1:1 com gestor direto\n- Tour pelos produtos" },
    { title: "🚀 Runbook - Deploy de produção", icon: "🚀", content: "1. Aprovar PR\n2. Rodar testes\n3. Deploy via CI\n4. Validar monitoramento" },
    { title: "💰 Política de despesas", icon: "💰", content: "Limites:\n- Almoço: R$ 80\n- Transporte: livre com justificativa\n- Treinamentos: aprovação prévia" },
    { title: "🎨 Brand guidelines", icon: "🎨", content: "Cor primária: #D6336C\nFonte: Inter\nLogo: nunca distorça" },
  ];
  for (const p of pages) {
    const { data: ex } = await admin.from("doc_pages").select("id").eq("organization_id", orgId).eq("title", p.title).maybeSingle();
    if (ex) continue;
    await admin.from("doc_pages").insert({
      organization_id: orgId, title: p.title, icon: p.icon, content: p.content,
      created_by: admin0.id,
    });
  }
}
await seedDocs(ORG_BR, brMembers);
await seedDocs(ORG_BCN, bcnMembers);

// ---------- NOTIFICATIONS ----------
console.log("== Notifications ==");
async function seedNotifs(members) {
  for (const m of members) {
    await admin.from("notifications").insert([
      { user_id: m.id, type: "info",    title: "Bem-vindo ao MOOUI!", message: "Sua conta foi atualizada com dados de exemplo.", link: "/dashboard" },
      { user_id: m.id, type: "ticket",  title: "Novo ticket atribuído a você", message: "Confira a fila de tickets.", link: "/tickets" },
      { user_id: m.id, type: "mention", title: "Você foi mencionado", message: "No canal #geral", link: "/messages" },
    ]).then(() => {}, () => {});
  }
}
await seedNotifs([...brMembers, ...bcnMembers]);

console.log("\n✅ Seed concluído!");
