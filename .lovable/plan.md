# Revisão UX — pacote completo

Aplicar padrões consistentes de UX em todos os módulos, em ordem de impacto. Cada bloco entrega valor isolado, então posso parar a qualquer momento se quiser revisar antes de continuar.

## Bloco 1 — CRM (funil)

- **Painel lateral (Sheet) em vez de modal** ao clicar num negócio: editar sem perder contexto do funil; histórico de atividades visível.
- **Drag-and-drop** entre estágios (com toast de confirmação e atualização otimista).
- **Busca global** + filtros: por responsável, valor mínimo, data de fechamento, com Shopify (rascunho/pedido).
- **Cards mais informativos**: avatar do responsável, dias parado no estágio, indicador de "quente" (>R$ X) ou "frio" (>14 dias parado).
- **Estado vazio guiado** por estágio (ex.: "Arraste um lead para cá") e por funil (CTA grande quando 0 negócios).
- **Totais no rodapé do estágio** + ticket médio.

## Bloco 2 — Checagem do site

- **Sidebar vira drawer (Sheet) no mobile** com botão "Trocar checagem" no header.
- **Filtros**: pendentes, atrasadas, bloqueadas, por categoria, por responsável.
- **Atribuir responsável e data limite inline** (popover) sem abrir modal.
- **Reordenar itens por drag** dentro da categoria.
- **Highlight visual** para itens atrasados (vermelho) e do dia (âmbar).
- **Ações em massa**: marcar todos da categoria como OK / N/A.
- **Atalhos**: tecla `space` para alternar status do item focado.

## Bloco 3 — Lançamentos

- **Drag-reorder** das etapas (recálculo automático ao soltar).
- **Gantt com zoom** (semana/mês) e marcador "hoje" vertical.
- **Indicadores de gargalo**: etapa com >N dias de atraso destacada com tooltip explicativo.
- **Estado vazio guiado** com template inicial ("Coleção padrão" 6 etapas) em 1 clique.
- **Botão duplicar lançamento** (copia etapas).
- **Painel lateral** ao clicar etapa (em vez de modal).

## Bloco 4 — Calendário Anual

- **Filtro por categoria** (chips no topo) e busca por título.
- **Marcador "hoje"** destacado no card do mês.
- **Eventos multi-mês** renderizados como faixa contínua (não duplicados).
- **Densidade ajustável**: compacto/confortável.
- **Toggle vista mês × timeline** (linha cronológica horizontal do ano).

## Bloco 5 — Home / Dashboard

- **Saudação personalizada** ("Bom dia, Marina") + data.
- **Widget "Hoje"**: minhas tarefas, próxima reserva de sala, próxima etapa de lançamento sob minha responsabilidade.
- **Cards mais ricos**: ao invés de só contagem, mostrar o item mais relevante (ex.: "Próximo: Coleção Outono — etapa Fotos vence amanhã").
- **Ordem dos cards** memorizada por usuário (localStorage), drag para reordenar.

## Bloco 6 — Sistema / global

- **Skeletons de loading** em todas as listas/grids (substituir os "Carregando…" e spinners).
- **Cmd+K (busca global)** que navega entre módulos, projetos, contatos, lançamentos.
- **Breadcrumbs** no header das páginas internas (ex.: Lançamento › Coleção Outono).
- **Toasts mais úteis**: ação "Desfazer" em operações destrutivas (excluir negócio/etapa/checagem).
- **Microinterações**: transições suaves nos drawers, fade nos cards, hover refinado.
- **Confirmação destrutiva** com `AlertDialog` em vez de `confirm()` nativo.

## Detalhes técnicos

- **Drag-and-drop**: `@dnd-kit/core` + `@dnd-kit/sortable` (já compatível, leve, acessível).
- **Painéis laterais**: `Sheet` do shadcn (já presente).
- **Cmd+K**: `Command` + `CommandDialog` do shadcn (já presente).
- **Skeletons**: `Skeleton` do shadcn (já presente).
- **Atalhos teclado**: hook `useHotkeys` simples próprio (sem nova dep).
- **Breadcrumbs**: componente novo `PageHeader` reutilizável.
- **Confirmação undo**: queryClient + toast.action do sonner (5s para desfazer antes do delete real).

## Ordem sugerida de entrega

1. **Sistema / global** primeiro (skeletons, AlertDialog, PageHeader, Cmd+K) — base para o resto.
2. CRM (maior impacto visual).
3. Checagem.
4. Lançamentos.
5. Calendário.
6. Home.

Posso entregar tudo de uma vez (será um diff grande) ou pausar entre blocos para você revisar. Recomendo entregar **Sistema + CRM** primeiro, validar o padrão, depois aplicar nos demais.

## Fora de escopo

- Não vou alterar lógica de negócio, schema do banco, RLS, ou edge functions.
- Não vou trocar libs (TanStack Query, Tailwind, shadcn permanecem).
- Não vou adicionar autenticação Cmd+K em rotas protegidas (já protegidas pelo guard).