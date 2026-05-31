# MOOUI Collab Hub — Documento de Melhoria Profunda

## Quem é a MOOUI

A MOOUI é uma marca de moda com operação no Brasil e Barcelona. Produz a maioria dos seus itens do zero — da concepção ao produto final. Tem marketing forte e atuante, TI interno que cuida de sistema, integrações e site, equipe enxuta onde cada pessoa é uma engrenagem de um sistema complexo. O ecommerce roda em Shopify, com ERP TOTVS. A empresa está expandindo.

O Collab Hub nasceu como sistema interno para orquestrar essa operação. Não é um SaaS genérico — é o sistema nervoso da MOOUI.

---

## Visão Geral do Sistema Atual

### Arquitetura
- **Frontend:** React 18 + TypeScript + Vite + TanStack React Query
- **Backend:** Supabase (Auth, PostgreSQL com RLS, Storage, Realtime, Edge Functions em Deno)
- **UI:** shadcn/ui (Radix) + Tailwind CSS
- **Multi-tenant:** Organizações com hierarquia de 5 níveis (admin, director, manager, operator, member)

### Os 13 Módulos

| # | Módulo | Nome interno | Rota | Propósito |
|---|--------|-------------|------|-----------|
| 1 | **Dashboard** | Início | `/` | Painel pessoal — agenda, atrasados, pendências, resumo do dia |
| 2 | **Sunday** | Projetos/Tabela | `/projetos`, `/tabela` | Gestão de tarefas estilo Monday.com — kanban, tabela, subtarefas |
| 3 | **Speaks** | Mensagens | `/mensagens` | Chat por canais — públicos, privados, DMs, threads, reações, anexos |
| 4 | **Papelinho** | Docs | `/docs` | Wiki colaborativa — documentos organizados por pastas |
| 5 | **Salas** | Rooms | `/salas` | Reserva de salas de reunião — grade horária visual |
| 6 | **Equipe** | Team | `/equipe` | Diretório de membros da organização |
| 7 | **Calendário de Marketing** | Calendário | `/calendario` | Calendário anual — lançamentos, ações, marcos, datas importantes |
| 8 | **Produção** | Lançamentos | `/lancamentos` | Pipeline de lançamentos — etapas sequenciais com Gantt, assignees, datas |
| 9 | **Check Lançamentos** | Checagens | `/checagens` | Checklists de lançamento — itens com status, responsável, prazo |
| 10 | **Pedidos** | Orders | `/pedidos` | Gestão de pedidos problemáticos — SAC ↔ Expedição |
| 11 | **Tickets de TI** | Tickets | `/tickets` | Chamados internos de TI — bugs, acessos, integrações |
| 12 | **Configurações** | Settings | `/configuracoes` | Gestão de org — usuários, setores, permissões, emails, logo |
| 13 | **Command Palette** | - | `Ctrl+K` | Busca global e navegação rápida |

---

## Diagnóstico por Módulo

### 1. Dashboard (Início)

**O que faz bem:**
- Consolida tarefas, etapas de lançamento, checklist items, reservas de sala e eventos numa timeline pessoal
- Mostra atrasados com destaque visual
- Cards de mensagens recentes, tickets e pedidos

**O que falta:**
- **Sem ações rápidas:** O usuário vê que tem uma tarefa atrasada mas precisa navegar até o módulo para atuar. Deveria ter botão "Concluir" / "Mover para em andamento" direto no card.
- **Sem visão de equipe:** Um gerente não vê a carga da equipe. Não sabe se o time está sobrecarregado ou ocioso.
- **Sem métricas de ciclo:** Quantos pedidos entraram vs. foram resolvidos essa semana? Qual o tempo médio de resolução de ticket? Qual a velocidade de conclusão de tarefas?
- **Sem distinção de urgência:** Tudo tem o mesmo peso visual. Um pedido com "furo de estoque" deveria gritar mais que um pedido de "presente".
- **Sem filtro temporal:** Fixo em 7 dias. Deveria poder ver "hoje", "esta semana", "este mês".

**Melhorias propostas:**
1. **Quick actions no card** — botão de conclusão rápida para tasks, stages e checklist items sem sair do dashboard
2. **Painel de gestão** — visão do gerente com carga por pessoa, gargalos, e distribuição de trabalho (acessível para roles >= manager)
3. **KPIs da semana** — mini-gráficos: tarefas concluídas, tickets resolvidos, pedidos fechados, tempo médio
4. **Filtro de período** — toggle "Hoje / 7 dias / 30 dias" no topo

---

### 2. Sunday (Gestão de Tarefas)

**O que faz bem:**
- Visão de tabela estilo Monday.com com colunas dinâmicas, labels customizáveis, agrupamento
- Subtarefas, prioridades, datas com range (início/fim)
- Side panel com abas (Atualizações, Arquivos, Log de atividade, Informações, Links)
- Cross-link com Calendário
- Atribuição múltipla de responsáveis com checkboxes

**O que falta:**
- **Sem automações:** Quando um item muda para "Feito", nada acontece automaticamente. Em empresas pequenas, automações como "ao concluir tarefa X, criar tarefa Y" ou "ao vencer prazo, notificar gerente" são críticas.
- **Sem dependências entre tarefas:** Não é possível dizer "tarefa B só começa quando A terminar". Para produção de moda isso é vital — corte depende de modelagem, costura depende de corte.
- **Sem templates de projeto:** Cada novo lançamento começa do zero. Deveria ter templates como "Lançamento Padrão" com estrutura pré-definida.
- **Sem visão de timeline/Gantt:** A tabela é ótima para gestão, mas falta visão temporal. Quando é que tudo se encaixa?
- **Sem campo de esforço/estimativa:** Não dá pra saber se alguém tem 2h ou 40h de trabalho pendente.
- **Sem filtro por responsável:** Na tabela, não consigo filtrar "só minhas tarefas" ou "tarefas do João".
- **Comentários não salvam no banco (modal antigo):** O `TaskDetailModal` tem um campo de comentário que só reseta o state — não persiste. O `TaskSidePanel` usa `useTaskComments` e funciona corretamente, mas o modal antigo não.

**Melhorias propostas:**
1. **Templates de projeto** — salvar/carregar estrutura de tarefas pré-definida (ex: "Lançamento de Coleção" com 15 tarefas padrão)
2. **Filtro por responsável** — na toolbar da tabela, adicionar filtro "Pessoas" com multi-select
3. **Dependências visuais** — campo "bloqueado por" que impede mover para "Em Andamento" até a dependência ser concluída
4. **Automações simples** — "Quando status = Feito → notificar gerente" / "Quando prazo = hoje → marcar como urgente"
5. **View de timeline** — Gantt simplificado usando start_date/due_date das tarefas
6. **Remover o TaskDetailModal** ou unificar com TaskSidePanel — atualmente existem dois componentes fazendo a mesma coisa, o side panel é superior

---

### 3. Speaks (Mensagens)

**O que faz bem:**
- Canais públicos e privados com threads
- DMs com busca de membros
- Reações com emojis
- Anexos de arquivo (upload/download)
- Edição e exclusão de mensagens
- Contagem de não-lidos com badge
- Realtime via Supabase

**O que falta:**
- **Sem menções (@user):** O campo tem botão de @ mas não funciona. Não notifica a pessoa mencionada.
- **Sem busca de mensagens:** Não consigo buscar "aquele link que o João mandou semana passada".
- **Sem fixar mensagem:** Informações importantes se perdem no fluxo.
- **Sem integração com módulos:** Quando alguém cria um pedido, um ticket, ou conclui uma etapa de lançamento, poderia postar automaticamente no canal relevante. Ex: canal "#expedição" recebe aviso de novos pedidos.
- **Sem notificação push/desktop:** Mensagem nova não avisa se o usuário não está olhando.
- **Canais não têm descrição nem propósito definido:** Não sei pra que serve cada canal.

**Melhorias propostas:**
1. **@menções funcionais** — autocomplete de membros, notificação via notify_user ao mencionar
2. **Busca de mensagens** — campo de busca no topo com filtro por canal/autor/data
3. **Mensagem fixada** — pin/unpin com seção "fixados" no topo do canal
4. **Posts automáticos de módulos** — hook que envia mensagem ao canal quando: pedido criado, ticket urgente aberto, etapa de lançamento concluída. Configurável por canal.
5. **Descrição do canal** — campo de descrição visível no header do canal

---

### 4. Papelinho (Docs)

**O que faz bem:**
- Editor de texto com organização por pastas
- CRUD completo de documentos e pastas

**O que falta:**
- **Sem editor rico:** Provavelmente texto simples ou markdown básico. Para documentação de processos, precisa de: headings, listas, tabelas, imagens, código.
- **Sem busca de conteúdo:** Não busca dentro do texto dos docs.
- **Sem versionamento:** Não sei quem editou o quê, nem consigo voltar a uma versão anterior.
- **Sem templates de doc:** "Procedimento Operacional", "Ata de Reunião", "Briefing de Produto" — templates aceleram a padronização.
- **Sem link com tarefas:** Um doc de briefing deveria linkar ao lançamento correspondente.

**Melhorias propostas:**
1. **Editor rico** — integrar TipTap ou similar com toolbar de formatação
2. **Busca full-text** — buscar dentro do conteúdo dos documentos
3. **Templates** — modelos pré-definidos para tipos comuns de documento
4. **Cross-link com módulos** — vincular docs a lançamentos, projetos via module_links

---

### 5. Salas (Reservas)

**O que faz bem:**
- Grade visual de horários por sala
- Reserva com título, horário de início e fim
- Exibe no dashboard pessoal

**O que falta:**
- **Sem verificação de conflito visível:** Se alguém tenta reservar um horário já ocupado, o feedback não é claro.
- **Sem recorrência:** Reunião semanal precisa ser criada toda semana manualmente.
- **Sem integração com Google Calendar:** A equipe provavelmente usa Google Calendar. Sem sync, a sala de reunião fica com dois sistemas de verdade.

**Melhorias propostas:**
1. **Validação de conflito** — bloquear e mostrar mensagem clara ao tentar reservar horário ocupado
2. **Reserva recorrente** — "Toda segunda às 10h" criando N bookings automaticamente
3. **Integração Google Calendar** (futuro) — criar evento no GCal ao reservar sala

---

### 6. Equipe (Diretório)

**O que faz bem:**
- Lista de membros com foto, nome, setor, cargo

**O que falta:**
- **Informação estática:** Não mostra o que a pessoa está fazendo agora. Num time enxuto, saber "o João está com 5 tarefas atrasadas" é crucial.
- **Sem organograma visual:** Quem reporta a quem? Qual a estrutura?

**Melhorias propostas:**
1. **Status de carga** — badge com contagem de tarefas abertas/atrasadas por pessoa
2. **Organograma** — visual tree com hierarquia de setores e roles

---

### 7. Calendário de Marketing

**O que faz bem:**
- Visão anual com grid mensal
- Categorias: lançamento, ação, marco, data importante
- Filtro por categoria e busca
- Cores por categoria
- Suporte a instâncias múltiplas (ModuleInstanceBar)

**O que falta:**
- **Sem drag-and-drop para reagendar:** Preciso abrir dialog para mudar data.
- **Sem visão semanal/diária:** Só tem a visão anual. Quando a equipe está no "calor" de um mês de lançamento, precisa de zoom.
- **Sem ligação forte com Produção:** Quando um lançamento muda de data, o evento no calendário deveria atualizar automaticamente.

**Melhorias propostas:**
1. **Drag-and-drop** — arrastar evento para nova data no grid
2. **View mensal detalhada** — zoom em um mês específico com mais detalhes por dia
3. **Sync automático com Produção** — quando datas de um lançamento mudam, o evento linkado atualiza

---

### 8. Produção (Lançamentos)

**O que faz bem:**
- Pipeline de etapas sequenciais com Gantt visual
- Drag-and-drop para reordenar etapas
- Recálculo automático de datas ao mover etapas
- Assignee por etapa com busca de membros
- Duplicação de lançamento
- Seed de etapas padrão
- Cross-link com Calendário e Checklists
- LinkedItems mostrando vínculos

**O que falta:**
- **Sem % de progresso:** Não sei visualmente se o lançamento está 30% ou 80% concluído.
- **Sem alertas proativos:** A etapa está vencida e ninguém sabe. O ai-agent existe mas precisa de cron configurado.
- **Sem fotos/anexos na etapa:** Uma etapa "Prova de roupa" precisa de fotos do fitting. Hoje não tem onde anexar.
- **Sem custo/orçamento:** Para uma empresa que produz do zero, saber o custo acumulado por etapa é estratégico.
- **Sem histórico de mudanças:** Quem mudou a data? Quando? Por quê?

**Melhorias propostas:**
1. **Barra de progresso** — calcular % baseado em etapas concluídas vs. total
2. **Alertas visuais de risco** — etapa com prazo < 48h amarelo, vencida = vermelho piscante
3. **Anexos por etapa** — upload de fotos/arquivos na etapa (similar a task files)
4. **Activity log** — registrar mudanças de data, status e assignee
5. **Dashboard de produção** — visão panorâmica: todos os lançamentos, progresso, gargalos

---

### 9. Check Lançamentos (Checklists)

**O que faz bem:**
- Checklists com itens categorizados
- Status por item (pendente, em andamento, feito, N/A)
- Assignee e due_date por item
- Templates reutilizáveis
- Vinculado a lançamentos via launch_id + module_links

**O que falta:**
- **Sem dependência entre itens:** "Aprovar embalagem" depende de "Finalizar arte". Não tem como expressar isso.
- **Sem evidência:** Item "Verificar estoque" — verificou e deu OK? Onde está a prova? Deveria ter campo de notas/anexo por item.
- **Sem visão consolidada:** Gerente não vê "de todos os lançamentos ativos, quais checklists estão atrasadas?"

**Melhorias propostas:**
1. **Campo de evidência/notas** — texto + upload por item ao concluir
2. **Visão consolidada** — painel com todos os checklists ativos, filtrado por status e responsável
3. **Dependências entre itens** — bloquear item até dependência ser concluída

---

### 10. Pedidos (SAC ↔ Expedição)

**O que faz bem:**
- Tipos de problema mapeados (furo de estoque, presente, troca, devolução, etc.)
- Status workflow (aberto → em andamento → aguardando → enviado/finalizado)
- Comentários por pedido
- Prioridade e código do pedido Shopify
- Assignee com picker
- Notificações ao criar/atualizar/comentar
- Activity log

**O que falta:**
- **Sem SLA visível:** Pedido aberto há 72h deveria estar gritando. Hoje é só uma data de criação que ninguém calcula mentalmente.
- **Sem métricas:** Quantos pedidos por tipo? Qual o tempo médio de resolução? Qual fonte gera mais problemas?
- **Sem integração com Shopify:** O código é digitado manualmente. Deveria puxar dados do pedido automaticamente (cliente, itens, tracking).
- **Sem escalation automático:** Pedido sem tratativa há 48h deveria escalar para gerente automaticamente.
- **Sem fotos/anexos:** "O cliente recebeu o produto com defeito" — cadê a foto?

**Melhorias propostas:**
1. **Timer de SLA** — badge visual mostrando há quanto tempo o pedido está aberto, com cores (verde < 24h, amarelo < 48h, vermelho > 48h)
2. **Dashboard de pedidos** — gráficos: volume por dia, por tipo de problema, por fonte, tempo médio
3. **Anexos no pedido** — upload de fotos/arquivos (print do SAC, foto do defeito)
4. **Escalation automático** — pedido sem atualização > 48h → notificar gerente + diretores
5. **Link com Shopify** (futuro) — dado o código do pedido, puxar info via API

---

### 11. Tickets de TI

**O que faz bem:**
- Workflow de chamados (aberto → em andamento → resolvido → fechado)
- Prioridade (baixa, média, alta, crítica)
- SLA configurável
- Anexos durante criação e na aba de arquivos
- Categorias (bug, acesso, integração, etc.)
- Gestor de TI com role `it_support`
- Tabs de filtro (Meus tickets, Gestão TI)

**O que falta:**
- **Sem tempo de resposta/resolução medido:** SLA existe como conceito na UI mas não é calculado ativamente.
- **Sem knowledge base:** O mesmo problema se repete e ninguém documenta a solução. Deveria ter link com Papelinho.
- **Sem priorização automática:** Ticket de "site fora do ar" deveria automaticamente ser crítico.
- **Sem notificação para o time de TI:** Quando um ticket novo é criado, o time de TI deveria ser notificado no Speaks.

**Melhorias propostas:**
1. **SLA ativo** — cronômetro real mostrando tempo desde abertura e tempo desde última resposta
2. **Link com Papelinho** — ao resolver ticket, opção de criar artigo na wiki com a solução
3. **Notificação para canal #ti** — ticket novo → mensagem automática no Speaks
4. **Relatório de TI** — gráfico: tickets por mês, tempo médio de resolução, por categoria

---

### 12. Configurações

**O que faz bem:**
- Gestão completa de usuários com wizard de 3 passos
- Multi-setor por usuário com setor principal
- Hierarquia de permissão de 5 níveis
- Suporte TI como role toggleável
- Reset de senha com cópia
- Email preferences com toggles
- Upload de logo da organização

**O que falta:**
- **Sem audit log:** Quem mudou a permissão de quem? Quando alguém foi removido?
- **Sem convite por email:** Criar usuário exige definir senha. Deveria ter "enviar convite por email".
- **Sem status ativo/inativo:** Usuário saiu de férias ou da empresa. Não tem como desativar sem remover.

**Melhorias propostas:**
1. **Audit log de configurações** — registrar mudanças de role, remoções, criações
2. **Status ativo/inativo** — desativar usuário sem deletar
3. **Convite por email** (depende do email funcional) — enviar magic link de cadastro

---

### 13. Command Palette (Ctrl+K)

**O que faz bem:**
- Busca global de rotas, tarefas, tickets, pedidos e docs
- Debounce de 300ms
- Ícones por tipo de resultado
- Navegação direta ao clicar

**O que falta:**
- **Sem busca de mensagens:** Não busca no Speaks.
- **Sem ações rápidas:** "Criar tarefa", "Abrir ticket", "Novo pedido" direto do Ctrl+K.
- **Sem resultados de membros:** Buscar "João" deveria mostrar o perfil do João.

**Melhorias propostas:**
1. **Busca de mensagens** — buscar no conteúdo das mensagens
2. **Ações rápidas** — seção "Ações" com criar tarefa, ticket, pedido, doc
3. **Busca de pessoas** — resultados de profiles

---

## Diagnóstico Cross-Module

### Conexões Atuais (implementadas)

```
Sunday (Tarefas) ──→ Calendário de Marketing    via module_links
Produção ──→ Check Lançamentos                   via launch_id FK + module_links
Produção ──→ Calendário de Marketing             via module_links
Todos os módulos ──→ Dashboard                    via queries diretas
Notificações: Orders, Launches, Checklists       via notify_user RPC
```

### Conexões Ausentes (oportunidades)

```
Speaks ✓ Módulos operacionais     — ✅ auto-posts de pedidos (#expedição) e tickets (#ti)
Papelinho ✗ Tickets               — sem knowledge base linkada
Papelinho ✗ Produção              — sem briefing vinculado ao lançamento
Sunday ✗ Produção                 — uma tarefa não pode ser vinculada a uma etapa de lançamento
Pedidos ✓ Dashboard               — ✅ KPIs + OrdersReport com métricas
Tickets ✓ Dashboard               — ✅ KPIs + TicketsReport com métricas
```

### Gaps Sistêmicos

1. ~~**Sem relatórios/analytics em nenhum módulo.**~~ ✅ **RESOLVIDO** — KPIPanel no Dashboard, OrdersReport, TicketsReport, carga de trabalho no TeamPage.

2. **Parcialmente resolvido: automações.** Auto-posts no Speaks, escalation de pedidos e notificações proativas implementados. Falta engine de automações customizáveis ("quando X, faça Y").

3. **Sem timeline unificada.** Cada módulo tem sua própria visão de tempo. Não existe um lugar onde eu veja: "mês de outubro — lançamento A (etapas 1-5), campanha B (3 tarefas), 2 eventos de marketing, reserva de estúdio dia 15".

4. **Sem mobile-first.** O Gantt de Produção, a grade de Salas e o Calendário não funcionam bem em telas pequenas. Para equipe de expedição e produção que acessa por celular, isso é bloqueante.

5. **Sem onboarding.** Novo funcionário entra e não sabe o que é cada módulo. Sem tour guiado, sem primeira experiência.

---

## Plano de Evolução — 4 Horizontes

### Pré-Horizonte: Fundação ✅ CONCLUÍDO
> Estrutura essencial e limpeza técnica.

| Item | Módulo | Status |
|------|--------|--------|
| Subtarefas visíveis no Kanban (chip count) | Sunday | ✅ |
| TaskSidePanel com aba Subelementos (criar/toggle subtarefas) | Sunday | ✅ |
| Mover/promover elementos entre níveis (nesting via context menu) | Sunday | ✅ |
| Carga de trabalho por membro | Equipe | ✅ |
| Dashboard dinâmico (filtro Hoje/7d/30d + prioridade visual) | Dashboard | ✅ |
| Remoção do branding Lovable (tagger, meta tags, preview) | Global | ✅ |

### Horizonte 1: Refinamento (1-2 semanas) ✅ CONCLUÍDO
> Melhorias que não mudam estrutura, só polimento e correções.

| Item | Módulo | Impacto | Status |
|------|--------|---------|--------|
| Quick actions no Dashboard | Dashboard | Alto — reduz cliques | ✅ Concluir + Iniciar direto no card |
| Filtro por responsável na tabela | Sunday | Alto — usabilidade diária | ✅ Filtro por assignee implementado |
| Timer de SLA nos Pedidos | Pedidos | Alto — visibilidade operacional | ✅ SlaBadge com cores verde/amarelo/vermelho |
| SLA ativo nos Tickets | Tickets | Alto — cobrança de tempo | ✅ SlaBadge + filtro por SLA estourado |
| Barra de progresso nos Lançamentos | Produção | Médio — visibilidade | ✅ Progress bar por lançamento |
| Remover TaskDetailModal duplicado | Sunday | Médio — dívida técnica | ✅ Removido (zero imports, dead code) |
| Anexos nos Pedidos | Pedidos | Alto — precisa de evidência | ✅ Upload/download de arquivos |
| Descrição nos canais do Speaks | Speaks | Baixo — organização | ✅ Inline editing para owner/admin |

### Horizonte 2: Inteligência (2-4 semanas) ✅ CONCLUÍDO
> Funcionalidades que adicionam insight e reduzem trabalho manual.

| Item | Módulo | Impacto | Status |
|------|--------|---------|--------|
| Dashboard de métricas (KPIs) | Dashboard | Alto — decisão baseada em dados | ✅ KPIPanel com tendências semanais |
| Painel de gestão (visão do gerente) | Dashboard | Alto — gestão de equipe | ✅ Carga de trabalho no TeamPage + KPIs |
| @menções funcionais no Speaks | Speaks | Alto — comunicação efetiva | ✅ Já existente (autocomplete + notify) |
| Posts automáticos de módulos no Speaks | Speaks | Alto — transparência | ✅ useAutoPost → #expedição e #ti |
| Busca de mensagens | Speaks | Médio — produtividade | ✅ Search com resultados inline |
| Relatório de Pedidos | Pedidos | Alto — analytics operacional | ✅ OrdersReport com toggle |
| Relatório de Tickets | Tickets | Médio — analytics de TI | ✅ TicketsReport com toggle |
| Templates de projeto | Sunday | Alto — padronização | ✅ Salvar/carregar templates com hierarquia |
| Activity log em Produção | Produção | Médio — rastreabilidade | ✅ launch_stage_activity + UI |
| Campo de evidência em Checklists | Check | Médio — conformidade | ✅ evidence_notes com Popover |
| Escalation automático de pedidos | Pedidos | Alto — SLA operacional | ✅ Notifica managers após 48h sem update |

### Horizonte 3: Integração (1-2 meses) ✅ CONCLUÍDO
> Conectar módulos entre si e com sistemas externos.

| Item | Módulo | Impacto | Status |
|------|--------|---------|--------|
| Sync Produção → Calendário (automático) | Produção + Calendário | Alto — single source of truth | ✅ Já funcional via createEvent + module_links |
| Link Papelinho ↔ Produção (briefings) | Docs + Produção | Médio — contexto | ✅ Select "Vincular documento" no LaunchDetail |
| Link Tickets → Papelinho (knowledge base) | Tickets + Docs | Médio — redução de retrabalho | ✅ "Criar artigo na Wiki" em tickets resolvidos |
| Automações simples (quando/então) | Cross-module | Alto — escalabilidade | ⏳ Parcial: auto-posts, escalation, notificações proativas |
| Dependências entre tarefas | Sunday | Alto — gestão de projeto real | ✅ task_dependencies + aba Dependências no SidePanel |
| Timeline unificada | Cross-module | Alto — visão estratégica | ✅ /timeline com grid mensal (eventos + lançamentos + tarefas) |
| Anexos por etapa de lançamento | Produção | Alto — evidência de produção | ✅ launch_stage_attachments + upload na Sheet de etapa |
| TeamPage em 2 abas | Equipe | Médio — organização | ✅ Aba Organograma + aba Carga de Trabalho |

### Horizonte 4: Escala (2-4 meses)
> Preparar para crescimento e operação internacional.

| Item | Módulo | Impacto | Status |
|------|--------|---------|--------|
| Integração Shopify (pedidos automáticos) | Pedidos | Alto — elimina digitação manual | 🔜 Pendente |
| ✅ Editor rico no Papelinho (TipTap) | Docs | Alto — documentação profissional | `RichTextEditor.tsx` com toolbar completa, upload de imagens, tabelas, checklists |
| ✅ Mobile-first views | Produção, Salas, Calendário | Alto — acessibilidade | CalendarPage scroll sync, RoomsPage/BookingDialog responsivos |
| ✅ Notificações push/desktop | Speaks + Notificações | Médio — responsividade | `useDesktopNotifications` + Realtime listener + banner de permissão |
| ✅ i18n (Português + Espanhol) | Global | Médio — Barcelona | I18nProvider, traduções PT-BR/ES, toggle no sidebar |
| Integração Google Calendar | Salas | Médio — elimina sistema paralelo | 🔜 Pendente |
| ✅ Dashboard executivo para diretoria | Dashboard | Alto — visão C-level | `ExecutivePanel` com KPIs, gráfico semanal, saúde dos módulos |
| ✅ Onboarding guiado | Global | Médio — reduz curva de aprendizado | `OnboardingTour` com 6 passos, persistência em localStorage |

---

## Visão de Futuro: O Sistema Nervoso da MOOUI

O Collab Hub não é um software de gestão genérico. É a **plataforma operacional** de uma empresa que desenha, produz, vende e entrega moda própria em dois continentes.

Cada módulo é uma engrenagem:

```
         ┌─────────────────────────────────────────────────────────┐
         │                    DASHBOARD                            │
         │         (Visão pessoal + Gestão + KPIs)                 │
         └──────────────┬──────────────────┬───────────────────────┘
                        │                  │
         ┌──────────────▼──────┐ ┌─────────▼──────────────┐
         │      SPEAKS         │ │    COMMAND PALETTE      │
         │  (Comunicação)      │ │   (Busca + Ações)       │
         └─────┬───────────────┘ └─────────────────────────┘
               │ posts automáticos
    ┌──────────▼───────────────────────────────────────────┐
    │               MÓDULOS OPERACIONAIS                   │
    │                                                      │
    │  ┌─────────┐    ┌──────────┐    ┌──────────────┐     │
    │  │ SUNDAY  │───→│CALENDÁRIO│←───│  PRODUÇÃO    │     │
    │  │(Tarefas)│    │(Mkt Plan)│    │(Lançamentos) │     │
    │  └─────────┘    └──────────┘    └──────┬───────┘     │
    │                                        │             │
    │                                  ┌─────▼─────┐       │
    │                                  │   CHECK   │       │
    │                                  │(Checklist)│       │
    │                                  └───────────┘       │
    │                                                      │
    │  ┌─────────┐    ┌──────────┐    ┌──────────────┐     │
    │  │ PEDIDOS │    │ TICKETS  │    │  PAPELINHO   │     │
    │  │(SAC/Exp)│    │  (TI)    │───→│   (Wiki)     │     │
    │  └─────────┘    └──────────┘    └──────────────┘     │
    │                                                      │
    │  ┌─────────┐    ┌──────────┐                         │
    │  │  SALAS  │    │  EQUIPE  │                         │
    │  │(Reunião)│    │(Diretório)│                        │
    │  └─────────┘    └──────────┘                         │
    └──────────────────────────────────────────────────────┘
                        │
         ┌──────────────▼──────────────────┐
         │        CONFIGURAÇÕES            │
         │  (Usuários, Setores, Permissões)│
         └─────────────────────────────────┘
```

O objetivo final: **quando alguém na MOOUI precisa de informação, ela está no Collab Hub. Quando algo acontece, o sistema reage. Quando alguém precisa agir, o sistema mostra o quê, quando e por quê.**

---

## Princípios de Evolução

1. **Cada clique conta.** Equipe enxuta = tempo escasso. Se uma ação leva 5 cliques e poderia levar 1, isso é um bug de UX.

2. **Dados geram decisão.** Sem métricas, a gestão é por instinto. Com métricas, a gestão é por evidência.

3. **Automação liberta.** Tudo que é mecânico e repetitivo deveria ser automático. Pessoas devem focar no criativo, no estratégico, no que só humanos fazem.

4. **Conexão é valor.** Um módulo isolado é uma planilha. Módulos conectados são um sistema. O valor emerge das conexões.

5. **Mobile não é opcional.** A MOOUI tem gente na produção, na expedição, no estúdio, em Barcelona. Nem todos estão sentados num desktop.

---

*Documento gerado em 29/05/2026 com base em análise completa do codebase do MOOUI Collab Hub.*
*Atualizado em 30/05/2026 — Horizontes 1, 2 e 3 concluídos.*
