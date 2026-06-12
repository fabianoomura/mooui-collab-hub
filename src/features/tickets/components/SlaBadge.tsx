import { useMemo } from 'react';
import { AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useSlaConfig, computeSla } from '../hooks/useTicketSla';
import type { Ticket } from '../hooks/useTickets';

export function SlaBadge({ ticket, compact = false }: { ticket: Ticket; compact?: boolean }) {
  const { map } = useSlaConfig();
  const sla = useMemo(
    () => computeSla(ticket.created_at, ticket.resolved_at, ticket.status, ticket.priority, map),
    [ticket.created_at, ticket.resolved_at, ticket.status, ticket.priority, map],
  );

  if (sla.state === 'done') {
    if (compact) return null;
    return (
      <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground gap-1">
        <CheckCircle2 className="h-3 w-3" /> SLA cumprido
      </Badge>
    );
  }

  const cls =
    sla.state === 'breached'
      ? 'bg-destructive/15 text-destructive border-destructive/30'
      : sla.state === 'warn'
      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
      : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';

  const Icon = sla.state === 'breached' ? AlertTriangle : Clock;
  const label =
    sla.state === 'breached'
      ? `SLA estourado ${formatDistanceToNow(sla.due, { locale: ptBR })}`
      : `vence ${formatDistanceToNow(sla.due, { locale: ptBR, addSuffix: true })}`;

  return (
    <Badge variant="outline" className={cn('text-[10px] gap-1', cls, compact && 'px-1.5 py-0 h-4 text-[9px]')}>
      <Icon className={cn(compact ? 'h-2.5 w-2.5' : 'h-3 w-3')} />
      {compact ? (sla.state === 'breached' ? 'SLA!' : 'SLA') : label}
    </Badge>
  );
}

export function useSlaBreached() {
  const { map } = useSlaConfig();
  return (ticket: Ticket) =>
    computeSla(ticket.created_at, ticket.resolved_at, ticket.status, ticket.priority, map).state === 'breached';
}
