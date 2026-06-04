# MOOUI Collab Hub — Status do Projeto

Atualizado em: 2026-06-04

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
| 9 | Calendario Mkt | `/calendario` | OK — anual, categorias, etapas por evento, timeline |
| 10 | Producao (Lancamentos) | `/lancamentos` | OK — pipeline com Gantt, etapas, anexos, activity |
| 11 | Check Lancamentos | `/checagens` | OK — checklists com evidencia, templates |
| 12 | Pedidos (SAC/Exp) | `/pedidos` | OK — workflow, SLA, anexos, escalation, relatorio |
| 13 | Tickets TI | `/tickets` | OK — chamados, SLA, relatorio, link wiki |

### Novos (migrados do Monday.com)

| # | Modulo | Rota | Status |
|---|--------|------|--------|
| 14 | Melhorias | `/melhorias` | OK — site/shopify/SEO, subitems com CRUD completo, progresso, kanban DnD |
| 15 | Conteudo | `/conteudo` | OK — 3 abas (programacao+calendario+kanban, newsletters, pautas), checklist com prioridade, comentarios, anexos, atividade em todos os sub-modulos |
| 16 | Sessoes | `/sessoes` | OK — foto/video, shots, contratos, banco de ideias, comentarios, anexos, kanban DnD |
| 17 | Produto | `/produtos` | OK — pipeline 15 etapas, design items, auto-progress, comentarios, anexos, kanban DnD |

---

## Dados Importados (Monday.com → Supabase)

Data: 2026-06-03 | Org: MOOUI Brasil

| Tabela | Registros | Fonte |
|--------|-----------|-------|
| melhorias | 302 | 6_Site, 6_1_Shopify, NP_SEO_On_Page, NP_SEO_Tecnico |
| melhoria_subitems | 182 | Subitens dos boards acima |
| conteudo_items | 178 | Programacao (Kids, Home, Amo, Barcelona, Outras) |
| conteudo_checklist_items | 26 | Subitens de conteudo |
| produtos | 125 | 4_Novos_Produtos, 2_Design |
| produto_stages | 1.000 | Auto-seed (15 etapas/produto) |
| produto_design_items | 450 | 2_Design (variacoes) |
| newsletters | 1.000+ | Newsletter Brasil + Barcelona |
| pautas | 51 | Marketing_Demandas |
| pauta_items | 37+ | Marketing_Demandas subitens |
| sessoes | 148 | Calendario_de_Fotos_e_Videos |
| sessao_shots | 401 | Shots por sessao |
| annual_events | 45 | 0_Acoes_Mensais |
| annual_event_etapas | 135 | Etapas por evento |

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
