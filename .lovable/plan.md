# Plano

## 1. Projetos como item fixo no menu lateral ✅
- "Projetos" no grupo **Operações** da sidebar, ícone `FolderKanban`, rota `/projetos`.
- Seção "Projetos" colapsável (lista de projetos do workspace atual).

## 2. Top bar com switcher de organização ✅
- Barra superior no `AppLayout` com `OrgSwitcher` à direita do `SidebarTrigger`.

## 3. Filtro por organização em todos os módulos ✅
Hooks passam `currentOrg.id` e invalidam queries ao trocar de org.
Módulos cobertos: Checagens, Lançamentos, Calendário (annual events), Mensagens (channels), Docs, Salas, Equipe.

## 4. Multi-instância por módulo ✅
Tabela `module_instances` + coluna `instance_id` nos módulos suportados.
Cada módulo lista instâncias e abre conteúdo por `/:instanceId`.
Módulos com multi-instância: Calendário, Lançamentos, Checagens.

> **CRM removido do escopo.** Não será mais implementado.

## 5. UX / Polimento ✅
- `prompt()` nativo substituído por `PromptDialog`.
- `confirm()` nativo substituído por `useConfirm` (ConfirmDialog).
- Responsividade mobile, command palette (⌘K), notificações.

## Próximos candidatos (a definir com o usuário)
- Realtime em mensagens/tickets/menções
- Revisão fina de RLS por papel (Admin/Membro)
- Atalhos de teclado adicionais
