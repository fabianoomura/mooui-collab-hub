import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { usePermissions } from '@/hooks/usePermissions';
import {
  CheckCircle2, Rocket, Package, Briefcase, LayoutDashboard, Activity,
  Wrench, FileText, ShoppingBag,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function weekLabel(weeksAgo: number): string {
  if (weeksAgo === 0) return 'Esta semana';
  if (weeksAgo === 1) return 'Semana passada';
  return `${weeksAgo} semanas`;
}

type SectorHealth = {
  sector: string;
  modules: { name: string; openCount: number; avgHours: number }[];
};

function healthDot(avgHours: number) {
  if (avgHours < 24) return 'bg-emerald-500';
  if (avgHours < 72) return 'bg-yellow-500';
  return 'bg-red-500';
}

export function ExecutivePanel() {
  const { currentOrg } = useOrganization();
  const { canDo } = usePermissions();
  const orgId = currentOrg?.id;

  const { data } = useQuery({
    queryKey: ['executive-dashboard', orgId],
    queryFn: async () => {
      if (!orgId) return null;
      const thirtyDaysAgo = daysAgo(30);

      // --- Summary cards ---
      const [tasksDone, activeLaunches, ordersClosed, ticketsResolved] = await Promise.all([
        supabase.from('tasks').select('id', { count: 'exact', head: true })
          .eq('status', 'done').gte('updated_at', thirtyDaysAgo),
        supabase.from('launches').select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId).eq('status', 'active'),
        supabase.from('orders' as any).select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId).gte('closed_at', thirtyDaysAgo),
        supabase.from('tickets').select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId).gte('resolved_at', thirtyDaysAgo),
      ]);

      // --- Weekly tasks for bar chart (last 4 weeks) ---
      const weeklyTasks: { name: string; concluidas: number }[] = [];
      for (let w = 3; w >= 0; w--) {
        const start = daysAgo((w + 1) * 7);
        const end = daysAgo(w * 7);
        const { count } = await supabase
          .from('tasks').select('id', { count: 'exact', head: true })
          .eq('status', 'done').gte('updated_at', start).lt('updated_at', end);
        weeklyTasks.push({ name: weekLabel(w), concluidas: count ?? 0 });
      }

      // --- Module health ---
      // Pedidos
      const { count: openOrders } = await supabase
        .from('orders' as any).select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId).is('closed_at', null);

      const { data: closedOrdersData } = await supabase
        .from('orders' as any).select('created_at, closed_at')
        .eq('organization_id', orgId)
        .not('closed_at', 'is', null)
        .gte('closed_at', thirtyDaysAgo);

      let avgOrderHours = 0;
      if (closedOrdersData?.length) {
        const totalMs = closedOrdersData.reduce((sum: number, o: any) => {
          return sum + (new Date(o.closed_at).getTime() - new Date(o.created_at).getTime());
        }, 0);
        avgOrderHours = Math.round(totalMs / closedOrdersData.length / 3600000);
      }

      // Tickets
      const { count: openTickets } = await supabase
        .from('tickets').select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId).in('status', ['open', 'in_progress']);

      const { data: resolvedTicketsData } = await supabase
        .from('tickets').select('created_at, resolved_at')
        .eq('organization_id', orgId)
        .not('resolved_at', 'is', null)
        .gte('resolved_at', thirtyDaysAgo);

      let avgTicketHours = 0;
      if (resolvedTicketsData?.length) {
        const totalMs = resolvedTicketsData.reduce((sum, t) => {
          return sum + (new Date(t.resolved_at!).getTime() - new Date(t.created_at).getTime());
        }, 0);
        avgTicketHours = Math.round(totalMs / resolvedTicketsData.length / 3600000);
      }

      // Tarefas
      const { count: openTasks } = await supabase
        .from('tasks').select('id', { count: 'exact', head: true })
        .neq('status', 'done');

      const { data: doneTasks } = await supabase
        .from('tasks').select('created_at, updated_at')
        .eq('status', 'done')
        .gte('updated_at', thirtyDaysAgo);

      let avgTaskHours = 0;
      if (doneTasks?.length) {
        const totalMs = doneTasks.reduce((sum, t) => {
          return sum + (new Date(t.updated_at).getTime() - new Date(t.created_at).getTime());
        }, 0);
        avgTaskHours = Math.round(totalMs / doneTasks.length / 3600000);
      }

      // Module stats from Sunday boards
      const { data: modProjects } = await supabase
        .from('projects').select('id, name')
        .eq('organization_id', orgId)
        .ilike('name', 'Modulo | %');

      const idsByPrefix = (prefix: string) =>
        (modProjects || []).filter((p) => p.name.toLowerCase().includes(prefix.toLowerCase())).map((p) => p.id);

      const countActiveModule = async (ids: string[]) => {
        if (!ids.length) return 0;
        const { count } = await supabase.from('tasks').select('id', { count: 'exact', head: true })
          .in('project_id', ids).is('archived_at', null).is('parent_task_id', null).neq('status', 'done');
        return count ?? 0;
      };

      // Module counts per prefix
      const modulePrefixes = [
        { prefix: 'Melhorias', name: 'Melhorias', sector: 'Site & TI' },
        { prefix: 'Programacao', name: 'Programacao', sector: 'Marketing' },
        { prefix: 'Newsletters', name: 'Newsletters', sector: 'Marketing' },
        { prefix: 'Demandas', name: 'Demandas', sector: 'Marketing' },
        { prefix: 'Sessoes', name: 'Sessoes', sector: 'Estudio' },
        { prefix: 'Produtos', name: 'Produtos', sector: 'Produto' },
      ];

      const moduleCounts = await Promise.all(
        modulePrefixes.map(async (m) => {
          const ids = idsByPrefix(m.prefix);
          const openCount = await countActiveModule(ids);
          let avgHours = 0;
          if (ids.length && m.prefix === 'Melhorias') {
            const { data: doneTasks } = await supabase
              .from('tasks').select('created_at, updated_at')
              .in('project_id', ids).is('parent_task_id', null)
              .eq('status', 'done').gte('updated_at', thirtyDaysAgo);
            if (doneTasks?.length) {
              const totalMs = doneTasks.reduce((sum, t) =>
                sum + (new Date(t.updated_at).getTime() - new Date(t.created_at).getTime()), 0);
              avgHours = Math.round(totalMs / doneTasks.length / 3600000);
            }
          }
          return { ...m, openCount, avgHours };
        }),
      );

      // Group by sector
      const sectorMap = new Map<string, SectorHealth>();

      // Specialized modules first
      const addToSector = (sector: string, name: string, openCount: number, avgHours: number) => {
        if (!sectorMap.has(sector)) sectorMap.set(sector, { sector, modules: [] });
        sectorMap.get(sector)!.modules.push({ name, openCount, avgHours });
      };

      addToSector('Geral', 'Tarefas', openTasks ?? 0, avgTaskHours);
      addToSector('SAC & Expedicao', 'Pedidos', openOrders ?? 0, avgOrderHours);
      addToSector('Site & TI', 'Tickets', openTickets ?? 0, avgTicketHours);
      for (const mc of moduleCounts) {
        addToSector(mc.sector, mc.name, mc.openCount, mc.avgHours);
      }

      const sectors = [...sectorMap.values()];

      return {
        tasksDone: tasksDone.count ?? 0,
        activeLaunches: activeLaunches.count ?? 0,
        ordersClosed: ordersClosed.count ?? 0,
        ticketsResolved: ticketsResolved.count ?? 0,
        weeklyTasks,
        sectors,
      };
    },
    enabled: !!orgId && canDo('view_reports'),
    staleTime: 300_000,
  });

  if (!canDo('view_reports') || !data) return null;

  const summaryCards = [
    { label: 'Total de tarefas concluidas', value: data.tasksDone, icon: CheckCircle2, iconColor: 'text-emerald-600' },
    { label: 'Lancamentos ativos', value: data.activeLaunches, icon: Rocket, iconColor: 'text-rose-600' },
    { label: 'Pedidos resolvidos', value: data.ordersClosed, icon: Package, iconColor: 'text-amber-600' },
    { label: 'Tickets resolvidos', value: data.ticketsResolved, icon: Briefcase, iconColor: 'text-indigo-600' },
  ];

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-5">
        <LayoutDashboard className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold uppercase tracking-wide">Painel Executivo</h2>
        <span className="text-[10px] text-muted-foreground ml-auto">Ultimos 30 dias</span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {summaryCards.map((c) => (
          <div key={c.label} className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <c.icon className={`h-4 w-4 ${c.iconColor}`} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] uppercase text-muted-foreground tracking-wide leading-tight">{c.label}</p>
              <span className="text-lg font-bold">{c.value}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Weekly productivity chart */}
      <div className="mb-6">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide mb-3">
          Produtividade semanal
        </h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.weeklyTasks} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} className="text-muted-foreground" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} className="text-muted-foreground" />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))' }}
                labelStyle={{ fontWeight: 600 }}
              />
              <Bar dataKey="concluidas" name="Concluidas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Sector health */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Activity className="h-3.5 w-3.5 text-muted-foreground" />
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Saude por setor
          </h3>
        </div>
        <div className="space-y-4">
          {data.sectors.map((sec) => (
            <div key={sec.sector}>
              <p className="text-[11px] font-semibold uppercase text-muted-foreground tracking-wide mb-1.5 px-1">{sec.sector}</p>
              <div className="space-y-1">
                {sec.modules.map((mod) => (
                  <div key={mod.name} className="grid grid-cols-4 gap-2 items-center bg-muted/40 rounded-lg px-3 py-2 text-sm">
                    <span className="font-medium">{mod.name}</span>
                    <span className="text-center">{mod.openCount}</span>
                    <span className="text-center text-muted-foreground">
                      {mod.avgHours > 0 ? `${mod.avgHours}h` : '--'}
                    </span>
                    <div className="flex justify-center">
                      <span className={`h-2.5 w-2.5 rounded-full ${healthDot(mod.avgHours)}`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="grid grid-cols-4 gap-2 text-[10px] uppercase text-muted-foreground tracking-wide px-1">
            <span>Modulo</span>
            <span className="text-center">Abertos</span>
            <span className="text-center">Tempo medio</span>
            <span className="text-center">Status</span>
          </div>
          <div className="flex items-center gap-4 text-[10px] text-muted-foreground px-1">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> {'< 24h'}</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-yellow-500" /> {'< 72h'}</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> {'> 72h'}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
