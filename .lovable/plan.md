# Plano

## 1. Projetos como item fixo no menu lateral
- Adicionar "Projetos" no grupo **Operações** da sidebar (`AppSidebar.tsx`), ícone `FolderKanban`, rota `/projetos`.
- Manter a seção "Projetos" colapsável (lista de projetos do workspace atual) que aparece quando você está em `/projetos` ou `/tabela`.

## 2. Tornar o switcher Brasil/Barcelona mais visível
- Adicionar uma **barra superior** (top bar) no `AppLayout`, à direita do `SidebarTrigger`, exibindo:
  - Bandeirinha/cor + nome da org atual
  - Dropdown para trocar (mesmo do rodapé da sidebar)
  - Badge "Admin"/"Membro"
- O switcher do rodapé continua existindo (consistência), mas o do topo vira o principal.

## 3. Garantir que TODOS os módulos filtram por org
Auditoria + ajuste dos hooks existentes para sempre passarem `currentOrg.id`:
- `useCRM`, `useChecklists`, `useLaunches`, `useAnnualEvents`, `useChannels` (Mensagens), `useDocPages`, `useMeetingRooms`/`useRoomBookings`, `useProjectMembers` (Equipe).
- Onde já usa, só confirmar. Onde falta, adicionar `eq('organization_id', currentOrg.id)`.
- Trocar a org no topo deve **invalidar queries** automaticamente (já acontece pois `currentOrg.id` está nas queryKeys).

## 4. Multi-instância por módulo (cada módulo = "lista de projetos")
Cada módulo passa a ter **N instâncias** dentro da org, igual `/projetos` faz. Ex.: Brasil pode ter 3 CRMs ("Atacado", "Varejo", "Parceiros"), 2 Calendários, etc.

### Modelo de dados
Criar tabela genérica `module_instances`:
```
module_instances (
  id, organization_id, module_key (text: 'crm'|'calendario'|'lancamentos'|'checagens'|'docs'),
  name, color, icon, created_by, created_at, archived_at
)
```
RLS: membros da org podem ver/criar; owner/admin pode arquivar.

Adicionar coluna `instance_id uuid` (nullable) nas tabelas de cada módulo:
- `crm_pipelines.instance_id`
- `annual_events.instance_id`
- `launches.instance_id`
- `launch_checklists.instance_id`
- (Docs já tem hierarquia própria via `parent_id` — fica de fora desta etapa)

### UX
Cada página de módulo (`CRMPage`, `CalendarPage`, `LaunchesPage`, `ChecklistPage`) ganha:
- Lista de instâncias (cards) ao entrar em `/crm`, `/calendario`, etc.
- Botão "Nova instância"
- Ao clicar em uma, navega para `/crm/:instanceId` (rota nova) e mostra o conteúdo atual
- Breadcrumb: `Brasil › CRM › Atacado`

### Migração
- Criar 1 instância default por módulo em cada org existente (ex.: "Geral") e mapear todos os registros existentes para ela, para não quebrar dados.

## Ordem de execução
1. Sidebar: adicionar item Projetos (rápido)
2. Top bar com org switcher (rápido)
3. Auditoria de filtros por org nos hooks (médio)
4. Multi-instância: migration + tabela + alterações em CRMPage primeiro (piloto), depois replicar para os outros (maior)

## Aviso
A etapa 4 é grande. Se quiser, posso entregar **1, 2 e 3 agora** e tratar a #4 num próximo turno (com mais detalhe por módulo) — fica mais seguro do que mexer em tudo de uma vez.
