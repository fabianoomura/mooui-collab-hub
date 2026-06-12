# MOOUI Collab Hub

Plataforma interna de gestão e comunicação da MOOUI (moda — Brasil e Barcelona).
17 módulos sobre React + Supabase. Em reestruturação — leia `docs/REESTRUTURACAO.md` antes de qualquer mudança estrutural.

## Comandos

```bash
npm run dev          # Vite dev server
npm run build        # OBRIGATÓRIO antes de concluir qualquer tarefa
npm run test         # Vitest (9 arquivos, ~94 testes)
npm run test -- src/test/edits.test.ts src/test/consolidated.test.ts  # suite rápida
npm run lint
```

**Ritual de validação (toda tarefa termina assim):**
1. `npm run build` → sem erros
2. `npm run test` → tudo verde (timeout flutuante conhecido em docs/Supabase; rodar isolado se ocorrer)
3. Registrar a mudança em `STATUS.md` (seção Histórico de Evolução, formato data | marco)

## ⚠️ Módulos EM PRODUÇÃO — equipe usando diariamente

`Pedidos` (/pedidos), `Tickets` (/tickets) e `Speaks` (/mensagens) estão em uso real.
- NUNCA alterar schema dessas tabelas sem migração reversível e plano de rollback
- NUNCA quebrar contratos dos hooks `useOrders`, `useTickets`, `useMessages`, `useChannels`
- Mudanças nesses módulos: sempre plan mode primeiro, sempre testes antes e depois

## Stack

- React 18 + TypeScript + Vite + TanStack React Query
- Supabase: PostgreSQL + RLS + Auth + Storage + Realtime (migrations em `supabase/migrations/`)
- shadcn/ui (Radix) + Tailwind — componentes base em `src/components/ui/` (não editar manualmente)
- Vitest · i18n PT-BR/ES em `src/i18n/translations.ts` · Deploy via Lovable

## Arquitetura — princípio central

**O Sunday (projects/tasks/columns/custom_values) é o MOTOR de boards do sistema, não um módulo.**
Setores são configuração em cima do motor, não código novo.

Regras de ouro:
1. **PROIBIDO criar novo conjunto `{modulo}` + `{modulo}_comments` + `{modulo}_attachments` + `{modulo}_activity` + `{modulo}_code_seq`.** Esse padrão está sendo eliminado. Dados tipo board vão no motor Sunday; serviços transversais usam as tabelas polimórficas (`comments`, `attachments`, `activity_log` com `entity_type`/`entity_id`) quando existirem — ver fase 2 do plano.
2. Módulo especializado (tabela própria) só se tiver workflow que não cabe em colunas: SLA/escalation (Pedidos), Gantt/etapas (Produção), chamados (Tickets). Na dúvida, é board.
3. Eventos datados relevantes sincronizam com `calendar_events` (fase 4). Mestre = marcos multi-setor; setor = tarefas datadas; posts/newsletters individuais NÃO vão para calendário.
4. Página nova de setor = configuração da `SectorBoardsPage` genérica (fase 3), nunca cópia de ConteudoPage/MelhoriasPage.

## Mapa do código

```
src/pages/        # páginas por rota — ALVO: <150 linhas, só composição
src/components/   # por domínio (orders/, tickets/, kanban/, table/...) + ui/ (shadcn)
src/hooks/        # um hook React Query por domínio (useOrders, useTickets...)
src/contexts/     # AuthContext, OrganizationContext, ThemeContext
src/integrations/supabase/  # client + types.ts gerado (NÃO editar types.ts à mão)
src/test/         # vitest; security.test.ts cobre RLS
scripts/          # imports Monday/Excel e utilitários (node *.mjs)
supabase/migrations/  # 66+ migrations SQL
```

Arquivo legado em desmonte (não estender, só reduzir): `TableViewPage.tsx` (~730 linhas, componentes visuais já extraídos para `features/boards/components/`, falta extrair lógica de estado).

## Convenções

- Multi-tenant: toda query filtra por `org_id` via OrganizationContext; toda tabela nova tem RLS por organização
- Hierarquia: admin > director > manager > operator > member (`usePermissions`)
- **Delete é manager+; member/operator arquivam** (`archived_at`). Default deny em ações destrutivas
- Auto-codes por sequence: ML-xxx, CT-xxx, SS-xxx, PR-xxx
- Boards internos clonados seguem nomenclatura `Modulo | <nome>`
- Datas/corte de dados: importações respeitam corte 2026+
- Idioma do código: inglês; UI e commits: português
- Commits pequenos e temáticos; nunca commitar `.env` novo nem chaves

## UX e responsividade (obrigatório em toda tela)

- Testar em 360px, 768px e 1280px antes de concluir; sem scroll horizontal de página
- Usar o UX Kit de `src/shared/components/` (PageHeader, FilterBar, EmptyState,
  ResponsiveDialog, MobileListCard) — NÃO reimplementar header/filtro/dialog localmente
- Dialogs: sempre `max-h-[90dvh]` + área interna scrollável; <640px vira Sheet/fullscreen
- Tabela larga nunca é a experiência mobile: mobile = lista de cards agrupada
- Referência de padrão mobile: MessagesPage (lista↔detalhe com botão voltar)
- Alvos de toque ≥40px; toda mutação dá feedback (toast/optimistic)

## Fonte da verdade

- `STATUS.md` — estado atual, histórico, pendências (manter atualizado SEMPRE)
- `docs/REESTRUTURACAO.md` — plano de fases da reestruturação; consultar antes de decisões de schema/estrutura
- Migrations são append-only: nunca editar migration antiga, sempre criar nova

## Antes de codar (tarefas não-triviais)

1. Ler STATUS.md e a fase atual em docs/REESTRUTURACAO.md
2. Plan mode: explorar, propor plano com critérios de verificação por passo, aguardar aprovação
3. Declarar premissas explicitamente; se houver mais de uma interpretação, apresentar opções
4. Mudança mínima e cirúrgica — não "melhorar" código adjacente; toda linha alterada deve rastrear ao pedido
