import { useMemo, useState } from 'react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAnnualEvents } from '@/hooks/useAnnualEvents';
import { useLaunches, useLaunchStages } from '@/hooks/useLaunches';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Layers, Calendar, Rocket, CheckSquare, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type TimelineItem = {
  id: string;
  title: string;
  start: string;
  end: string | null;
  type: 'event' | 'launch' | 'task';
  color: string;
  meta?: string;
};

const TYPE_COLORS: Record<string, string> = {
  event: '#3b82f6',
  launch: '#a855f7',
  task: '#10b981',
};

const TYPE_LABELS: Record<string, string> = {
  event: 'Evento',
  launch: 'Lançamento',
  task: 'Tarefa',
};

const MONTHS = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
];

export default function TimelinePage() {
  const { currentOrg } = useOrganization();
  const { user } = useAuth();
  const [year, setYear] = useState(new Date().getFullYear());
  const [filter, setFilter] = useState<'all' | 'event' | 'launch' | 'task'>('all');

  const { data: events = [] } = useAnnualEvents(year);
  const { data: launches = [] } = useLaunches();

  // Tasks with due_date in this year
  const { data: tasks = [] } = useQuery({
    queryKey: ['timeline-tasks', currentOrg?.id, year],
    queryFn: async () => {
      if (!currentOrg) return [];
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, due_date, start_date, status, priority')
        .gte('due_date', `${year}-01-01`)
        .lte('due_date', `${year}-12-31`)
        .neq('status', 'done');
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentOrg,
  });

  const items = useMemo(() => {
    const result: TimelineItem[] = [];

    if (filter === 'all' || filter === 'event') {
      events.forEach(e => {
        result.push({
          id: `evt-${e.id}`,
          title: e.title,
          start: e.start_date,
          end: e.end_date,
          type: 'event',
          color: e.color || TYPE_COLORS.event,
          meta: e.category,
        });
      });
    }

    if (filter === 'all' || filter === 'launch') {
      launches
        .filter(l => l.start_date.startsWith(String(year)))
        .forEach(l => {
          result.push({
            id: `launch-${l.id}`,
            title: l.name,
            start: l.start_date,
            end: null,
            type: 'launch',
            color: TYPE_COLORS.launch,
            meta: l.status,
          });
        });
    }

    if (filter === 'all' || filter === 'task') {
      tasks.forEach(t => {
        result.push({
          id: `task-${t.id}`,
          title: t.title,
          start: t.start_date || t.due_date!,
          end: t.start_date ? t.due_date : null,
          type: 'task',
          color: TYPE_COLORS.task,
          meta: t.priority,
        });
      });
    }

    return result.sort((a, b) => a.start.localeCompare(b.start));
  }, [events, launches, tasks, filter, year]);

  // Group by month
  const byMonth = useMemo(() => {
    const map = new Map<number, TimelineItem[]>();
    for (let m = 0; m < 12; m++) map.set(m, []);
    items.forEach(item => {
      const month = new Date(item.start + 'T00:00:00').getMonth();
      map.get(month)?.push(item);
    });
    return map;
  }, [items]);

  const today = new Date().toISOString().split('T')[0];
  const currentMonth = new Date().getMonth();

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Layers className="h-6 w-6 text-primary" />
            Timeline
          </h1>
          <p className="text-sm text-muted-foreground">Visão unificada de eventos, lançamentos e tarefas</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setYear(y => y - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold w-12 text-center">{year}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setYear(y => y + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Select value={filter} onValueChange={v => setFilter(v as any)}>
            <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="event">Eventos</SelectItem>
              <SelectItem value="launch">Lançamentos</SelectItem>
              <SelectItem value="task">Tarefas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary badges */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="gap-1 text-xs">
          <Calendar className="h-3 w-3" style={{ color: TYPE_COLORS.event }} />
          {items.filter(i => i.type === 'event').length} eventos
        </Badge>
        <Badge variant="outline" className="gap-1 text-xs">
          <Rocket className="h-3 w-3" style={{ color: TYPE_COLORS.launch }} />
          {items.filter(i => i.type === 'launch').length} lançamentos
        </Badge>
        <Badge variant="outline" className="gap-1 text-xs">
          <CheckSquare className="h-3 w-3" style={{ color: TYPE_COLORS.task }} />
          {items.filter(i => i.type === 'task').length} tarefas
        </Badge>
      </div>

      {/* Month grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 12 }, (_, m) => {
          const monthItems = byMonth.get(m) || [];
          const isCurrent = year === new Date().getFullYear() && m === currentMonth;
          return (
            <Card
              key={m}
              className={cn(
                'p-3 min-h-[120px]',
                isCurrent && 'ring-2 ring-primary/40',
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className={cn('text-sm font-semibold', isCurrent && 'text-primary')}>
                  {MONTHS[m]}
                </h3>
                {monthItems.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] h-5">{monthItems.length}</Badge>
                )}
              </div>
              {monthItems.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">—</p>
              ) : (
                <div className="space-y-1.5">
                  {monthItems.map(item => (
                    <div
                      key={item.id}
                      className="flex items-start gap-2 p-1.5 rounded hover:bg-muted/50 transition-colors"
                    >
                      <div
                        className="h-2.5 w-2.5 rounded-full shrink-0 mt-1"
                        style={{ backgroundColor: item.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{item.title}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(item.start + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                          {item.end && ` → ${new Date(item.end + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`}
                          {' · '}
                          {TYPE_LABELS[item.type]}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {items.length === 0 && (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          Nenhum item encontrado para {year}.
        </Card>
      )}
    </div>
  );
}
