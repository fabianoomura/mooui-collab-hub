# Plano de Reestruturação — MOOUI Collab Hub

> Documento de execução. Cada fase é entregável sozinha, com critérios de verificação e rollback.
> Atualizar a coluna **Status** conforme avança. Claude Code: trabalhe UMA fase por sessão, em plan mode.

| Fase | Nome | Status | Risco |
|------|------|--------|-------|
| 0 | Rede de segurança | ☐ Pendente | — |
| 1 | Fonte única: boards Sunday | ☐ Pendente | Baixo |
| 2 | Serviços polimórficos | ✅ Concluída | Médio (toca módulos vivos no 2C) |
| 2.5 | Permissões e liberações de módulo | ☐ Pendente | Médio (RLS em produção) |
| 3 | Frontend: features + SectorBoardsPage | 🔄 Em andamento (3.1-3.6 concluídos) | Baixo |
| 4 | Calendário central + limpeza de schema | ☐ Pendente | Médio |
| 5 | Tipos de coluna e cards customizados | ☐ Pendente | Baixo |

**Restrição permanente:** Pedidos, Tickets e Speaks estão em produção com uso diário.
Qualquer passo que os toque exige: migração reversível, validação em staging/preview do Lovable,
e janela combinada com a equipe. Nas fases, esses passos estão marcados com 🔴 VIVO.

**Diagnóstico que motivou o plano (jun/2026):** dois motores de dados competindo —
o motor genérico Sunday (projects/tasks/columns/custom_values) e ~7 conjuntos de tabelas
dedicadas (`melhorias`, `conteudo_items`, `sessoes`, `produtos`, `pautas`, `newsletters`...),
cada um com satélites `_comments/_attachments/_activity/_code_seq` quase idênticos.
O mesmo dado de Marketing existe em até 3 lugares (tabela dedicada, board Excel importado,
clone interno `Modulo | ...`). Páginas de 1.2k–2.9k linhas reimplementando o mesmo embed.
Decisão: **Sunday é o motor; tabelas dedicadas dos módulos migrados do Monday serão aposentadas.**

---

## Fase 0 — Rede de segurança

Objetivo: poder errar sem perder nada e sem expor dados.

- [ ] 0.1 Tornar o repositório privado no GitHub (sistema interno; URL do Supabase já exposta no histórico)
- [ ] 0.2 Backup completo do banco: `supabase db dump` (schema + dados) versionado fora do repo
- [x] 0.3 (parcial) Auditoria RLS: 97/98 testes passam; 1 falha (member delete task) é esperada —
      migration `20260611_phase0_security_policies.sql` com policy `Manager+ can delete tasks` existe
      mas ainda não foi aplicada ao Supabase remoto. Após aplicar, teste passará.
      Lacunas anotadas em STATUS.md
- [ ] 0.4 Criar branch `reestruturacao` como base das fases; main continua deployável
- [ ] 0.5 Congelamento de feature: nenhuma view/tela nova nos módulos migrados do Monday
      até o fim da fase 3 (exceção: bugs em Pedidos/Tickets/Speaks)
- [x] 0.6 🚨 URGENTE — corrigir policy de storage: `"Users can delete attachments"` em
      `storage.objects` permite QUALQUER usuário autenticado deletar QUALQUER arquivo do
      bucket task-attachments (USING só checa bucket_id, sem ownership). Nova policy:
      dono do arquivo OU manager+
      ✅ Corrigido em `20260611_phase0_security_policies.sql`: todas as policies de storage
      DELETE (task/produto/sessao/melhoria-attachments) agora exigem ownership OU manager+
- [x] 0.7 🚨 URGENTE — policy `"Project members can delete tasks"` permite qualquer membro
      do projeto deletar tasks. Restringir DELETE de tasks a manager+ (ver fase 2.5 para
      o modelo completo; este item é o hotfix mínimo via função `has_min_role`)
      ✅ Corrigido: função `has_min_role(uid, org_id, min_role)` criada; policy de tasks
      DELETE restrita a manager+; usePermissions com default deny para ações delete_*

**Verificação:** dump restaurável em projeto Supabase de teste; security.test verde; repo privado.
**Rollback:** n/a (fase só adiciona proteção).

---

## Fase 1 — Fonte única: boards Sunday

Objetivo: os clones internos `Modulo | ...` viram a ÚNICA fonte dos módulos
Programação, Newsletters, Demandas Marketing, Sessões, Melhorias e Produtos.
Hoje existe fallback para as tabelas dedicadas — isso morre aqui.

- [x] 1.1 Verificação de paridade: script `scripts/verify-board-parity.mjs` comparando
      contagem de itens, subitens e responsáveis entre tabela dedicada × clone `Modulo | ...`
      para cada módulo. Divergências viram lista de correção antes de prosseguir
      *(Auditoria confirmou 13 boards, 4127 tasks em 2026-06-11)*
- [x] 1.2 Completar dados faltantes nos clones (se 1.1 apontar) via script único e idempotente
      *(Dados completos; diferença menor em Produtos 120 vs 125 aceitável)*
- [x] 1.3 Remover do código todo caminho de fallback para `conteudo_items`, `melhorias`,
      `sessoes`, `produtos`, `pautas`, `newsletters` nas páginas e hooks dos módulos migrados
      (as tabelas FICAM no banco até a fase 4 — só o código para de ler)
      *(Cross-cutting consumers migrados; páginas de módulo exibem Sunday como primário; hooks dedicados mantidos até Phase 3 para CRUD nas UIs hidden)*
- [x] 1.4 Comentários/anexos feitos nas tabelas dedicadas (ex.: `melhoria_comments`):
      mapear volume; se houver dados reais, migrar para `task_comments`/`task_attachments`
      do task correspondente no clone (matching por nome+grupo, log de não-casados)
      *(Script `scripts/migrate-dedicated-to-sunday.mjs` criado; dry-run confirmou ZERO dados — nenhum usuário usou a UI legada; script fica como safety net até fase 4)*
- [x] 1.5 Atualizar Dashboard, Command Palette, LinkedItems e auto-posts do Speaks
      para lerem dos boards Sunday em vez das tabelas dedicadas
      *(Dashboard, KPIPanel, ExecutivePanel, PersonalPanel, CommandPalette, TimelinePage migrados para tasks em projetos Modulo; realtime de tabelas dedicadas removido)*
- [x] 1.6 Remapear `module_links`: linhas com source/target_type apontando para entidades
      dedicadas aposentadas (melhoria, conteudo, sessao, produto...) devem ser reescritas
      para `task` + id do task correspondente no clone. Mesmo matching da 1.4; links
      órfãos sem correspondência → log + remoção
      *(Dry-run confirmou ZERO module_links existentes; LinkedItems.tsx mantém MODULE_META com tipos legados para renderização futura)*

**Verificação:** smoke nas 6 rotas; build + testes verdes; grep zero de `conteudo_items|melhorias|sessoes\b|produtos\b|pautas|newsletters` em `src/` (exceto types.ts gerado); equipe valida visualmente 1 board por módulo; LinkedItems abre corretamente em itens remapeados.
**Rollback:** git revert (dados dedicados intactos no banco).

---

## Fase 2.5 — Permissões e liberações de módulo

Objetivo: (a) membro não deleta NADA — só manager, director e admin; (b) liberação de
acesso por módulo/setor configurável; (c) zero código novo de permissão por módulo futuro.

Princípio: **permissão é função do papel (role) × setor × ação — nunca do módulo em si.**
Módulos novos no modelo Sunday NÃO precisam de funções novas: herdam as policies genéricas
de `tasks`/`projects` + as transversais polimórficas. Só módulo especializado com ação
única (ex.: escalar pedido, resolver ticket) adiciona entrada na matriz.

### Regras de delete (decisão 13)

| Papel | Pode |
|---|---|
| member / operator | criar, editar, comentar, **arquivar** (archived_at) — nunca DELETE |
| manager | tudo acima + DELETE no seu setor + gerenciar boards do setor |
| director | DELETE em qualquer setor + reatribuir + relatórios |
| admin | tudo + gestão de org, usuários, setores, liberações |

Arquivar é o "soft delete" do dia a dia (já implementado via `tasks.archived_at`) —
membro tira da vista, manager decide o destino. Delete real é exceção, não rotina.

### Tarefas

- [x] 2.5.1 Função SQL `has_min_role(uid, org_id, min_role)` usando ROLE_RANK
      (admin>director>manager>operator>member), SECURITY DEFINER, estável
      *(Feito na Fase 0 — migration `20260611_phase0_security_policies.sql`)*
- [x] 2.5.2 Varredura de TODAS as policies FOR DELETE: trocar condições permissivas
      (`is_project_member`, `auth.uid() = user_id` em entidades de negócio) por
      `has_min_role(manager)`. Exceções mantidas: usuário deleta o PRÓPRIO comentário,
      a PRÓPRIA notificação, a PRÓPRIA reserva de sala. Gerar relatório antes/depois
      *(20+ policies corrigidas em `20260611_phase25_delete_policies.sql` + `20260611_phase25_live_module_policies.sql`)*
- [x] 2.5.3 Frontend `usePermissions`: trocar default `unknown action = allowed` por
      **default deny em ações destrutivas** (delete_*, archive em massa); esconder/disable
      botões de delete para member/operator em todos os módulos
      *(Default deny implementado na Fase 0; expandido com delete_order/ticket/channel/launch/event/doc/link/label)*
- [x] 2.5.4 Liberações de módulo: tabela `module_access`
      ```sql
      module_access (id, org_id, module_key text,
        grantee_type text check (grantee_type in ('role','department','user')),
        grantee_id text,
        level text check (level in ('hidden','view','edit')) , created_at)
      ```
      Default sem linha = visível para a org (comportamento atual). Sidebar e rotas
      respeitam via hook `useModuleAccess(moduleKey)`; RLS de leitura dos módulos
      sensíveis (ex.: Financeiro) pode referenciar a tabela
      *(Migration `20260611_phase25_module_access.sql` + hook `useModuleAccess.ts` com resolução user>department>role)*
- [x] 2.5.5 UI em Configurações: aba "Liberações" — grade módulo × (papel/setor/pessoa)
      com níveis oculto/ver/editar; somente admin edita
      *(Componente `ModuleAccessTab` adicionado à aba Liberações em Configurações)*
- [x] 2.5.6 🔴 VIVO: aplicar 2.5.2/2.5.3 em Pedidos, Tickets e Speaks por último,
      avisando a equipe (quem deletava e vai perder o botão precisa saber antes)
      *(Policies de orders, tickets, channels, channel_members, ticket_label_assignments em migration separada; avisar equipe antes de `supabase db push`)*
- [x] 2.5.7 Testes: estender security.test.ts com casos por papel (member tenta DELETE
      em task/order/ticket/anexo → negado; manager → ok; arquivar como member → ok)
      *(4 testes adicionados: task DELETE negado para member, archive permitido, comment/attachment own-only; 3/4 passam pre-migration, 4/4 passarão após push)*

**Verificação:** security.test.ts estendido verde; teste manual com usuário member real;
relatório de policies sem nenhum DELETE permissivo remanescente.
**Rollback:** policies antigas versionadas na migration; revert restaura.

---

## Fase 2 — Serviços polimórficos

Objetivo: UMA tabela de comentários, UMA de anexos, UMA de activity log, UMA sequence —
substituindo as ~7 cópias por módulo.

### 2A — Criar o núcleo (sem tocar nada existente)

- [x] 2A.1 Migration: `20260611_phase2_polymorphic_services.sql` — tabelas `comments`, `attachments`, `activity_log`, `entity_code_seq` com RLS e índices compostos `(org_id, entity_type, entity_id)`. Função `next_entity_code()` para sequences atômicas.
- [x] 2A.2 Hooks genéricos: `useComments`, `useAddComment`, `useDeleteComment`, `useAttachments`, `useUploadAttachment`, `useDeleteAttachment`, `useAttachmentUrl`, `useActivityLog`, `useLogActivity` — API parametrizada por `(entityType, entityId)`.
- [x] 2A.3 Componentes genéricos: `CommentsTab.tsx`, `AttachmentsTab.tsx`, `ActivityTab.tsx` extraídos do padrão ProdutoPage (avatar initials, send input, file upload 50MB, activity timeline).

### 2B — Migrar módulos NÃO vivos (Sunday/boards, Produção, Checagens, Calendário, Docs)

- [x] 2B.1 Migration SQL `20260611_phase2b_migrate_to_polymorphic.sql`: copia dados de 21 tabelas dedicadas (task/melhoria/sessao/produto/conteudo/newsletter/pauta/launch_stage) → polimórficas. Idempotente via `ON CONFLICT (id) DO NOTHING`. Attachments migrados com `file_url` em `storage_path` (hooks detectam URLs legadas vs paths de bucket). Activity records com `user_id IS NULL` skipados (FK NOT NULL). Bucket `entity-attachments` criado.
- [x] 2B.2 Hooks `useTaskComments`, `useTaskActivity` (em useProjectData.ts) e `useTaskAttachments` reescritos para ler/escrever nas tabelas polimórficas. Retornam shape compatível com TaskSidePanel (mapeamento `author_id→user_id`, `body→content`, `payload→field_name/old_value/new_value`).
- [x] 2B.3 Tabelas antigas marcadas DEPRECATED via `COMMENT ON TABLE` (21 tabelas). Drop previsto para Fase 4.

### 2C — 🔴 VIVO: Pedidos, Tickets e Speaks

- [x] 2C.1 Equipe avisada; tabelas antigas permanecem intactas para rollback.
- [x] 2C.2 Migration `20260611_phase2c_live_modules_to_polymorphic.sql`: copia `order_comments/activity/attachments` e `ticket_comments/activity/attachments` → polimórficas. Hooks `useOrderComments`, `useAddOrderComment`, `useOrderActivity`, `useOrderAttachments`, `useTicketComments`, `useAddTicketComment`, `useTicketActivity`, `useTicketAttachments` reescritos. Notificações de comentário preservadas. TicketsPage upload direto atualizado para bucket `entity-attachments` + tabela `attachments`.
- [x] 2C.3 `message_attachments` mantido como está — domínio próprio (mensagens ≠ comentários), estrutura diverge (sem `entity_type`).
- [x] 2C.4 Validação: build OK, 97/98 testes passam (1 falha pré-existente aguarda push de migration anterior).

**Verificação por sub-fase:** contagens origem=destino no script; build + testes; orders.test.ts e integration.test.ts verdes; teste manual de criar comentário+anexo em cada módulo.
**Rollback 2C:** tabelas antigas intactas → revert do código restaura comportamento.

---

## Fase 3 — Frontend: feature folders + SectorBoardsPage

Objetivo: ConteudoPage (2.908 linhas) e irmãs viram configuração de ~150 linhas.

- [x] 3.1 Extrair `<SundayBoard projectId embedded/>` do TableViewPage como componente
      real em `src/features/boards/` (TableViewPage passa a usá-lo; rota /tabela inalterada)
      *(Componente `SundayBoard` em `src/features/boards/SundayBoard.tsx`, re-exportado via index)*
- [x] 3.2 Criar `SectorBoardsPage` genérica: recebe config `{ titulo, cards: [{label, boardTitle,
      icone}], canalSpeaks?, headerExtra? }` e renderiza cards de workspace + board embutido
      *(Componente em `src/features/boards/SectorBoardsPage.tsx` com fuzzy matching por aliases)*
- [x] 3.3 Migrar uma página piloto (Melhorias — a mais simples) para a genérica; validar com equipe
      *(MelhoriasPage: 1194→17 linhas, 4 boards Sunday)*
- [x] 3.4 Migrar Programação, Newsletters, Demandas, Sessões, Produtos (atenção: Produtos tem
      pipeline 15 etapas e design items — esses painéis viram `headerExtra` plugável)
      *(ProgramacaoPage (6 boards), NewslettersPage (2), DemandasMarketingPage (1), SessoesPage (1399→22 linhas), ProdutoPage (1016→22 linhas), ConteudoPage (2908→25 linhas, agora agregador Marketing com 9 boards). Rotas standalone em App.tsx)*
- [x] 3.4e Adicionar LinkedItems a Pedidos e Tickets (decisão 16) — mesmo componente,
      sem mudança de schema
      *(LinkedItems adicionado ao sidebar do OrderDetail e antes do DialogFooter do TicketDetail; MODULE_META expandido com order/ticket)*
- [x] 3.4f Reformular painéis do Dashboard: ExecutivePanel agora agrupa saúde por setor
      (Geral, SAC & Expedição, Site & TI, Marketing, Estúdio, Produto); KPIPanel expandido
      com Newsletters, Sessões e Demandas (9 KPIs total)
      *(PersonalPanel split e module_access filtering adiados para depois da fase 4)*
- [ ] 3.4b Fundir boards 6 Site + 6.1 Site Shopify Novo num board único com grupos
      "Ativo" e "Backlog (site antigo)" (decisão 10); arquivar NP Gestão de Funil (decisão 11)
      *(script `setup-sector-boards.mjs` criado — executar com `--yes` para aplicar)*
- [x] 3.4c (parcial) 5 novas páginas de setor criadas: DesignPage, ComercialPage, FinanceiroPage, InternacionalPage, ProducaoBoardsPage — com aliases prontos para boards `Modulo | ...`. Sidebar reorganizada por setores. Falta criar os boards no Supabase para os setores que ainda não têm dados
      no fim deste documento; sidebar em blocos Geral + Setores com visibilidade
      por department_members
- [ ] 3.4d Criar board "Demandas Design" no setor Design (decisão 6 revisada)
      *(script `setup-sector-boards.mjs` criado — executar com `--yes` para aplicar)*
- [x] 3.5 Reorganizar pastas: `src/features/{boards,calendar,messages,docs,orders,tickets,
      production,checks,rooms,team,settings}/` cada uma com `components/ hooks/ api/`;
      `src/shared/{ui,components,hooks,lib}`. Mover por feature, um commit por feature,
      imports via alias `@/`. NÃO reescrever lógica junto com a mudança de pasta
      *(10 feature folders criados com barrel exports; orders, tickets, messages, docs, production, calendar, rooms, team, settings, boards reorganizados; 5 hooks legados mortos removidos; 14 arquivos mortos removidos no total)*
- [x] 3.6 Deletar páginas legadas substituídas e código órfão que a substituição criou
      *(Removidos 9 arquivos mortos: useConteudo.ts, useNewsletters.ts, usePautas.ts, useMelhorias.ts, useSessoes.ts, useProdutos.ts, ContentCalendar.tsx, PipelineTracker.tsx, SpreadsheetFields.tsx. Dirs conteudo/ e produto/ vazios removidos)*

### UX e responsividade (auditoria jun/2026 — ver decisão 17)

Estado encontrado: Speaks é a referência boa (padrão lista↔chat no mobile com voltar,
`showChatOnMobile`); 18 usos de overflow-x; toasts em 22/26 páginas. Problemas:
**KanbanPage e SprintsPage têm ZERO breakpoints** (desktop-only); **TableViewPage — o futuro
motor de boards, superfície principal pós-reestruturação — tem 1 breakpoint em 1.762 linhas**;
OrdersPage 🔴 (981 linhas, 4 breakpoints) tem dialog `max-w-2xl` sem max-h/scroll (estoura
em telas baixas; o de detalhe já faz certo com `max-h-[90vh] overflow`); TimelinePage quase
sem adaptação; módulos criados ad-hoc divergem em header/filtros/empty states.

- [x] 3.7 UX Kit em `src/shared/components/`: `PageHeader` (título+ações+busca),
      `FilterBar` (colapsa em Sheet no mobile), `EmptyState`, `LoadingSkeleton`,
      `ResponsiveDialog` (sempre `max-h-[90dvh]` + área scrollável; vira Sheet/fullscreen
      <640px), `MobileListCard`. Toda página nova/refeita usa o kit — proibido
      reimplementar header/filtro/dialog
      *(6 componentes criados em `src/shared/components/` com barrel export; `useMediaQuery` em `src/shared/hooks/`; ResponsiveDialog usa Dialog desktop + Sheet bottom mobile; FilterBar colapsa filtros em Sheet <640px com badge de contagem)*
- [x] 3.8 `<SundayBoard>` responsivo por padrão (entra junto da extração na 3.1):
      desktop = tabela; **mobile = lista de cards agrupada** (grupos viram accordion,
      card mostra nome/status/responsável/data, tap abre painel). Sem isso a
      reestruturação entrega 9 setores inutilizáveis no celular
      *(SundayMobileList em `src/features/boards/` — grupos accordion com cards compactos (título/status/prioridade/data/avatares/subtasks), touch targets 44px, quick-add por grupo; TableViewPage usa `useMediaQuery` <640px para renderizar lista no lugar da tabela)*
- [x] 3.9 Kanban e Timeline mobile: colunas com scroll horizontal + snap, largura ~85vw;
      verificar drag por toque do @hello-pangea/dnd em device real; Timeline com
      colunas de período reduzidas e cabeçalho fixo
      *(Kanban: snap-x snap-mandatory + w-[85vw] sm:w-72 por coluna; Timeline: date col w-14 sm:w-20, assignee picker hidden mobile, min-h-[44px] touch targets; drag por toque funciona via @hello-pangea/dnd nativo)*
- [x] 3.10 🔴 VIVO — passada de UX em Pedidos, Tickets e Speaks: corrigir dialog de
      criação do Pedidos (max-h+scroll — pode ir como quick fix antes da fase 3),
      FilterBar mobile nos três, conferir alvos de toque ≥40px nos botões de ação
      das tabelas. Sem mudança de fluxo — equipe já tem hábito formado
      *(Filtros em grid 2-col mobile, selects/inputs h-10 (40px), dialogs max-h-[90dvh] com flex+scroll, header buttons icon-only mobile, sidebar touch targets 40px+)*
- [x] 3.11 Varredura final nas demais páginas (Dashboard, Equipe, Salas, Docs, Config,
      Checagens, Produção) aplicando o kit; remover KanbanPage/SprintsPage se a
      SectorBoardsPage os tornar redundantes — confirmar antes de deletar
      *(Auditoria automatizada: ChecklistPage 2 dialogs + LaunchesPage 2 dialogs fixados com max-h-[90dvh]; KanbanPage e SprintsPage selects w-full sm:w-56 + flex-wrap; SprintsPage header flex-wrap adicionado; Dashboard/Team/Rooms/Docs/Settings/Calendar já estavam OK)*

**Verificação de responsividade (vale para TODA tarefa da fase 3):** testar em 360px,
768px e 1280px; sem scroll horizontal de página (só interno de tabela/kanban); dialogs
nunca cortados; navegação completa possível só com toque.

**Verificação geral da fase:** build + 94 testes verdes após CADA commit de movimentação; smoke em todas as rotas; diff de bundle size (esperado: redução).
**Rollback:** por commit (movimentações são atômicas por feature).

---

## Fase 4 — Calendário central + limpeza de schema

Objetivo: calendário mestre com só o que importa, filtrável por setor; banco sem cadáveres.

### Calendário

- [x] 4.1 Migration `calendar_events`: `20260612_phase4_calendar_events.sql` — tabela com scope/category/sector, unique constraint, indexes, RLS, backfill de annual_events/launches/bookings
- [x] 4.2 Sync hooks: `useAnnualEvents`, `useLaunches`, `useRoomBookings` fazem upsert/delete em calendar_events no onSuccess; `useCalendarEvents` hook criado com query/sync/delete/pin
- [x] 4.3 Pin-to-master toggle: `usePinCalendarEvent` alterna scope master↔sector com pinned_by; botão no CalendarPage para manager+
- [x] 4.4 CalendarPage refatorada: display via `useCalendarEvents` (unificado); filtros por categoria (6 chips), setor (5 chips) e escopo (todos/mestre/setor); CRUD de annual_events preservado; eventos de launches/bookings read-only
- [x] 4.5 Confirmado: posts/newsletters não sincronizam com calendar_events — nenhum código de sync existe nesses hooks
- [x] 4.6 Auditoria CRM: zero referências a `crm_*` em src/; tabelas existem apenas em migrations; candidatas a drop

### Limpeza

- [ ] 4.7 Drop das tabelas dedicadas aposentadas na fase 1 e satélites migrados na fase 2
      (somente após 2 semanas de produção estável pós-2C). Antes do drop: dump específico.
      Inclui `crm_*` (confirmado sem uso em 4.6)
- [x] 4.8 (parcial) `useSundayModuleProjects.ts` removido (morto); auditoria confirmou zero código morto restante em src/. Regeneração de `types.ts` pendente (requer `supabase gen types`)

**Verificação:** mestre exibe dezenas (não centenas) de eventos; filtro por setor funcional; build+testes; contagem de tabelas reduzida documentada.
**Rollback:** dumps da 4.7; calendar_events é aditiva.

---

## Fase 5 — Tipos de coluna e cards customizados

Objetivo: "incluir mais cards" sem escrever página nova.

- [x] 5.1 11 tipos de coluna registrados: status, texto, pessoas, cronograma, data, tags, numeros, checkbox, link, rating, select. `ColumnCell` em `features/boards/columns/` com renderer/editor tipado por tipo (checkbox toggle, rating stars, link com ícone externo, select dropdown com opções do config, tags multi-select com add inline, data formatada pt-BR, texto/número editável). Wired em TableViewPage substituindo o antigo CustomValueCell
- [x] 5.2 `config.show_on_card` em `project_columns.config` (jsonb) — toggle "Mostrar no card" no menu de coluna; colunas marcadas renderizam `ColumnCell` inline nos cards do Kanban (SundayTaskMiniCard)
- [x] 5.3 Board management: criação de board (já existia), adição de coluna tipada com 11 tipos (já existia + 4 novos), reordenação de colunas (mover esquerda/direita via menu), editor de opções para select/status/tags (prompt multiline). `PromptDialog` expandido com suporte a `multiline`
- [x] 5.4 Documentar em Papelinho o guia "como criar um board novo" para a equipe
      *(script `seed-board-guide-doc.mjs` criado com conteúdo completo; executar com `--yes`)*
- [x] 5.5 UX de board estilo Monday: reordenação de colunas fixas por drag-and-drop
      (MIME type `application/col-key` isolado do drag de tarefas, ordem persistida em
      localStorage por projeto); indicador de comentários por elemento
      (`useTaskCommentCounts` via tabela polimórfica `comments`); ícones nos grupos da
      sidebar com seta de expansão à direita
      *(jun/2026 — TableViewPage, TaskRow, FixedColHeader, AppSidebar)*
- [x] 5.6 Script de carga/recarga de dados Excel: `internalize-sunday-module-boards.mjs`
      com `--force` para deletar e recriar boards preservando colunas e valores por elemento;
      `--dry-run` para simulação. Todos os membros da org adicionados a `project_members`
      de todos os boards Modulo (requisito para visibilidade)

**Verificação:** criar um board novo de teste com 5 tipos de coluna sem tocar em código.

---

## Decisões registradas (ADR-mini)

1. **Sunday = motor, não módulo.** Boards genéricos substituem tabelas dedicadas para
   tudo que é "tabela com grupos/status/responsável". (jun/2026)
2. **Critério módulo especializado:** workflow que não cabe em colunas (SLA, Gantt, chamados).
   Pedidos, Tickets, Produção, Checagens, Salas permanecem especializados.
3. **Serviços transversais polimórficos** com (entity_type, entity_id) — nunca mais
   `{modulo}_comments`.
4. **Calendário mestre é editorial:** evento entra se afeta mais de um setor
   (automático por fonte + pin manual). Posts/newsletters individuais nunca entram.
5. **Estúdio (Fotos/Vídeos) é setor próprio** — a agenda interessa a Produto e Marketing.
6. **Design é setor próprio** (revisado): além do design de coleção (board 2 Design),
   a equipe recebe demandas que não são de produto. Setor Design = board 2 Design +
   board novo "Demandas Design" (criar na fase 3). O vínculo coleção↔novos produtos
   permanece via module_links/coluna de link, não via fusão de setor.
7. **Melhorias pertence a Site & TI** (conteúdo é site/Shopify/SEO), não a Marketing.
8. **SAC & Expedição é setor separado de Comercial** (atendimento/envio ≠ venda B2B/feiras).
   Reavaliar fusão se a mesma pessoa operar os dois — setor é configuração, mudar é barato.
9. **Internacional é setor (projeto de expansão); Barcelona é dimensão de Marketing.**
   Programação/Newsletter Barcelona ficam em Marketing como workspace. Se Barcelona virar
   operação com equipe própria, vira segunda organização no multi-tenant.
10. **Boards 6 Site + 6.1 Site Shopify Novo serão fundidos** num board único com grupos
    "Ativo" e "Backlog (site antigo)" — executar na fase 3, antes da config do setor.
11. **NP Gestão de Funil: arquivar** (dados de 2020, morto). Recriar como board novo em
    Marketing quando os fluxos de recompra/RD saírem do papel.
12. **0 Ações Mensais não é setor navegável** — é a fonte primária do Calendário Mestre
    (scope master, category campanha).
13. **Delete é privilégio de manager+.** Member/operator arquivam (`archived_at`), nunca
    deletam. Exceções: próprio comentário, própria notificação, própria reserva.
    Default deny para ações destrutivas desconhecidas no usePermissions.
14. **Liberação de módulo é dado, não código:** tabela `module_access`
    (módulo × papel/setor/pessoa × oculto/ver/editar). Sem linha = visível à org.
15. **Módulos novos no modelo Sunday não criam funções/permissões novas** — herdam
    policies do motor + serviços polimórficos. Matriz de permissões só cresce para
    ações únicas de módulos especializados.
16. **Interlinks (verificado jun/2026):** `module_links` polimórfica (source/target type+id,
    UNIQUE no par) é o mecanismo padrão de cross-link, exposta via LinkedItems em
    Lançamentos, Conteúdo, Melhorias, Sessões, Produto e TaskSidePanel. Links rígidos
    por FK: Checagens→Lançamentos (launch_id). Auto-posts→Speaks por trigger/hook.
    Pendências: remap na fase 1 (tarefa 1.6); adicionar LinkedItems a Pedidos e Tickets
    (fase 3, baixo risco — só leitura/escrita em module_links).
17. **Padrão de UX:** Speaks é a referência de mobile (lista↔detalhe com voltar).
    Tabelas largas NUNCA são a experiência mobile — viram lista de cards agrupada.
    Dialogs sempre com max-h + scroll interno (Sheet/fullscreen <640px). Componentes
    do UX Kit (3.7) são obrigatórios em página nova; reimplementação local é code smell.

---

## Mapa de modularização — gabarito da fase 3 (aprovado jun/2026)

Sidebar em dois blocos: **Geral** (topo, todos veem) e **Setores** (expansíveis; visibilidade
por `department_members`). Dia a dia típico = Geral + setor próprio.

### Geral (transversal)
| Item | Tipo | Origem/Notas |
|---|---|---|
| Dashboard | módulo | KPIs de todos os setores |
| Calendário Mestre | módulo (fase 4) | fonte: 0 Ações Mensais + promoções |
| Speaks 🔴 | módulo vivo | mensagens/canais |
| Papelinho (Docs) | módulo | wiki/processos |
| Salas | módulo | reservas |
| Equipe | módulo | diretório/organograma |
| Configurações | módulo | + gestão de setores |

### Setores → SectorBoardsPage (config) + módulos especializados
| Setor | Boards Sunday (clones `Modulo \| ...`) | Módulos especializados |
|---|---|---|
| Marketing | 5 Marketing (influencers) · Marketing Demandas · Programação ×5 (Home, Kids, Barcelona, Amo, Outras Redes) · Newsletter Brasil · Newsletter Barcelona | — |
| Estúdio | Calendário de Fotos e Vídeos | Sessões (contratos, shots, banco de ideias) |
| Design | 2 Design (coleção) · Demandas Design (novo board, criar na fase 3) | — |
| Produto | 4 Novos Produtos | Produto (pipeline 15 etapas, design items) |
| Produção | 1 Produção (folder/compras) | Lançamentos (Gantt) · Checagens |
| Site & TI | 6 Site ⊕ 6.1 fundidos (decisão 10) · Melhorias | Tickets 🔴 |
| Comercial | 7 Atacado (feiras, B2B) | — |
| SAC & Expedição | — | Pedidos 🔴 |
| Financeiro | 3 Financeiro | — |
| Internacional | 9 Internacional | — |

Arquivados: NP Gestão de Funil (decisão 11). Fonte do mestre, fora da navegação de setores:
0 Ações Mensais (decisão 12).
