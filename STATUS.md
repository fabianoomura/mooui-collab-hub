# MOOUI Collab Hub — Status do Projeto

Atualizado em: 2026-06-05

---

## Arquitetura

- **Frontend:** React 18 + TypeScript + Vite + TanStack React Query
- **Backend:** Supabase (Auth, PostgreSQL + RLS, Storage, Realtime)
- **UI:** shadcn/ui (Radix) + Tailwind CSS
- **Deploy/Hosting:** Lovable
- **Multi-tenant:** Organizacoes com hierarquia de 5 niveis (admin, director, manager, operator, member)
- **i18n:** PT-BR + ES (Barcelona)

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
| 14 | Melhorias | `/melhorias` | OK — site/shopify/SEO, subitems com CRUD completo, progresso, kanban DnD |
| 15 | Marketing | `/conteudo` | OK — Programacao, Newsletters por card Brasil/Barcelona e Demandas Marketing com subelementos estilo Sunday |
| 16 | Calendario de Fotos e Videos | `/sessoes` | OK — foto/video, shots, contratos, banco de ideias, cards de status, comentarios, anexos, kanban DnD |
| 17 | Produto | `/produtos` | OK — pipeline 15 etapas, design items, auto-progress, comentarios, anexos, kanban DnD |

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
| `scripts/cleanup-old-data.mjs` | Remove dados anteriores a 2026 |
| `scripts/generate-monday-import-sql.mjs` | Gera SQL a partir dos Excel |

---

## Pendencias Conhecidas

| Item | Modulo | Prioridade |
|------|--------|-----------|
| Integracao Shopify (pedidos automaticos) | Pedidos | Alta |
| Integracao Google Calendar | Salas | Media |
| Engine de automacoes customizaveis ("quando X, faca Y") | Cross-module | Media |

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

### Validacao 2026-06-05

- `npm run build`: OK.
- Smoke HTTP local `8082`: OK em `/`, `/conteudo`, `/sessoes`, `/melhorias`, `/configuracoes`.
- `scripts/verify-admin-profile-update.mjs`: OK, update de nome de membro aceito pela policy.
- `npm run test`: falha em suites antigas por RLS/fixtures remotos (`42501`, `23503`, RPC `notify_user` ambigua), nao por build.
- `npm run lint`: falha por divida preexistente ampla (`no-explicit-any`, fast refresh, etc.).
