# Plano: Documentação por setor, permissões granulares e Reserva de Salas

Vou implementar 3 blocos de melhorias em sequência. Tudo integrado aos usuários e organização atuais.

## 1. Documentação por setor + ordem alfabética + ícones

**Banco (migração):**
- Adicionar à tabela `doc_pages`:
  - `department_id uuid` (referência opcional a `org_departments`) — filtro/grupo
  - `can_edit_roles text[]` default `{admin,manager,member}` — quem pode editar
  - `can_delete_roles text[]` default `{admin}` — quem pode excluir
  - `updated_by` já existe
- Atualizar políticas RLS:
  - `UPDATE`: permitir se membro da org **e** o app_role do usuário está em `can_edit_roles` (ou é o autor, ou admin da org)
  - `DELETE`: permitir se app_role em `can_delete_roles` (ou admin da org)

**UI (DocsPage):**
- Ao criar nova página, abrir um pequeno diálogo:
  - Título
  - Setor (select usando `org_departments` da organização — admin cria em Configurações, já existe)
  - Ícone (picker com ~30 emojis comuns, mais campo livre)
- Árvore agrupada por setor (cabeçalho do setor, com contagem). Páginas ordenadas **alfabeticamente** dentro de cada grupo.
- Painel do documento mostra:
  - Autor (`created_by`) + data de criação
  - Última edição por (`updated_by`) + data
  - Botões de "Permissões" (admin org) abrindo um popover com 2 grupos de checkboxes (editar / excluir) por papel (admin/manager/member)
- Excluir continua respeitando permissão. Erros mostram toast claro.

## 2. Módulo "Salas de Reunião" (novo)

**Banco (migração):**
- `meeting_rooms` (organization_id, name, description, capacity, color, created_by)
  - RLS: SELECT membros da org; INSERT/UPDATE/DELETE apenas admin da org
- `meeting_room_bookings` (room_id, organization_id, user_id, title, description, starts_at, ends_at)
  - Trigger de validação: `ends_at > starts_at` e impedir sobreposição na mesma sala
  - RLS: SELECT membros da org; INSERT/UPDATE/DELETE apenas o próprio dono ou admin da org

**UI (nova rota `/rooms`, item no sidebar "Salas"):**
- Topo: seletor de sala + botão "Nova reserva"
- Visualização **calendário semanal** (grade dias × horas, slots 30min) com blocos coloridos por reserva — clique abre modal de detalhes
- Diálogo "Nova reserva": sala, título, data, hora início, hora fim, descrição. Validação cliente + erro de sobreposição do banco.
- Diálogo "Gerenciar salas" (admin): criar/editar/excluir salas (nome, capacidade, cor)
- Mostra quem reservou (avatar + nome), e o usuário pode excluir as próprias reservas; admin pode excluir qualquer.

## 3. Detalhes técnicos

**Arquivos novos:**
- `src/hooks/useMeetingRooms.ts`, `src/hooks/useRoomBookings.ts`
- `src/pages/RoomsPage.tsx`
- `src/components/rooms/RoomCalendar.tsx`, `BookingDialog.tsx`, `ManageRoomsDialog.tsx`
- `src/components/docs/NewPageDialog.tsx`, `IconPicker.tsx`, `PagePermissions.tsx`

**Arquivos editados:**
- `src/hooks/useDocPages.ts` — novos campos (department_id, can_edit_roles, can_delete_roles, ordering)
- `src/pages/DocsPage.tsx` — agrupamento por setor, ordem alfabética, diálogo de criação, autor/editor, permissões
- `src/components/AppSidebar.tsx` — item "Salas"
- `src/App.tsx` — rota `/rooms`

Sem mudanças visuais no resto do app. Tudo dentro do design system existente (cores semânticas).

Aprovando, eu começo pela migração do banco, depois UI.