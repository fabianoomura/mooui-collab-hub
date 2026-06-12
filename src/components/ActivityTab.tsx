import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock } from 'lucide-react';
import { useActivityLog } from '@/hooks/useActivityLog';

interface ActivityTabProps {
  entityType: string;
  entityId: string | undefined;
}

function formatAction(entry: { action: string; payload: Record<string, any> }): string {
  const { action, payload } = entry;
  const from = payload?.from_value ?? payload?.from ?? '';
  const to = payload?.to_value ?? payload?.to ?? '';

  if (action === 'created') return 'criou o item';
  if (action === 'status') return `alterou status: ${from} → ${to}`;

  if (from || to) return `${action}: ${from || '-'} → ${to || '-'}`;
  return action;
}

export default function ActivityTab({ entityType, entityId }: ActivityTabProps) {
  const { data: activity = [], isLoading } = useActivityLog(entityType, entityId);

  if (isLoading) return <p className="text-xs text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-2">
      {activity.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma atividade.</p>}
      {activity.map((a) => (
        <div key={a.id} className="flex items-start gap-2 text-xs">
          <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <span className="font-medium">{a.actor?.full_name || 'Sistema'}</span>
            <span> {formatAction(a)}</span>
            <span className="text-muted-foreground ml-2">
              {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: ptBR })}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
