# MOOUI Collab Hub — Evolucao: 4 Novos Modulos

Data de inicio: 2026-06-02

## Contexto

A MOOUI opera com 23 boards no Monday.com que precisam migrar para o Collab Hub. Apos analise dos exports, identificamos 4 grandes lacunas no sistema atual que nao cobriam fluxos criticos do dia a dia:

1. **Marketing nao consegue ver prioridades nem planejar conteudo** — posts, newsletters, pautas editoriais espalhados em boards separados sem visao unificada
2. **Sessoes de foto/video sao caoticas** — sem controle de shots, contratos com fotografos, banco de ideias
3. **Produto (desenvolvimento) perde prazos** — pipeline de 15 etapas sem visibilidade de progresso
4. **Bugs e melhorias de site estao misturados** — Tickets de TI mistura suporte com melhorias estrategicas de site/SEO/Shopify

## Ordem de Implementacao

| Fase | Modulo | Status | Descricao |
|------|--------|--------|-----------|
| 1 | **Melhorias** | COMPLETO | Site & Sistemas (bugs ficam em Tickets) |
| 2 | **Conteudo** | COMPLETO | Hub de Conteudo & Redes Sociais (3 abas) |
| 3 | **Sessoes** | COMPLETO | Producao de Foto & Video |
| 4 | **Produto** | COMPLETO | Pipeline de Desenvolvimento |
| 5 | **Calendario + Cross-Module** | COMPLETO | Evolucao calendario e integracao |

---

## FASE 1: Melhorias (Site & Sistemas) — COMPLETO

**Objetivo:** Separar melhorias estrategicas de site/SEO/Shopify dos tickets de TI (bugs/suporte).

### Database
- **Tabela principal:** `melhorias` — title, description, area, status, priority, assigned_to, data_abertura, data_conclusao
- **Areas:** site_melhorias, shopify, seo_onpage, seo_tecnico
- **Status:** open, in_progress, done, rejected
- **Tabelas auxiliares:** melhoria_comments, melhoria_attachments, melhoria_activity, melhoria_code_seq
- **Auto-code:** ML-001, ML-002...
- **Triggers:** auto-code, activity log (status/priority/area/assigned changes), updated_at
- **Storage bucket:** melhoria-attachments
- **Migration:** `supabase/migrations/20260603010000_melhorias_module.sql`

### Frontend
- **Hook:** `src/hooks/useMelhorias.ts` — CRUD completo, notificacoes ao responsavel, auto-post ao canal #site quando status=done
- **Hook:** `src/hooks/useMelhoriaAttachments.ts` — upload/download com signed URLs
- **Page:** `src/pages/MelhoriasPage.tsx` (~630 linhas) — pagina completa com:
  - Header com busca, filtros (scope/area/prioridade), tabs de status com contadores
  - Dialog de criacao com titulo, descricao, area, prioridade, anexos
  - Dialog de detalhe com campos editaveis, linked items, abas (comentarios/anexos/atividade)

### Funcionalidades
- Filtro por escopo (todas/minhas/atribuidas), area, prioridade
- Busca por titulo/descricao
- Tabs por status com contagem
- Comentarios com notificacao ao autor/responsavel
- Anexos de arquivo com upload/download
- Log de atividade automatico
- Auto-post ao canal #site quando melhoria eh concluida
- Linked items (cross-module)

---

## FASE 2: Conteudo (Hub de Conteudo & Redes Sociais) — COMPLETO

**Objetivo:** Dar visibilidade ao marketing sobre toda a programacao de conteudo, newsletters e pautas editoriais.

### Database
- **conteudo_items** — title, channel (6 canais), scheduled_date, time_slot, status (5 estados), content_type (5 tipos), is_repost, content_category, photo_url, assigned_to
- **Canais:** mooui_kids, mooui_home, amo_mooui, barcelona, outras_redes, pinterest
- **Status:** nao_iniciado, em_andamento, em_revisao, aprovado, publicado
- **Tipos:** foto, video, carrossel, reels, stories
- **Auto-code:** CT-001, CT-002...
- **newsletters** — title, scheduled_date, status, tema, base, hora, titulo_email, open_rate, click_rate, channel (brasil/barcelona)
- **pautas + pauta_items** — demandas editoriais com subitens (checklist)
- **conteudo_activity** — log automatico de mudancas
- **Migration:** `supabase/migrations/20260603020000_conteudo_module.sql`

### Frontend
- **Hook:** `src/hooks/useConteudo.ts` — CRUD conteudo_items + activity, notificacoes
- **Hook:** `src/hooks/useNewsletters.ts` — CRUD newsletters
- **Hook:** `src/hooks/usePautas.ts` — CRUD pautas + pauta_items (subitens)
- **Page:** `src/pages/ConteudoPage.tsx` (~700 linhas) — 3 abas:
  - **Programacao:** lista + calendario visual, filtro por canal/status, dialog de criacao e detalhe
  - **Newsletters:** lista com badges de canal/status, dialog com todos os campos (tema, base, hora, open/click rate)
  - **Pautas:** lista expansivel com subitens (checklist), status/prioridade/responsavel editaveis inline
- **Componente:** `src/components/conteudo/ContentCalendar.tsx` — calendario mensal visual com posts por dia, cores por canal, legenda

### Funcionalidades
- Vista lista e calendario com toggle
- Filtro por canal (6 canais) e status
- Busca por titulo
- Calendario visual mensal com dots coloridos por canal
- Newsletter com metricas (open rate, click rate)
- Pautas com subitens expansiveis (checklist toggle)
- Activity log automatico
- Notificacoes ao responsavel
- Linked items (cross-module)

---

## FASE 3: Sessoes (Producao de Foto & Video) — COMPLETO

**Objetivo:** Organizar sessoes de foto/video com shots, contratos com fotografos e banco de ideias.

### Database (migration ja criada)
- **sessoes** — title, scheduled_date, professional, status, responsaveis (UUID[]), notes
- **sessao_shots** — title, tipo (foto/video), status, local, funil, content_type, modelo, data_entrega
- **sessao_contracts** — photographer_name, contract_start/end, monthly_quota_photos/videos
- **sessao_ideas** — title, category, status, notes
- **sessao_activity** — log automatico
- **Auto-code:** SS-001, SS-002...
- **Migration:** `supabase/migrations/20260603030000_sessoes_module.sql`

### Frontend
- **Hook:** `src/hooks/useSessoes.ts` — CRUD sessoes, shots e activity
- **Hook:** `src/hooks/useSessaoContracts.ts` — CRUD contratos de fotografos/videomakers
- **Hook:** `src/hooks/useSessaoIdeas.ts` — CRUD banco de ideias
- **Page:** `src/pages/SessoesPage.tsx` — 3 abas (Sessoes, Contratos, Banco de Ideias)
- Sessoes com shots hierarquicos expandiveis, progresso por shots concluidos, responsaveis multiplos e LinkedItems

---

## FASE 4: Produto (Pipeline de Desenvolvimento) — COMPLETO

**Objetivo:** Pipeline de 15 etapas para acompanhar desenvolvimento de produto da concepcao a apresentacao.

### Database (migration ja criada)
- **produtos** — name, collection_group, responsible, launch_target, cronograma_start/end, progress (auto-calculado)
- **produto_stages** — 15 etapas auto-seeded via trigger, stage_key + status + assignee_id
- **15 etapas:** definicao_produto → prospeccao_fornecedores → validacao_pre_custo → design_estampa → peca_piloto → aprovacao → embalagem → fornecedor_aprovado → ficha_tecnica → rapport → mostruario_foto → producao → fotos → entrega_pd → apresentacao
- **produto_design_items** — nome, qt_variacoes, status, target_date
- **produto_activity** — log automatico (inclui mudancas de stages individuais)
- **Auto-code:** PR-001, PR-002...
- **Auto-progress:** trigger recalcula % quando qualquer stage muda para 'finalizado'
- **Migration:** `supabase/migrations/20260603040000_produto_module.sql`

### Frontend
- **Hook:** `src/hooks/useProdutos.ts` — CRUD produtos, stages, design items e activity
- **Page:** `src/pages/ProdutoPage.tsx` — lista de produtos, filtros, progress bar e detalhe expansivel
- **Componente:** `src/components/produto/PipelineTracker.tsx` — visualizacao das 15 etapas com status visual
- Detalhe com Pipeline, Design Variations, Activity e LinkedItems

---

## FASE 5: Calendario + Cross-Module — COMPLETO

**Objetivo:** Evoluir o calendario existente e integrar todos os modulos.

### Implementado
- **DB:** `annual_event_etapas` (event_id, etapa_key, title, status, responsavel, position)
- **Hook:** `src/hooks/useEventEtapas.ts` — leitura, seed das etapas padrao e update de status/responsavel
- **CalendarPage:** aba Etapas no dialog de evento, com criacao automatica ao criar evento e seed manual para eventos antigos
- **Timeline:** adicionadas 4 novas fontes de dados (melhorias, conteudo, sessoes, produtos)
- **Dashboard:** cards e contadores para melhorias, conteudo, sessoes e produtos
- **PersonalPanel:** conteudo, sessoes e produtos atribuidos entram na agenda quando possuem data
- **ModuleInstances:** `ModuleKey` estendido com novos modulos
- **personalAgenda.ts:** `AgendaKind` estendido com novos tipos

---

## Integracao (ja feita para todos os modulos)

### Rotas (`src/App.tsx`)
- `/melhorias` → MelhoriasPage
- `/conteudo` → ConteudoPage
- `/sessoes` → SessoesPage
- `/produtos` → ProdutoPage

### Sidebar (`src/components/AppSidebar.tsx`)
- 4 novos itens no grupo "Operacoes": Melhorias (Globe), Conteudo (Camera), Sessoes (Camera), Produtos (Package)

### LinkedItems (`src/components/LinkedItems.tsx`)
- 4 entradas em MODULE_META: melhoria (cyan), conteudo (pink), sessao (violet), produto (orange)

### i18n (`src/i18n/translations.ts`)
- PT-BR: melhorias, conteudo, sessoes, produtos
- ES: Mejoras, Contenido, Sesiones, Productos

---

## Inventario de Arquivos

### Novos (criados)
| Arquivo | Tipo | Linhas aprox |
|---------|------|-------------|
| `supabase/migrations/20260603010000_melhorias_module.sql` | Migration | 180 |
| `supabase/migrations/20260603020000_conteudo_module.sql` | Migration | 200 |
| `supabase/migrations/20260603030000_sessoes_module.sql` | Migration | 185 |
| `supabase/migrations/20260603040000_produto_module.sql` | Migration | 230 |
| `src/hooks/useMelhorias.ts` | Hook | 240 |
| `src/hooks/useMelhoriaAttachments.ts` | Hook | ~80 |
| `src/hooks/useConteudo.ts` | Hook | 140 |
| `src/hooks/useNewsletters.ts` | Hook | 95 |
| `src/hooks/usePautas.ts` | Hook | 155 |
| `src/pages/MelhoriasPage.tsx` | Page | 630 |
| `src/pages/ConteudoPage.tsx` | Page | 700 |
| `src/components/conteudo/ContentCalendar.tsx` | Component | 115 |

### Modificados
| Arquivo | Mudanca |
|---------|---------|
| `src/App.tsx` | +4 imports, +4 Routes |
| `src/components/AppSidebar.tsx` | +4 nav items em Operacoes |
| `src/components/LinkedItems.tsx` | +4 entradas MODULE_META |
| `src/i18n/translations.ts` | +nav keys pt-BR e es |

### Pendentes de criar
Nenhum arquivo pendente para as fases 1 a 5.

---

## Padrao Tecnico

Todos os modulos seguem o mesmo padrao consistente:

1. **Migration SQL** com RLS, auto-code trigger, activity log trigger, updated_at trigger
2. **Hook React** com useQuery/useMutation (TanStack), `as any` para tabelas nao tipadas, notificacoes via notifyUser()
3. **Page React** com filtros, busca, dialogs de criacao/detalhe, LinkedItems, activity log
4. **QueryKey** inclui `currentOrg?.id` para cache por organizacao
5. **Multi-tenancy** via organization_id + is_org_member() RLS policies
