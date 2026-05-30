import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { usePermissions } from '@/hooks/usePermissions';
import { TrendingUp, TrendingDown, CheckCircle2, Clock, Package, Briefcase, BarChart3 } from 'lucide-react';

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

export function KPIPanel() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const { canDo } = usePermissions();

  const { data } = useQuery({
    queryKey: ['kpi-panel', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return null;
      const now = new Date().toISOString();
      const week = daysAgo(7);
      const prevWeek = daysAgo(14);

      // Tasks completed this week vs last week
      const [tasksDoneThisWeek, tasksDoneLastWeek] = await Promise.all([
        supabase.from('tasks').select('id', { count: 'exact', head: true })
          .eq('status', 'done').gte('updated_at', week),
        supabase.from('tasks').select('id', { count: 'exact', head: true })
          .eq('status', 'done').gte('updated_at', prevWeek).lt('updated_at', week),
      ]);

      // Orders this week
      const [ordersCreated, ordersClosed] = await Promise.all([
        supabase.from('orders').select('id', { count: 'exact', head: true })
          .eq('organization_id', currentOrg.id).gte('created_at', week),
        supabase.from('orders').select('id', { count: 'exact', head: true })
          .eq('organization_id', currentOrg.id).gte('closed_at', week),
      ]);

      // Tickets this week
      const [ticketsCreated, ticketsResolved] = await Promise.all([
        supabase.from('tickets').select('id', { count: 'exact', head: true })
          .eq('organization_id', currentOrg.id).gte('created_at', week),
        supabase.from('tickets').select('id', { count: 'exact', head: true })
          .eq('organization_id', currentOrg.id).gte('resolved_at', week),
      ]);

      // Avg resolution time for orders closed this week
      const { data: closedOrders } = await supabase
        .from('orders').select('created_at, closed_at')
        .eq('organization_id', currentOrg.id)
        .not('closed_at', 'is', null)
        .gte('closed_at', week);

      let avgOrderHours = 0;
      if (closedOrders?.length) {
        const totalMs = closedOrders.reduce((sum, o) => {
          return sum + (new Date(o.closed_at!).getTime() - new Date(o.created_at).getTime());
        }, 0);
        avgOrderHours = Math.round(totalMs / closedOrders.length / 3600000);
      }

      // Avg resolution time for tickets resolved this week
      const { data: resolvedTickets } = await supabase
        .from('tickets').select('created_at, resolved_at')
        .eq('organization_id', currentOrg.id)
        .not('resolved_at', 'is', null)
        .gte('resolved_at', week);

      let avgTicketHours = 0;
      if (resolvedTickets?.length) {
        const totalMs = resolvedTickets.reduce((sum, t) => {
          return sum + (new Date(t.resolved_at!).getTime() - new Date(t.created_at).getTime());
        }, 0);
        avgTicketHours = Math.round(totalMs / resolvedTickets.length / 3600000);
      }

      const doneThis = tasksDoneThisWeek.count ?? 0;
      const doneLast = tasksDoneLastWeek.count ?? 0;
      const taskTrend = doneLast > 0 ? Math.round(((doneThis - doneLast) / doneLast) * 100) : 0;

      return {
        tasksDone: doneThis,
        taskTrend,
        ordersCreated: ordersCreated.count ?? 0,
        ordersClosed: ordersClosed.count ?? 0,
        avgOrderHours,
        ticketsCreated: ticketsCreated.count ?? 0,
        ticketsResolved: ticketsResolved.count ?? 0,
        avgTicketHours,
      };
    },
    enabled: !!currentOrg && canDo('view_reports'),
    staleTime: 300_000,
  });

  if (!canDo('view_reports') || !data) return null;

  const kpis = [
    {
      label: 'Tarefas concluídas',
      value: data.tasksDone,
      suffix: 'esta semana',
      trend: data.taskTrend,
      icon: CheckCircle2,
      iconColor: 'text-emerald-600',
    },
    {
      label: 'Pedidos',
      value: `${data.ordersClosed}/${data.ordersCreated}`,
      suffix: 'fechados/abertos',
      extra: data.avgOrderHours > 0 ? `~${data.avgOrderHours}h resolução` : undefined,
      icon: Package,
      iconColor: 'text-amber-600',
    },
    {
      label: 'Tickets',
      value: `${data.ticketsResolved}/${data.ticketsCreated}`,
      suffix: 'resolvidos/abertos',
      extra: data.avgTicketHours > 0 ? `~${data.avgTicketHours}h resolução` : undefined,
      icon: Briefcase,
      iconColor: 'text-indigo-600',
    },
  ];

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold uppercase tracking-wide">KPIs da Semana</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="flex items-start gap-3">
            <div className={`h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0`}>
              <kpi.icon className={`h-4 w-4 ${kpi.iconColor}`} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] uppercase text-muted-foreground tracking-wide">{kpi.label}</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-bold">{kpi.value}</span>
                {kpi.trend !== undefined && kpi.trend !== 0 && (
                  <span className={`text-xs font-medium flex items-center gap-0.5 ${kpi.trend > 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                    {kpi.trend > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {kpi.trend > 0 ? '+' : ''}{kpi.trend}%
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{kpi.suffix}</p>
              {kpi.extra && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Clock className="h-3 w-3" /> {kpi.extra}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
