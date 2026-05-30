import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { BarChart3, Clock, Briefcase, CheckCircle2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

const categoryLabels: Record<string, string> = {
  bug: 'Bug',
  duvida: 'Dúvida',
  solicitacao: 'Solicitação',
  outro: 'Outro',
};

const priorityLabels: Record<string, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  urgent: 'Urgente',
};

export function TicketsReport() {
  const { currentOrg } = useOrganization();

  const { data } = useQuery({
    queryKey: ['tickets-report', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return null;
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

      const { data: tickets } = await supabase
        .from('tickets')
        .select('id, status, priority, category, created_at, resolved_at')
        .eq('organization_id', currentOrg.id)
        .gte('created_at', thirtyDaysAgo);

      if (!tickets?.length) return { total: 0, byCategory: [], byPriority: [], avgHours: 0, openCount: 0, resolvedCount: 0 };

      const total = tickets.length;
      const resolved = tickets.filter(t => t.resolved_at);
      const open = tickets.filter(t => !t.resolved_at && t.status !== 'closed');

      let avgHours = 0;
      if (resolved.length) {
        const totalMs = resolved.reduce((sum, t) =>
          sum + (new Date(t.resolved_at!).getTime() - new Date(t.created_at).getTime()), 0);
        avgHours = Math.round(totalMs / resolved.length / 3600000);
      }

      const catMap = new Map<string, number>();
      tickets.forEach(t => { catMap.set(t.category || 'outro', (catMap.get(t.category || 'outro') || 0) + 1); });
      const byCategory = Array.from(catMap.entries())
        .map(([cat, count]) => ({ cat, label: categoryLabels[cat] || cat, count }))
        .sort((a, b) => b.count - a.count);

      const priMap = new Map<string, number>();
      tickets.forEach(t => { priMap.set(t.priority, (priMap.get(t.priority) || 0) + 1); });
      const byPriority = Array.from(priMap.entries())
        .map(([pri, count]) => ({ pri, label: priorityLabels[pri] || pri, count }))
        .sort((a, b) => b.count - a.count);

      return { total, byCategory, byPriority, avgHours, openCount: open.length, resolvedCount: resolved.length };
    },
    enabled: !!currentOrg,
    staleTime: 300_000,
  });

  if (!data || data.total === 0) return (
    <Card className="p-6 text-center text-sm text-muted-foreground">
      Sem dados de tickets nos últimos 30 dias.
    </Card>
  );

  const maxCat = Math.max(...data.byCategory.map(c => c.count), 1);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <Card className="p-4 flex items-center gap-3">
          <Briefcase className="h-5 w-5 text-primary" />
          <div>
            <p className="text-2xl font-bold">{data.total}</p>
            <p className="text-xs text-muted-foreground">Total (30 dias)</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <BarChart3 className="h-5 w-5 text-amber-600" />
          <div>
            <p className="text-2xl font-bold">{data.openCount}</p>
            <p className="text-xs text-muted-foreground">Em aberto</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <div>
            <p className="text-2xl font-bold">{data.resolvedCount}</p>
            <p className="text-xs text-muted-foreground">Resolvidos</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <Clock className="h-5 w-5 text-indigo-600" />
          <div>
            <p className="text-2xl font-bold">{data.avgHours}h</p>
            <p className="text-xs text-muted-foreground">Tempo médio</p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">Por categoria</h3>
          <div className="space-y-2">
            {data.byCategory.map(c => (
              <div key={c.cat} className="flex items-center gap-2">
                <span className="text-xs w-24 truncate text-muted-foreground">{c.label}</span>
                <Progress value={(c.count / maxCat) * 100} className="flex-1 h-2" />
                <span className="text-xs font-medium w-6 text-right">{c.count}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">Por prioridade</h3>
          <div className="space-y-2">
            {data.byPriority.map(p => (
              <div key={p.pri} className="flex items-center gap-2">
                <span className="text-xs w-24 truncate text-muted-foreground">{p.label}</span>
                <Progress value={(p.count / data.total) * 100} className="flex-1 h-2" />
                <span className="text-xs font-medium w-6 text-right">{p.count}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
