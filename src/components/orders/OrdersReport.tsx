import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { BarChart3, Clock, TrendingUp, Package } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

const problemLabels: Record<string, string> = {
  furo_estoque: 'Furo de Estoque',
  aguardando_itens: 'Aguardando Itens',
  aguardar_envio: 'Aguardar Envio',
  presente: 'Presente',
  troca: 'Troca',
  devolucao: 'Devolução',
  endereco: 'Endereço',
  outro: 'Outro',
};

const sourceLabels: Record<string, string> = {
  expedicao: 'Expedição',
  atendimento: 'Atendimento',
  marketing: 'Marketing',
  outro: 'Outro',
};

export function OrdersReport() {
  const { currentOrg } = useOrganization();

  const { data } = useQuery({
    queryKey: ['orders-report', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return null;
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

      const { data: orders } = await supabase
        .from('orders')
        .select('id, status, priority, problem_type, source, created_at, closed_at, updated_at')
        .eq('organization_id', currentOrg.id)
        .gte('created_at', thirtyDaysAgo);

      if (!orders?.length) return { total: 0, byType: [], bySource: [], avgHours: 0, openCount: 0, closedCount: 0 };

      const total = orders.length;
      const closed = orders.filter(o => o.closed_at);
      const open = orders.filter(o => !o.closed_at && o.status !== 'cancelled');

      // Avg resolution time
      let avgHours = 0;
      if (closed.length) {
        const totalMs = closed.reduce((sum, o) =>
          sum + (new Date(o.closed_at!).getTime() - new Date(o.created_at).getTime()), 0);
        avgHours = Math.round(totalMs / closed.length / 3600000);
      }

      // By problem type
      const typeMap = new Map<string, number>();
      orders.forEach(o => { typeMap.set(o.problem_type || 'outro', (typeMap.get(o.problem_type || 'outro') || 0) + 1); });
      const byType = Array.from(typeMap.entries())
        .map(([type, count]) => ({ type, label: problemLabels[type] || type, count }))
        .sort((a, b) => b.count - a.count);

      // By source
      const srcMap = new Map<string, number>();
      orders.forEach(o => { srcMap.set(o.source || 'outro', (srcMap.get(o.source || 'outro') || 0) + 1); });
      const bySource = Array.from(srcMap.entries())
        .map(([source, count]) => ({ source, label: sourceLabels[source] || source, count }))
        .sort((a, b) => b.count - a.count);

      return { total, byType, bySource, avgHours, openCount: open.length, closedCount: closed.length };
    },
    enabled: !!currentOrg,
    staleTime: 300_000,
  });

  if (!data || data.total === 0) return (
    <Card className="p-6 text-center text-sm text-muted-foreground">
      Sem dados de pedidos nos últimos 30 dias.
    </Card>
  );

  const maxType = Math.max(...data.byType.map(t => t.count), 1);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <Card className="p-4 flex items-center gap-3">
          <Package className="h-5 w-5 text-primary" />
          <div>
            <p className="text-2xl font-bold">{data.total}</p>
            <p className="text-xs text-muted-foreground">Total (30 dias)</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <TrendingUp className="h-5 w-5 text-amber-600" />
          <div>
            <p className="text-2xl font-bold">{data.openCount}</p>
            <p className="text-xs text-muted-foreground">Em aberto</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <BarChart3 className="h-5 w-5 text-emerald-600" />
          <div>
            <p className="text-2xl font-bold">{data.closedCount}</p>
            <p className="text-xs text-muted-foreground">Fechados</p>
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
          <h3 className="text-sm font-semibold mb-3">Por tipo de problema</h3>
          <div className="space-y-2">
            {data.byType.map(t => (
              <div key={t.type} className="flex items-center gap-2">
                <span className="text-xs w-28 truncate text-muted-foreground">{t.label}</span>
                <Progress value={(t.count / maxType) * 100} className="flex-1 h-2" />
                <span className="text-xs font-medium w-6 text-right">{t.count}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">Por fonte</h3>
          <div className="space-y-2">
            {data.bySource.map(s => (
              <div key={s.source} className="flex items-center gap-2">
                <span className="text-xs w-28 truncate text-muted-foreground">{s.label}</span>
                <Progress value={(s.count / data.total) * 100} className="flex-1 h-2" />
                <span className="text-xs font-medium w-6 text-right">{s.count}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
