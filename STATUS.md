# MOOUI Collab Hub — Status do Projeto

Atualizado em: 2026-07-01

---

## Arquitetura

- **Frontend:** React 18 + TypeScript + Vite + TanStack React Query
- **Backend:** Supabase (Auth, PostgreSQL + RLS, Storage, Realtime)
- **UI:** shadcn/ui (Radix) + Tailwind CSS
- **Deploy/Hosting:** Lovable
- **Multi-tenant:** Organizacoes com hierarquia de 5 niveis (admin, director, manager, operator, member)
- **i18n:** PT-BR + ES (Barcelona)

### Publicacao

- **Lovable:** publica o frontend/app React.
- **Supabase SQL Editor:** aplica migrations/RPC/tabelas/policies quando o CLI nao tem permissao.
- **Supabase Edge Functions:** precisam de deploy separado no Supabase; nao sobem automaticamente pelo Lovable.

---

## Modulos (17 total)

### Core

| # | Modulo | Rota | Status |
|---|--------|------|--------|
| 1 | Dashboard | `/` | OK — KPIs (6 modulos), agenda pessoal (todos modulos), quick actions, painel executivo (saude 6 modulos) |
| 2 | Sunday (Projetos) | `/projetos`, `/tabela` | OK — kanban, tabela, subtarefas, templates, dependencias |
| 3 | Speaks (Mensagens) | `/mensagens` | OK — canais, DMs, threads, @mencoes, busca, auto-posts |
| 4 | Papelinho (Docs) | `/docs` | OK — wiki com editor TipTap, pastas, busca full-text |
| 5 | Salas (Reservas) | `/salas` | OK — grade horaria, reservas |
| 6 | Equipe | `/equipe` | OK — diretorio, organograma, carga de trabalho |
| 7 | Command Palette | `Ctrl+K` | OK — busca global (todos modulos), acoes rapidas, navegacao completa |
| 8 | Configuracoes | `/configuracoes` | OK — usuarios, setores, permissoes, logo |

### Operacionais

| # | Modulo | Rota | Status |
|---|--------|------|--------|
| 9 | Calendario de Acoes Mensais | `/calendario` | OK — anual, categorias, etapas por evento, timeline |
| 10 | Producao (Lancamentos) | `/lancamentos` | OK — pipeline com Gantt, etapas, anexos, activity |
| 11 | Check Lancamentos | `/checagens` | OK — checklists com evidencia, templates |
| 12 | Pedidos (SAC/Exp) | `/pedidos` | OK — workflow, SLA, anexos, escalation, relatorio |
| 13 | Tickets TI | `/tickets` | OK — chamados, SLA, relatorio, link wiki |

### Novos (migrados do Monday.com)

| # | Modulo | Rota | Status |
|---|--------|------|--------|
| 14 | Melhorias | `/melhorias` | OK — SectorBoardsPage com 4 boards Sunday (Site, Shopify, SEO On-Page, SEO Tecnico) |
| 15 | Marketing | `/conteudo`, `/programacao`, `/newsletters`, `/demandas-marketing` | OK — SectorBoardsPage; `/conteudo` agrega 9 boards; rotas standalone por sub-modulo |
| 16 | Calendario de Fotos e Videos | `/sessoes` | OK — SectorBoardsPage com 1 board Sunday |
| 17 | Produto | `/produtos` | OK — SectorBoardsPage com 1 board Sunday |

---

## Dados Importados (Monday.com → Supabase)

Data: 2026-06-03 | Org: MOOUI Brasil

| Tabela | Registros | Fonte |
|--------|-----------|-------|
| produtos | 125 | 4_Novos_Produtos, 2_Design |
| produto_stages | 1.000 | Auto-seed (15 etapas/produto) |
| produto_design_items | 450 | 2_Design (variacoes) |
| annual_events | 45 | 0_Acoes_Mensais via Sunday; 15 itens sem data foram mantidos fora do calendario |
| annual_event_etapas | 225 | Etapas por evento |
| conteudo_items | 178 | Programacao redes sociais, 2026+ |
| conteudo_checklist_items | 26 | Subelementos/checklist de Programacao |
| newsletters | 101 | Newsletter Brasil + Barcelona, 2026+ |
| pautas | 42 | Demandas Marketing, 2026+ |
| pauta_items | 33 | Subelementos de Demandas Marketing |
| sessoes | 95 | Calendario de Fotos e Videos, 2026+ |
| sessao_shots | 171 | Shots/subelementos de Fotos e Videos |
| melhorias | 302 | Site/Shopify/SEO importado |
| melhoria_subitems | 227 | Subelementos de Melhorias |

### Carga Sunday via Excel

Data: 2026-06-04 | Origem: todas as planilhas `.xlsx` da raiz | Script: `scripts/import-excels-to-sunday.mjs`

| Area Sunday | Registros | Observacao |
|-------------|-----------|------------|
| Projetos importados | 23 | Um projeto por planilha Excel |
| Tarefas principais | 3.976 | Linhas principais das planilhas |
| Subelementos | 1.425 | Subitems/Subelementos preservados como subtarefas |
| Total em tasks | 5.401 | Tarefas principais + subelementos |
| Colunas customizadas | 361 | Colunas dinamicas por projeto |
| Valores customizados | 24.458 | Valores das colunas do Excel |
| Responsaveis atribuidos | 667 | Gravados em `task_assignees` |

Pessoas casadas na carga: Fabiano Omura, Bheatriz Graciano, Mariana Bergamasco, Maria Rosa, Clara Koga, Wagner Lima, Thais Master, Adria Baratelli e Luana Kihara.

Entradas antigas/removidas mantidas apenas como texto nas colunas importadas: `Membro excluido`, `Deleted member`, `Deleted outdated pending user`.

---

## Integracao Cross-Module

```
Sunday ──→ Calendario (module_links)
Producao ──→ Calendario (module_links)
Producao ──→ Check Lancamentos (launch_id FK)
Tickets ──→ Papelinho (criar artigo wiki)
Producao ──→ Papelinho (briefings vinculados)
Speaks ←── Pedidos, Tickets, Melhorias, Conteudo, Sessoes, Produtos (auto-posts)
Dashboard ←── Todos os modulos (KPIs, agenda, contadores)
Timeline ←── Calendario + Lancamentos + Tarefas + Melhorias + Conteudo + Sessoes + Produtos
LinkedItems ←── Todos os modulos operacionais (cross-links)
```

---

## Funcionalidades Transversais

- **Notificacoes:** atribuicao, status change, comentarios, escalation (notify_user RPC)
- **Activity Log:** triggers automaticos em todos os modulos operacionais
- **Auto-code:** ML-xxx, CT-xxx, SS-xxx, PR-xxx (sequences por org)
- **SLA:** Pedidos (24/48h) e Tickets (configuravel) com badges visuais
- **Anexos/Storage:** Melhorias, Conteudo, Pedidos, Tickets, Producao (signed URLs)
- **Templates:** Sunday (projetos), Check (checklists)
- **i18n:** PT-BR + ES toggle no sidebar
- **Desktop Notifications:** push com Realtime listener
- **Onboarding Tour:** 6 passos para novos usuarios

---

## Scripts Utilitarios

| Script | Uso |
|--------|-----|
| `scripts/run-import.mjs` | Importa dados gerais do Monday.com via REST API |
| `scripts/reimport-melhorias-conteudo.mjs` | Re-importa melhorias + conteudo com subitems |
| `scripts/reimport-operational-excel.mjs` | Limpa e recarrega Melhorias, Conteudo e Sessoes a partir dos Excel |
| `scripts/import-excels-to-sunday.mjs` | Popula Sunday com todas as planilhas Excel, subelementos e responsaveis |
| `scripts/internalize-sunday-module-boards.mjs` | Clona boards Excel para `Modulo \| ...`; `--force --yes` para deletar e reclonar todos |
| `scripts/cleanup-old-data.mjs` | Remove dados anteriores a 2026 |
| `scripts/generate-monday-import-sql.mjs` | Gera SQL a partir dos Excel |
| `scripts/ensure-test-fixtures.mjs` | Garante profiles/memberships dos usuarios de teste para suites remotas |

---

## Pendencias Conhecidas

| Item | Modulo | Prioridade |
|------|--------|-----------|
| Integracao Shopify (pedidos automaticos) | Pedidos | Alta |
| Integracao Google Calendar | Salas | Media |
| Engine de automacoes customizaveis ("quando X, faca Y") | Cross-module | Media |

---

## Checklist Publicacao Supabase 2026-07-01

- Rodar preflight local: `npm run check:governance-release` ou `npm.cmd run check:governance-release` no PowerShell com execution policy restritiva.
- Para aplicar pelo SQL Editor: rodar `npm.cmd run sql:governance-release:file` e colar o conteudo de `generated/governance-release.sql` no Supabase SQL Editor. O comando `sql:governance-release` imprime no terminal, mas nao copie as linhas do npm nem o prompt do PowerShell.
- Aplicar migrations novas de governanca: `20260630_*`, `20260701_member_status_governance.sql`, `20260701_invites_access_expiration.sql`, `20260701_member_access_telemetry.sql`, `20260701_process_access_governance_alerts.sql`.
- Status em 2026-07-01: preflight local e build passaram; SQL de `generated/governance-release.sql` foi executado no Supabase SQL Editor pelo usuario; Lovable iniciou publicacao em `https://mooui-collab-hub.lovable.app`.
- Observacao de publicacao em 2026-07-01: o Lovable publica a branch Git, nao o workspace local. As melhorias de frontend/boards so aparecem no app publicado depois de commit + push das alteracoes locais.
- Edge Functions publicadas pelo Lovable/Supabase: `admin-set-member-status`, `admin-resend-invite`, `admin-renew-member-access`, `record-member-access`, `process-board-reminders`, `process-access-governance-alerts`.
- Crons ativos: `process-board-reminders` a cada 15 min; `process-access-governance-alerts` diariamente 08:00 UTC.
- Secrets configurados nesta rodada: `BOARD_REMINDERS_CRON_SECRET`, `ACCESS_GOVERNANCE_CRON_SECRET`.
- Secrets ignorados/controlados nesta rodada: `RESEND_API_KEY`, `EMAIL_FROM`, `ALLOWED_ORIGIN`. Sem Resend, reenvio por e-mail externo fica pendente; `ALLOWED_ORIGIN` aberto via fallback `*`, restringir depois para `https://mooui-collab-hub.lovable.app`.
- Smoke pos-publicacao pendente: entrar no app publicado, suspender/reativar usuario, renovar validade de acesso, validar filtros de Usuarios, aplicar preset de liberacao e validar simulador de acesso.
- Impacto das pendencias: smoke manual nao bloqueia o uso, mas deve ser feito antes de liberar para toda a equipe; `ALLOWED_ORIGIN` aberto nao quebra funcionamento, mas deve ser restringido em rodada curta de hardening.
- Historico local antes do deploy via Lovable: `supabase functions list` retornou `Cannot find project ref`; tentativa de `supabase link --project-ref rckglywohrywurknephc` em 2026-07-01 chegou ao Supabase, mas foi barrada por permissao da conta (`Your account does not have the necessary privileges`).
- Tentativa local pos-SQL em 2026-07-01: `supabase functions deploy admin-set-member-status` falhou por projeto nao linkado; novo `supabase link --project-ref rckglywohrywurknephc` falhou por falta de privilegio da conta. Deploy remoto foi concluido depois pelo Lovable.

---

## Historico de Evolucao

| Data | Marco |
|------|-------|
| 2026-05-28 | Fundacao: subtarefas, carga equipe, dashboard dinamico |
| 2026-05-29 | Horizonte 1: quick actions, SLA, filtros, anexos pedidos |
| 2026-05-29 | Horizonte 2: KPIs, auto-posts, @mencoes, templates, relatorios |
| 2026-05-30 | Horizonte 3: timeline, dependencias, sync producao-calendario |
| 2026-05-31 | Horizonte 4: TipTap, mobile, push notifications, i18n, onboarding |
| 2026-06-02 | 4 novos modulos: Melhorias, Conteudo, Sessoes, Produto |
| 2026-06-03 | Subelementos completos, reimportacao com subitems, fix LinkedItems |
| 2026-06-03 | Comentarios + Anexos + Atividade em tabs para Sessoes e Produto |
| 2026-06-04 | Comentarios + Atividade em Newsletters e Pautas, validacao upload 50MB |
| 2026-06-04 | Kanban DnD em todos os modulos (Conteudo, Melhorias, Sessoes, Produto) |
| 2026-06-04 | Comentarios em Conteudo, fix HTML entities, paridade completa entre modulos |
| 2026-06-04 | Comentarios + Atividade em tabs para Newsletters e Pautas, cleanup scripts temp |
| 2026-06-04 | Integracao Dashboard (KPI+Executive+Personal) com 4 novos modulos, Command Palette expandido |
| 2026-06-04 | Auto-posts em Speaks para Conteudo (#social), Sessoes (#producao), Produtos (#produtos) |
| 2026-06-04 | Sunday populado com 23 planilhas Excel: 5.401 tarefas, 1.425 subelementos e 667 atribuicoes |
| 2026-06-04 | Sunday recebeu abas Tabela/Kanban/Timeline/Calendario, filtros integrados e exclusao de elementos |
| 2026-06-04 | Sunday ganhou edicao de responsaveis diretamente nos cards de Kanban/Timeline |
| 2026-06-04 | Configuracoes passou a permitir editar o nome dos usuarios pela aba Usuarios |
| 2026-06-05 | Calendario de Acoes Mensais recarregado a partir do Sunday 0_Acoes_Mensais |
| 2026-06-05 | Calendario de Acoes Mensais passou a exibir somente eventos do proprio modulo, sem fontes Conteudo/Sessoes |
| 2026-06-05 | Configuracoes validada para edicao de nome de membros apos policy admin_update_member_profiles |
| 2026-06-05 | Marketing reorganizado em Programacao, Newsletters e Demandas Marketing; Fotos/Videos separado em modulo proprio |
| 2026-06-05 | Tabelas proprias de Marketing, Fotos/Videos e Melhorias recarregadas dos Excel/Sunday com corte 2026+ |
| 2026-06-05 | RPC notify_user normalizada e suites de testes ajustadas ao schema atual |
| 2026-06-05 | Elementos e subelementos de Marketing, Fotos/Videos e Melhorias passaram a preservar campos originais das planilhas em `custom_fields` |
| 2026-06-05 | Marketing ganhou cards/filtros por grupos do Monday em Programacao, Newsletters e Demandas Marketing |
| 2026-06-05 | Marketing foi dividido em rotas proprias: `/programacao`, `/newsletters` e `/demandas-marketing`; `/conteudo` ficou como visao agregadora legada |
| 2026-06-05 | Programacao, Newsletters e Demandas Marketing passaram a exibir elementos em tabela estilo Excel/Monday com colunas dinamicas das planilhas |
| 2026-06-05 | Configuracoes ganhou opcao de excluir usuario, com limpeza de vinculos e Edge Function `admin-delete-user` para remover Auth quando publicada |
| 2026-06-05 | Programacao foi reestruturada por workspaces: planilhas viram workspaces automaticos e novos workspaces podem ser criados pela tela |
| 2026-06-05 | Melhorias passou a exibir elementos em tabela estilo Sunday/Excel com grupos e colunas dinamicas das planilhas |
| 2026-06-05 | Programacao ajustada para seguir a ordem do Excel/Sunday: Name, Subelementos, Pessoas, Data, Status, Horario, Foto/Video e Novo/Repost |
| 2026-06-05 | Demandas Marketing e Sessoes passaram para visualizacao Sunday pura com grupos e colunas da planilha |
| 2026-06-05 | Melhorias passou para visualizacao Sunday pura com grupos, subelementos e colunas da planilha |
| 2026-06-05 | Newsletters passaram para visualizacao Sunday pura dentro dos workspaces Brasil/Barcelona |
| 2026-06-05 | Produtos passou para visualizacao Sunday pura por grupo com linha expansivel e pipeline preservado |
| 2026-06-05 | Visual Sunday reforcado em Marketing, Melhorias, Sessoes e Produtos com toolbar de board, grupos destacados e linhas densas |
| 2026-06-07 | Programacao comparada com os Excel do Sunday; tela passou a separar `Name` de `Subelementos/Subitems` quando o export vem como `Name | Conteudo`, e a grade principal carrega subelementos reais de `conteudo_checklist_items` |
| 2026-06-07 | Programacao passou a abrir por cards de redes; Newsletters passaram a abrir por cards Brasil/Barcelona e novos workspaces, cada card exibindo sua tabela Sunday isolada |
| 2026-06-07 | Programacao ajustada para paridade visual com a tela Sunday `/tabela`: grupos por mes, coluna unica `Elemento` com `Categoria | Conteudo`, Data Acao, Prioridade, Status, Responsavel e Abertura |
| 2026-06-08 | Programacao e Newsletters deixaram de renderizar tabela customizada: os cards de rede/workspace agora abrem diretamente o board Sunday real em `/tabela?projeto=...`; Demandas Marketing, Sessoes e Melhorias tambem passam a usar os projetos Sunday importados |
| 2026-06-08 | Programacao, Newsletters, Demandas Marketing, Sessoes e Melhorias foram corrigidos para manter header/cards do modulo e renderizar o board Sunday embutido abaixo, sem redirecionar para `/tabela` |
| 2026-06-08 | Boards Sunday/Excel foram clonados para boards internos `Modulo | ...`; Programacao, Newsletters, Demandas Marketing, Sessoes e Melhorias agora priorizam esses clones, deixando os imports antigos apenas como fallback |
| 2026-06-08 | Sunday e boards embutidos ganharam renomeacao de board/projeto; grupos da tabela ganharam acao de exclusao em massa para apagar meses/grupos inteiros com confirmacao |
| 2026-06-08 | Validacao: npm run build OK; npm run test -- src/test/edits.test.ts src/test/consolidated.test.ts OK (29 testes) |
| 2026-06-08 | Sunday e boards embutidos ganharam arquivamento de elementos e grupos inteiros via `tasks.archived_at`; arquivados saem das visualizacoes ativas sem apagar dados |
| 2026-06-08 | Validacao arquivamento: npm run build OK; npm run test -- src/test/edits.test.ts src/test/consolidated.test.ts OK (29 testes) |
| 2026-06-08 | Tabelas Sunday ganharam scroll horizontal mais visivel para boards com muitas colunas/campos extensos; validado com build e edits.test |
| 2026-06-11 | Fase 0 da reestruturacao: funcao SQL `has_min_role` (hierarquia 5 niveis), policy DELETE de tasks restrita a manager+, storage DELETE de melhoria-attachments restrito ao dono, todas as policies de storage DELETE atualizadas para dono OU manager+, usePermissions com default deny para acoes destrutivas |
| 2026-06-11 | Fase 1 da reestruturacao: Sunday como fonte unica — hook `useSundayModuleProjects`, Dashboard/KPIPanel/ExecutivePanel/PersonalPanel/CommandPalette/TimelinePage migrados para contar tasks em projetos `Modulo | ...`, realtime de tabelas dedicadas removido do Dashboard, ProdutoPage internalizado com Sunday board embutido, todas as paginas de modulo exibem Sunday como primario |
| 2026-06-11 | Fase 1 itens 1.4+1.6: script `migrate-dedicated-to-sunday.mjs` criado para migrar comments/attachments e remapear module_links; dry-run confirmou zero dados nas tabelas dedicadas (nenhum usuario criou comentarios/anexos/links via UI legada); board `Modulo | Produtos` clonado com 367 tasks via internalize-sunday-module-boards |
| 2026-06-11 | Fase 2.5: DELETE policies restritas a manager+ em 20+ tabelas (melhorias, conteudo, newsletters, pautas, sessoes, produtos, launches, events, docs, orders, tickets, channels + sub-items); tabela `module_access` criada para controle de visibilidade por modulo; aba Liberacoes em Configuracoes; `useModuleAccess` hook; `usePermissions` expandido com delete_order/ticket/channel/launch/event/doc/link/label; 4 testes role-based DELETE em security.test.ts (3 passam agora, 1 aguarda migration push) |
| 2026-06-11 | Fase 2A: tabelas polimorficas `comments`, `attachments`, `activity_log`, `entity_code_seq` criadas com RLS; hooks genericos `useComments`, `useAttachments`, `useActivityLog`; componentes genericos `CommentsTab`, `AttachmentsTab`, `ActivityTab` extraidos do padrao ProdutoPage |
| 2026-06-11 | Fase 2B: migracao SQL de 21 tabelas dedicadas de comments/attachments/activity para polimorficas (idempotente, ON CONFLICT DO NOTHING); hooks `useTaskComments`, `useTaskActivity`, `useTaskAttachments` reescritos para ler das tabelas polimorficas; tabelas antigas marcadas DEPRECATED |
| 2026-06-11 | Fase 2C: migracao SQL de orders/tickets comments/activity/attachments para polimorficas; hooks `useOrderComments`, `useOrderActivity`, `useOrderAttachments`, `useTicketComments`, `useTicketActivity`, `useTicketAttachments`, `useAddOrderComment`, `useAddTicketComment` reescritos; notificacoes preservadas; TicketsPage upload direto atualizado; message_attachments mantido como esta (dominio proprio) |
| 2026-06-11 | Fase 3 (3.1-3.6): SundayBoard extraido para `src/features/boards/`; SectorBoardsPage generica com fuzzy matching por aliases; 7 paginas migradas — MelhoriasPage (1194→17), SessoesPage (1399→22), ProdutoPage (1016→22), ConteudoPage (2908→25), ProgramacaoPage (nova, 6 boards), NewslettersPage (nova, 2 boards), DemandasMarketingPage (nova, 1 board); 9 arquivos mortos deletados (useConteudo, useNewsletters, usePautas, useMelhorias, useSessoes, useProdutos, ContentCalendar, PipelineTracker, SpreadsheetFields) |
| 2026-06-12 | Fase 3 (3.4e-3.5): LinkedItems adicionado a Pedidos e Tickets; ExecutivePanel reorganizado por setor com 6 setores; KPIPanel expandido para 9 metricas; 10 feature folders criados (orders, tickets, messages, docs, production, calendar, rooms, team, settings, boards) com barrel exports; 14 arquivos mortos removidos incluindo 5 hooks legados de attachments/contracts/ideas |
| 2026-06-12 | Fase 3 (3.10): UX mobile em Pedidos, Tickets e Speaks — filtros em grid 2-col no mobile, touch targets 40px+, dialogs com max-h-[90dvh] e scroll interno, botoes header icon-only no mobile |
| 2026-06-12 | Fase 3 (3.7): UX Kit em `src/shared/components/` — PageHeader, FilterBar (colapsa em Sheet mobile), EmptyState, LoadingSkeleton (list/cards/table), ResponsiveDialog (Dialog desktop + Sheet mobile), MobileListCard; `useMediaQuery` em `src/shared/hooks/` |
| 2026-06-12 | Fase 3 (3.8): SundayBoard responsivo — SundayMobileList renderiza cards agrupados no mobile (<640px) em vez da tabela; accordion por grupo, card com titulo/status/prioridade/data/avatares, quick-add, touch targets 44px |
| 2026-06-12 | Fase 3 (3.9): Kanban mobile com snap scroll (85vw colunas); Timeline com layout compacto e assignee picker hidden no mobile |
| 2026-06-12 | Fase 3 (3.11): Varredura final — dialogs max-h-[90dvh] em ChecklistPage e LaunchesPage; selects responsive em KanbanPage e SprintsPage; flex-wrap em SprintsPage header |
| 2026-06-12 | Fase 4 (4.1): Migration `20260612_phase4_calendar_events.sql` — tabela `calendar_events` com scope/category/sector, backfill de annual_events, launches e bookings |
| 2026-06-12 | Fase 4 (4.2): Sync hooks — annual_events, launches e bookings agora fazem upsert/delete em calendar_events no onSuccess das mutacoes |
| 2026-06-12 | Fase 4 (4.3+4.4): CalendarPage refatorada — display unificado via `useCalendarEvents`, filtros por categoria+setor+escopo, pin-to-master toggle para manager+; CRUD de eventos anuais preservado |
| 2026-06-12 | Fase 4 (4.5): Confirmado que posts/newsletters nao sincronizam com calendar_events — by design |
| 2026-06-12 | Fase 4 (4.6): Auditoria CRM — zero referencias a `crm_*` em src/; tabelas sao candidatas a drop na 4.7 |
| 2026-06-12 | Fase 5 (5.1): ColumnType expandido para 11 tipos (+ checkbox, link, rating, select); ColumnCell em `features/boards/columns/` com renderers tipados (checkbox, stars, link com external, select dropdown, tags multi-select, date formatada) |
| 2026-06-12 | Fase 5 (5.2): Card layout config via `config.show_on_card` em project_columns; colunas marcadas aparecem nos cards do Kanban com ColumnCell inline |
| 2026-06-12 | Fase 5 (5.3): Board management — reordenacao de colunas (mover esquerda/direita), editor de opcoes para select/status/tags (prompt multiline), PromptDialog ganhou modo multiline |
| 2026-06-12 | Fase 4 (4.8): Cleanup — `useSundayModuleProjects.ts` removido (morto); auditoria confirmou zero codigo morto restante |
| 2026-06-12 | Fase 3 (3.4c parcial): 5 novas paginas de setor — DesignPage, ComercialPage, FinanceiroPage, InternacionalPage, ProducaoBoardsPage — com SectorBoardsPage e aliases prontos para boards `Modulo \| ...` |
| 2026-06-12 | Sidebar reorganizada por setores (Geral, Marketing, Estudio, Design, Produto, Producao, Site & TI, Comercial, SAC & Expedicao, Financeiro, Internacional, Ferramentas); CommandPalette atualizado com novos setores |
| 2026-06-12 | Sidebar com grupos colapsaveis — cada setor abre/fecha com chevron, grupo ativo auto-expande por rota, estado persiste em localStorage |
| 2026-06-12 | Script `setup-sector-boards.mjs` criado — 3.4b (merge Site+Shopify Novo), 3.4d (criar Demandas Design), seed de boards para setores novos (Atacado, Financeiro, Internacional, Producao) |
| 2026-06-12 | Auditoria RLS (0.3): 97/98 testes passam; falha em member-delete-task aguarda aplicacao da migration no Supabase remoto |
| 2026-06-12 | Migrations aplicadas no Supabase remoto: 6 schema migrations (has_min_role, DELETE policies, module_access, polymorphic tables, calendar_events) com guards IF EXISTS + EXCEPTION WHEN para compatibilidade com schema Lovable |
| 2026-06-12 | Hotfix has_min_role: LEFT JOIN user_roles com COALESCE para organization_members.role como fallback, corrigindo usuarios sem entry em user_roles |
| 2026-06-12 | Script `seed-board-guide-doc.mjs` criado (5.4) — guia "Como criar um board no Sunday" para o Papelinho com 11 tipos de coluna, visualizacoes, filtros e dicas |
| 2026-06-12 | Code-splitting: React.lazy para 27 paginas + manualChunks para vendor (react, query, ui, supabase, editor, charts). Chunk inicial de 2.324KB caiu para 269KB (88% reducao); editor e charts carregam sob demanda |
| 2026-06-12 | Scripts executados: setup-sector-boards (merge Site Unificado 333 tasks, Demandas Design, Atacado, Financeiro, Internacional, Producao) e seed-board-guide-doc (guia Papelinho criado) |
| 2026-06-12 | TableViewPage refatorada de 1.869 para ~500 linhas: constants.ts (labels/utils), TableCells.tsx (StatusCell/PriorityCell/AssigneeAvatars/AssigneePickerCell), TableToolbar.tsx (7 componentes de toolbar), SundayViews.tsx (MiniCard/Kanban/Timeline/Calendar), TaskRow.tsx (linha recursiva com drag-and-drop) extraidos para `features/boards/components/` |
| 2026-06-30 | Botao Outdent para promover subelementos a elemento principal; area expandida esconde automaticamente quando ultimo subelemento eh promovido |
| 2026-06-30 | Sidebar: icones nos grupos com desdobramento (Home, Target, Megaphone, Factory, Monitor); seta de expansao movida para a direita |
| 2026-06-30 | Reordenacao de colunas fixas por drag-and-drop (ordem persiste em localStorage por projeto); MIME type dedicado evita conflito com drag de tarefas |
| 2026-06-30 | Indicador de comentarios estilo Monday (balao azul com contagem) nos elementos da tabela via `useTaskCommentCounts` |
| 2026-06-30 | Recarga completa dos 21 boards Modulo: script `internalize-sunday-module-boards.mjs` ganhou flag `--force` para deletar e reclonar todos os boards independente de quantidade de tasks |
| 2026-06-30 | Todos os 16 membros da organizacao adicionados como membros de todos os 25 boards Modulo (318 memberships criadas) |
| 2026-06-30 | SundayBoard: menu de grupo ganhou expandir/recolher este/todos os grupos, expandir/recolher subelementos deste/todos os grupos e resumo visual quando o grupo esta comprimido |
| 2026-06-30 | SundayBoard: subelementos ganharam checkbox inline; marcar/desmarcar atualiza o status entre `done` e `todo`, alimentando o progresso dos resumos |
| 2026-06-30 | SundayBoard: linha final de cada grupo passou a exibir agregacoes para colunas dinamicas de numeros, checkbox e rating |
| 2026-06-30 | SundayBoard: coluna Data Acao passou a renderizar barra de progresso real com tooltip de periodo, dias totais/restantes/atraso e percentual de subelementos concluidos |
| 2026-06-30 | SundayBoard: elementos ganharam acao de fixar/desafixar no menu da linha, com fixados ordenados no topo do grupo por projeto |
| 2026-06-30 | SundayBoard: linhas ganharam atalho inline e opcao de menu para adicionar subelemento com expansao automatica do elemento |
| 2026-06-30 | SundayBoard: celula de Data Acao sem data agora mostra "Definir datas" e abre o calendario no clique |
| 2026-06-30 | SundayBoard: cabecalhos de colunas fixas ganharam menu com ordenar, ocultar e configuracao inicial de lembretes para Data Acao |
| 2026-06-30 | SundayBoard: menu de grupo ganhou selecionar todos os elementos, duplicar grupo e exportar grupo em CSV compativel com Excel |
| 2026-06-30 | SundayBoard: colunas dinamicas agora podem ser ocultadas pelo menu da coluna e reexibidas pelo controle Ocultar da toolbar |
| 2026-06-30 | SundayBoard: menu de grupo ganhou adicionar grupo visual, mover grupo para cima/baixo, alterar cor do grupo e entrada Apps/automacoes |
| 2026-06-30 | SundayBoard: preferencias de board ganharam migration `board_preferences` e hook `useBoardPreferences`; fixados, colunas ocultas, grupos visuais, ordem de colunas e dias de lembrete sincronizam no Supabase com fallback local |
| 2026-06-30 | SundayBoard: menu de colunas dinamicas ganhou duplicar coluna com valores, alterar tipo, filtrar por valor, agrupar por coluna customizada e alternar automacao no config da coluna |
| 2026-06-30 | SundayBoard: Data Acao ganhou fila persistente de lembretes em `board_task_reminders`; configurar dias antes do prazo cria lembretes pendentes para tarefas com data |
| 2026-06-30 | SundayBoard: menu da linha ganhou acao "Adicionar atualizacao", abrindo o painel lateral do item para comentarios/arquivos/historico |
| 2026-06-30 | SundayBoard: lembretes de Data Acao ganharam RPC `process_board_task_reminders` e Edge Function `process-board-reminders` para gerar notificacoes via cron/scheduler |
| 2026-06-30 | Estrutura do app: sidebar passou a filtrar itens por `module_access` e rotas internas ganharam guard `ModuleRoute` para bloquear acesso direto a modulos ocultos |
| 2026-06-30 | SundayBoard: grupos customizados ganharam persistencia real com `tasks.group_key`; elementos podem ser criados dentro de grupos visuais e movidos entre grupos pelo menu da linha |
| 2026-06-30 | SundayBoard: colunas fixas ganharam renomeacao persistente por board, permitindo trocar "Status" para "Fotos/Acao" sem alterar schema |
| 2026-06-30 | Governanca: aba Liberacoes foi alinhada com todos os modulos vivos, Speaks padronizado em `speaks` nas rotas/sidebar/liberacoes e regras de acesso agora podem ser aplicadas a usuarios individuais |
| 2026-06-30 | Governanca: Command Palette passou a filtrar atalhos e queries por `module_access`, evitando expor modulos ocultos via busca global |
| 2026-06-30 | Governanca: auditoria de permissoes/liberacoes criada com `permission_audit_log`, historico recente na aba Liberacoes e logs para regras de modulo, usuarios, papeis, camadas de setor, Suporte TI, reset de senha e exclusao/remocao de usuario |
| 2026-06-30 | Governanca: ciclo de vida de usuarios ganhou `organization_members.status` (`active`, `invited`, `suspended`), RLS/funcoes consideram apenas membros ativos e Configuracoes permite suspender/reativar usuario com auditoria |
| 2026-06-30 | Governanca: painel de auditoria em Liberacoes ganhou busca, filtros por tipo/acao, exportacao CSV e matriz de acoes criticas por area com nivel esperado/protecao atual |
| 2026-07-01 | Governanca: usuarios ganharam convite real por e-mail, suspensao com motivo obrigatorio e opcao de bloqueio/desbloqueio global de login via `admin-set-member-status` |
| 2026-07-01 | Governanca: convites ganharam reenvio, rastreio de expiracao e acesso temporario com renovacao/limpeza pela UI; RLS considera `access_expires_at` nas funcoes de membro/admin |
| 2026-07-01 | Governanca: aceite de convite e primeiro acesso passaram a ser registrados por `record-member-access`; Usuarios ganhou ultimo acesso, reenvio em lote de convites e alertas de acessos vencendo |
| 2026-07-01 | Governanca: aba Liberacoes ganhou presets de permissao com auditoria e simulador de acesso efetivo por usuario, considerando regras de usuario, setor, papel e padrao |
| 2026-07-01 | Governanca: criada rotina `process-access-governance-alerts` para notificar admins sobre convites vencidos, acessos expirados e acessos proximos do vencimento |
| 2026-07-01 | Governanca: pacote de publicacao Supabase ganhou `npm run check:governance-release`; check local confirmou 10 migrations e 6 Edge Functions da rodada |
| 2026-07-01 | Governanca: SQL de `generated/governance-release.sql` executado no Supabase SQL Editor pelo usuario; proximo passo eh publicar Edge Functions, secrets/crons e smoke remoto |
| 2026-07-01 | Governanca: tentativa de deploy da primeira Edge Function pelo CLI confirmou bloqueio de permissao no Supabase; functions ainda precisam ser publicadas por conta com acesso ao projeto |
| 2026-07-01 | Publicacao: confirmado fluxo Lovable para frontend e Supabase separado para SQL/Edge Functions |
| 2026-07-01 | Governanca: aba Liberacoes ganhou export/import JSON de regras e diagnostico de riscos em regras, modulos sensiveis, editores operacionais, setores e usuarios sem camada |
| 2026-07-01 | Governanca: aba Usuarios ganhou checklist de riscos por pessoa com acoes rapidas para reenviar convite e ajustar validade de acesso |
| 2026-07-01 | Governanca: aba Usuarios ganhou busca, filtros por risco/status/papel/setor, ordenacao operacional e exibicao do papel de permissao na tabela |
| 2026-07-01 | Publicacao: criado `LOVABLE_GOVERNANCE_DEPLOY_PROMPT.md` com prompt pronto para Lovable publicar frontend e tentar Edge Functions sem rerodar SQL |
| 2026-07-01 | Publicacao: prompt do Lovable ganhou exemplos de formato para `RESEND_API_KEY`, `EMAIL_FROM` e `ALLOWED_ORIGIN` |
| 2026-07-01 | Publicacao: criado `LOVABLE_GOVERNANCE_DEPLOY_PROMPT_SEM_RESEND.md` para publicar frontend/functions sem configurar Resend nesta rodada |
| 2026-07-01 | Publicacao: Lovable iniciou publicacao em `https://mooui-collab-hub.lovable.app`, publicou 6 Edge Functions e ativou crons de lembretes/governanca; Resend e CORS restrito ficam para rodada posterior |
| 2026-07-01 | Segurança: Lovable reportou 4 vulnerabilidades criticas corrigidas na publicacao (user_roles, ticket_attachments INSERT e storage buckets privados); 8 warnings/info remanescentes nao bloqueiam publish |
| 2026-07-01 | Publicacao: confirmado que smoke manual e `ALLOWED_ORIGIN` restrito nao bloqueiam uso imediato; ficam como checklist antes da liberacao ampla/hardening |
| 2026-07-01 | Publicacao: diagnosticado que o app publicado nao refletia as melhorias de frontend porque a branch Git ainda nao recebeu commit/push das alteracoes locais |
| 2026-07-01 | SundayBoard: rolagem horizontal de grupos reforcada com barra sincronizada/fixa no rodape visivel do grupo enquanto ele cruza o viewport |

### Validacao 2026-07-01

- `npm.cmd run build`: OK apos filtros/ordenacao operacional da aba Usuarios. Avisos persistentes: Browserslist/caniuse-lite antigo e chunk de `TableViewPage.tsx` importado dinamica e estaticamente.
- `npm.cmd run build`: OK apos reforco da rolagem fixa/sincronizada por grupo no SundayBoard.
- Smoke remoto pendente no app publicado: `https://mooui-collab-hub.lovable.app`.

### Checklist Uso Inicial

- Pode usar o app publicado para validacao operacional.
- Para ver as melhorias de frontend/boards no Lovable, fazer commit + push da branch usada pelo Lovable e aguardar o novo build.
- Antes de liberar para toda a equipe, testar login, Configuracoes > Usuarios, suspender/reativar usuario, renovar validade de acesso, filtros de Usuarios, Liberacoes/presets/simulador e visualizacao dos boards principais.
- Hardening posterior recomendado: configurar `ALLOWED_ORIGIN=https://mooui-collab-hub.lovable.app`, configurar Resend/Email se quiser envio automatico e revisar os 8 warnings/info de seguranca restantes.

### Validacao 2026-06-05

- `npm run build`: OK apos refatoracao de TableViewPage em componentes focados.
- `npm run test`: OK apos refatoracao de TableViewPage, 9 arquivos e 98 testes (97 passam, 1 falha preexistente em security.test.ts aguarda migration).
- `npm run build`: OK apos custom fields operacionais.
- `npm run build`: OK apos rotas separadas de Marketing.
- `npm run build`: OK apos tabelas estilo Excel em Programacao, Newsletters e Demandas Marketing.
- `npm run build`: OK apos opcao de excluir usuario em Configuracoes.
- `npm run build`: OK apos Programacao por workspaces.
- `npm run build`: OK apos tabela estilo Sunday/Excel em Melhorias.
- `npm run build`: OK apos ajuste de colunas Excel/Sunday em Programacao.
- `npm run build`: OK apos Demandas Marketing e Sessoes em visualizacao Sunday pura.
- `npm run build`: OK apos Melhorias em visualizacao Sunday pura.
- `npm run build`: OK apos Newsletters em visualizacao Sunday pura.
- `npm run build`: OK apos Produtos em visualizacao Sunday pura.
- `npm run build`: OK apos reforco visual Sunday nos modulos operacionais.
- `npm run build`: OK apos ajuste real de Programacao contra planilhas Sunday/Excel.
- `npm run build`: OK apos cards de redes em Programacao e cards/workspaces em Newsletters.
- `npm run build`: OK apos paridade visual da Programacao com Sunday `/tabela`.
- `npm run build`: OK apos redirecionar Programacao, Newsletters, Demandas Marketing, Sessoes e Melhorias para os boards Sunday reais.
- `npm run build`: OK apos embutir os boards Sunday nos modulos, mantendo cards/workspaces no header.
- `node scripts/internalize-sunday-module-boards.mjs --yes`: OK; 13 boards internos criados/confirmados com 4.127 tarefas no total.
- `npm run build`: OK apos apontar os modulos para os clones internos `Modulo | ...`.
- `npm run test -- src/test/integration.test.ts`: OK, 8 testes passando; `npm run test` completo teve timeout flutuante em docs no Supabase, depois passou isolado.
- Smoke HTTP local `8082`: OK em `/conteudo`, `/sessoes`, `/melhorias` apos custom fields.
- Smoke HTTP local `8082`: OK em `/programacao`, `/newsletters`, `/demandas-marketing` e `/conteudo`.
- Smoke HTTP local `8082`: OK em `/programacao`, `/newsletters` e `/demandas-marketing` apos tabelas estilo Excel.
- Smoke HTTP local `8082`: OK em `/programacao` apos Programacao por workspaces.
- Smoke HTTP local `8082`: OK em `/`, `/conteudo`, `/sessoes`, `/melhorias`, `/configuracoes`.
- Smoke HTTP local `8082`: OK em `/melhorias` e `/configuracoes` apos tabela de Melhorias e exclusao de usuario.
- Smoke HTTP local `8082`: OK em `/programacao` apos ajuste de colunas Excel/Sunday.
- Smoke HTTP local `8082`: OK em `/demandas-marketing` e `/sessoes` apos visualizacao Sunday pura.
- Smoke HTTP local `8082`: OK em `/melhorias` apos visualizacao Sunday pura.
- Smoke HTTP local `8082`: OK em `/newsletters` apos visualizacao Sunday pura.
- Smoke HTTP local `8082`: OK em `/produtos` apos visualizacao Sunday pura.
- Smoke HTTP local `8082`: OK em `/programacao`, `/newsletters`, `/demandas-marketing`, `/melhorias`, `/sessoes` e `/produtos` apos reforco visual Sunday.
- `scripts/verify-admin-profile-update.mjs`: OK, update de nome de membro aceito pela policy.
- `npm run test`: OK, 9 arquivos e 94 testes passando.
- `npm run test`: OK apos rotas separadas de Marketing, 9 arquivos e 94 testes passando.
- `npm run test`: OK apos tabelas estilo Excel em Marketing, 9 arquivos e 94 testes passando.
- `npm run test`: OK apos ajuste real de Programacao contra planilhas Sunday/Excel, 9 arquivos e 94 testes passando.
- `npm run test`: OK apos cards de redes em Programacao e cards/workspaces em Newsletters, 9 arquivos e 94 testes passando.
- `npm run test`: OK apos paridade visual da Programacao com Sunday `/tabela`, 9 arquivos e 94 testes passando.
- `npm run test`: OK apos redirecionar Programacao, Newsletters, Demandas Marketing, Sessoes e Melhorias para os boards Sunday reais, 9 arquivos e 94 testes passando.
- `npm run test`: OK apos embutir os boards Sunday nos modulos, mantendo cards/workspaces no header, 9 arquivos e 94 testes passando.
- `npm run test`: OK apos opcao de excluir usuario em Configuracoes, 9 arquivos e 94 testes passando.
- `npm run test`: OK apos Programacao por workspaces, 9 arquivos e 94 testes passando.
- `npm run test`: OK apos tabela estilo Sunday/Excel em Melhorias, 9 arquivos e 94 testes passando.
- `npm run test`: OK apos ajuste de colunas Excel/Sunday em Programacao, 9 arquivos e 94 testes passando.
- `npm run test`: OK apos Demandas Marketing e Sessoes em visualizacao Sunday pura, 9 arquivos e 94 testes passando.
- `npm run test`: OK apos Melhorias em visualizacao Sunday pura, 9 arquivos e 94 testes passando.
- `npm run test`: OK apos Newsletters em visualizacao Sunday pura, 9 arquivos e 94 testes passando.
- `npm run test`: OK apos Produtos em visualizacao Sunday pura, 9 arquivos e 94 testes passando.
- `npm run test`: OK apos reforco visual Sunday nos modulos operacionais, 9 arquivos e 94 testes passando.
- `node --check scripts/reimport-operational-excel.mjs`: OK.
- `node scripts/reimport-operational-excel.mjs`: bloqueado localmente por ausencia de `generated/.auth2.json` ou `generated/.auth_response.json`; a carga real precisa desse auth e da migration `20260605113000_operational_custom_fields.sql` aplicada.
- Browser visual embutido indisponivel na sessao (`iab` nao disponivel); validacao visual substituida por build, testes e smoke HTTP.
- `deno`: indisponivel localmente; Edge Function `admin-delete-user` validada por revisao e build do app, pendente publicar no Supabase.
- `supabase functions deploy admin-delete-user`: bloqueado localmente por projeto Supabase nao linkado (`Cannot find project ref`).
- `npm run lint`: falha por divida preexistente ampla (`no-explicit-any`, fast refresh, etc.).
- Migration criada para remover a ambiguidade da RPC `notify_user`: `20260605103000_fix_notify_user_rpc_ambiguity.sql`.
- Migration criada para campos originais das planilhas em modulos operacionais: `20260605113000_operational_custom_fields.sql`.
- Migration criada para workspaces persistentes de Programacao: `20260605150000_programacao_workspaces.sql`.

### Auditoria Excel x Sistema 2026-06-05

- Sunday com todas as planilhas: OK via `scripts/import-excels-to-sunday.mjs --verify`; 23 projetos, 5.401 tarefas, 3.976 elementos, 1.425 subelementos, 361 colunas, 24.458 valores customizados e 667 atribuicoes.
- Calendario de Acoes Mensais: OK via `scripts/import-sunday-acoes-mensais-calendar.mjs --verify`; 45 eventos, 225 etapas e 0 eventos 2026+ de outras fontes.
- Marketing/Fotos/Melhorias: OK em contagem via `scripts/reimport-operational-excel.mjs`; Excel 2026+ bate com o sistema atual: 302 melhorias, 227 subitems, 178 conteudos, 26 subitems de conteudo, 101 newsletters, 42 pautas, 33 pauta items, 95 sessoes e 171 shots.
- Paridade visual completa dos campos extras: OK apos aplicar `20260605113000_operational_custom_fields.sql` e recarregar `scripts/reimport-operational-excel.mjs --yes`; `custom_fields` preenchido em elementos e subelementos operacionais.
- Produtos: sistema atual tem 120 produtos, 1.800 etapas e 396 itens de design. As 1.800 etapas fecham 15 etapas por produto. Ha divergencia contra o resumo antigo gerado localmente (`produtos: 125`, `produto_design_items: 400`), entao Produtos precisa de revisao/carga especifica antes de declarar paridade total.
- Pessoas: organizacao MOOUI Brasil possui 18 membros no sistema; Sunday importado possui 667 atribuicoes gravadas em `task_assignees`.
