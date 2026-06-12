import { Link2, Trash2, Calendar, Rocket, ClipboardCheck, ListTodo, BookOpen, Package, LifeBuoy } from 'lucide-react';
import { useLinksFrom, useDeleteLink, type ModuleLink } from '@/hooks/useModuleLinks';
import { cn } from '@/lib/utils';

const MODULE_META: Record<string, { icon: typeof Link2; label: string; color: string; route: string }> = {
  task:      { icon: ListTodo,       label: 'Tarefa',      color: 'text-blue-500',   route: '/projetos' },
  calendar:  { icon: Calendar,       label: 'Evento',      color: 'text-amber-500',  route: '/calendario' },
  launch:    { icon: Rocket,         label: 'Lançamento',  color: 'text-purple-500', route: '/lancamentos' },
  checklist: { icon: ClipboardCheck, label: 'Checklist',   color: 'text-green-500',  route: '/checagens' },
  doc:       { icon: BookOpen,       label: 'Documento',   color: 'text-teal-500',   route: '/docs' },
  order:     { icon: Package,        label: 'Pedido',      color: 'text-emerald-500', route: '/pedidos' },
  ticket:    { icon: LifeBuoy,       label: 'Ticket',      color: 'text-red-500',     route: '/tickets' },
  melhoria:  { icon: Link2,          label: 'Melhoria',    color: 'text-cyan-500',    route: '/melhorias' },
  conteudo:  { icon: Link2,          label: 'Programacao', color: 'text-pink-500',    route: '/programacao' },
  sessao:    { icon: Link2,          label: 'Sessão',      color: 'text-violet-500',  route: '/sessoes' },
  produto:   { icon: Link2,          label: 'Produto',     color: 'text-orange-500',  route: '/produtos' },
};

function meta(type: string) {
  return MODULE_META[type] ?? { icon: Link2, label: type, color: 'text-muted-foreground', route: '/' };
}

/** Compact list of cross-module links from a given source entity. */
export function LinkedItems({
  sourceType,
  sourceId,
  className,
}: {
  sourceType: string;
  sourceId: string | undefined;
  className?: string;
}) {
  const { data: links = [] } = useLinksFrom(sourceType, sourceId);
  const deleteMut = useDeleteLink();

  if (links.length === 0) return null;

  return (
    <div className={cn('space-y-1', className)}>
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <Link2 className="h-3 w-3" /> Vínculos
      </p>
      <ul className="space-y-1">
        {links.map((l: ModuleLink) => {
          const m = meta(l.target_type);
          const Icon = m.icon;
          return (
            <li key={l.id} className="flex items-center gap-2 group text-sm">
              <Icon className={cn('h-3.5 w-3.5 shrink-0', m.color)} />
              <span className="truncate">{m.label}</span>
              <button
                onClick={() => deleteMut.mutate(l.id)}
                className="ml-auto opacity-0 group-hover:opacity-100 p-0.5 hover:text-destructive transition-opacity"
                aria-label="Remover vínculo"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
