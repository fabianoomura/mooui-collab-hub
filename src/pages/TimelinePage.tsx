import { useMemo, useState } from 'react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAnnualEvents } from '@/hooks/useAnnualEvents';
import { useLaunches } from '@/hooks/useLaunches';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Calendar, Camera, CheckSquare, ChevronLeft, ChevronRight, FileText,
  Globe, Layers, Package, Rocket,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type TimelineType = 'event' | 'launch' | 'task' | 'melhoria' | 'conteudo' | 'sessao' | 'produto';

type TimelineItem = {
  id: string;
  title: string;
  start: string;
  end: string | null;
  type: TimelineType;
  color: string;
  meta?: string;
  sourceDetail?: string;
};

const TYPE_COLORS: Record<TimelineType, string> = {
  event: '#3b82f6',
  launch: '#a855f7',
  task: '#10b981',
  melhoria: '#06b6d4',
  conteudo: '#ec4899',
  sessao: '#8b5cf6',
  produto: '#f97316',
};

const TYPE_LABELS: Record<TimelineType, string> = {
  event: 'Evento',
  launch: 'Lancamento',
  task: 'Tarefa',
  melhoria: 'Melhoria',
  conteudo: 'Conteudo',
  sessao: 'Sessao',
  produto: 'Produto',
};

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const WEEKDAYS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];

export default function TimelinePage() {
  const { currentOrg } = useOrganization();
  const [year, setYear] = useState(new Date().getFullYear());
  const [filter, setFilter] = useState<'all' | TimelineType>('all');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());

  const { data: events = [] } = useAnnualEvents(year);
  const { data: launches = [] } = useLaunches();

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

  const { data: melhorias = [] } = useQuery({
    queryKey: ['timeline-melhorias', currentOrg?.id, year],
    queryFn: async () => {
      if (!currentOrg) return [];
      const { data, error } = await supabase
        .from('melhorias' as any)
        .select('id, title, area, status, data_abertura, data_conclusao, created_at')
        .eq('organization_id', currentOrg.id)
        .gte('data_abertura', `${year}-01-01`)
        .lte('data_abertura', `${year}-12-31`);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentOrg,
  });

  const { data: conteudos = [] } = useQuery({
    queryKey: ['timeline-conteudo', currentOrg?.id, year],
    queryFn: async () => {
      if (!currentOrg) return [];
      const { data, error } = await supabase
        .from('conteudo_items' as any)
        .select('id, title, channel, status, scheduled_date, content_type')
        .eq('organization_id', currentOrg.id)
        .gte('scheduled_date', `${year}-01-01`)
        .lte('scheduled_date', `${year}-12-31`);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentOrg,
  });

  const { data: sessoes = [] } = useQuery({
    queryKey: ['timeline-sessoes', currentOrg?.id, year],
    queryFn: async () => {
      if (!currentOrg) return [];
      const { data, error } = await supabase
        .from('sessoes' as any)
        .select('id, title, status, scheduled_date, professional')
        .eq('organization_id', currentOrg.id)
        .gte('scheduled_date', `${year}-01-01`)
        .lte('scheduled_date', `${year}-12-31`);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentOrg,
  });

  const { data: produtos = [] } = useQuery({
    queryKey: ['timeline-produtos', currentOrg?.id, year],
    queryFn: async () => {
      if (!currentOrg) return [];
      const { data, error } = await supabase
        .from('produtos' as any)
        .select('id, name, collection_group, launch_target, cronograma_start, cronograma_end, progress')
        .eq('organization_id', currentOrg.id);
      if (error) throw error;
      return (data || []).filter((p: any) => {
        const start = p.cronograma_start || p.launch_target;
        return start && start >= `${year}-01-01` && start <= `${year}-12-31`;
      });
    },
    enabled: !!currentOrg,
  });

  const items = useMemo(() => {
    const result: TimelineItem[] = [];

    if (filter === 'all' || filter === 'event') {
      events.forEach((e) => {
        result.push({
          id: `evt-${e.id}`,
          title: e.title,
          start: e.start_date,
          end: e.end_date,
          type: 'event',
          color: e.color || TYPE_COLORS.event,
          meta: e.category,
          sourceDetail: e.category,
        });
      });
    }

    if (filter === 'all' || filter === 'launch') {
      launches
        .filter((launch) => launch.start_date.startsWith(String(year)))
        .forEach((launch) => {
          result.push({
            id: `launch-${launch.id}`,
            title: launch.name,
            start: launch.start_date,
            end: null,
            type: 'launch',
            color: TYPE_COLORS.launch,
            meta: launch.status,
            sourceDetail: launch.status,
          });
        });
    }

    if (filter === 'all' || filter === 'task') {
      tasks.forEach((task: any) => {
        if (!task.due_date) return;
        result.push({
          id: `task-${task.id}`,
          title: task.title,
          start: task.start_date || task.due_date,
          end: task.start_date ? task.due_date : null,
          type: 'task',
          color: TYPE_COLORS.task,
          meta: task.priority,
          sourceDetail: task.priority,
        });
      });
    }

    if (filter === 'all' || filter === 'melhoria') {
      melhorias.forEach((melhoria: any) => {
        const start = melhoria.data_abertura || melhoria.created_at?.split('T')[0];
        if (!start) return;
        result.push({
          id: `melhoria-${melhoria.id}`,
          title: melhoria.title,
          start,
          end: melhoria.data_conclusao,
          type: 'melhoria',
          color: TYPE_COLORS.melhoria,
          meta: melhoria.area,
          sourceDetail: melhoria.area,
        });
      });
    }

    if (filter === 'all' || filter === 'conteudo') {
      conteudos.forEach((conteudo: any) => {
        if (!conteudo.scheduled_date) return;
        result.push({
          id: `conteudo-${conteudo.id}`,
          title: conteudo.title,
          start: conteudo.scheduled_date,
          end: null,
          type: 'conteudo',
          color: TYPE_COLORS.conteudo,
          meta: conteudo.channel,
          sourceDetail: [conteudo.channel, conteudo.content_type, conteudo.status].filter(Boolean).join(' / '),
        });
      });
    }

    if (filter === 'all' || filter === 'sessao') {
      sessoes.forEach((sessao: any) => {
        if (!sessao.scheduled_date) return;
        result.push({
          id: `sessao-${sessao.id}`,
          title: sessao.title,
          start: sessao.scheduled_date,
          end: null,
          type: 'sessao',
          color: TYPE_COLORS.sessao,
          meta: sessao.professional || sessao.status,
          sourceDetail: sessao.professional || sessao.status,
        });
      });
    }

    if (filter === 'all' || filter === 'produto') {
      produtos.forEach((produto: any) => {
        const start = produto.cronograma_start || produto.launch_target;
        if (!start) return;
        result.push({
          id: `produto-${produto.id}`,
          title: produto.name,
          start,
          end: produto.cronograma_end || produto.launch_target || null,
          type: 'produto',
          color: TYPE_COLORS.produto,
          meta: `${produto.progress ?? 0}%`,
          sourceDetail: [produto.collection_group, `${produto.progress ?? 0}%`].filter(Boolean).join(' / '),
        });
      });
    }

    return result.sort((a, b) => a.start.localeCompare(b.start));
  }, [events, launches, tasks, melhorias, conteudos, sessoes, produtos, filter, year]);

  const byMonth = useMemo(() => {
    const map = new Map<number, TimelineItem[]>();
    for (let month = 0; month < 12; month++) map.set(month, []);
    items.forEach((item) => {
      const month = new Date(item.start + 'T00:00:00').getMonth();
      map.get(month)?.push(item);
    });
    return map;
  }, [items]);

  const currentMonth = new Date().getMonth();
  const selectedMonthItems = byMonth.get(selectedMonth) || [];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Layers className="h-6 w-6 text-primary" />
            Timeline
          </h1>
          <p className="text-sm text-muted-foreground">Visao unificada de eventos, lancamentos, tarefas e novos modulos.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setYear((value) => value - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold w-12 text-center">{year}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setYear((value) => value + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Select value={filter} onValueChange={(value) => setFilter(value as any)}>
            <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="event">Eventos</SelectItem>
              <SelectItem value="launch">Lancamentos</SelectItem>
              <SelectItem value="task">Tarefas</SelectItem>
              <SelectItem value="melhoria">Melhorias</SelectItem>
              <SelectItem value="conteudo">Conteudo</SelectItem>
              <SelectItem value="sessao">Sessoes</SelectItem>
              <SelectItem value="produto">Produtos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <CountBadge icon={Calendar} type="event" items={items} label="eventos" />
        <CountBadge icon={Rocket} type="launch" items={items} label="lancamentos" />
        <CountBadge icon={CheckSquare} type="task" items={items} label="tarefas" />
        <CountBadge icon={Globe} type="melhoria" items={items} label="melhorias" />
        <CountBadge icon={FileText} type="conteudo" items={items} label="conteudos" />
        <CountBadge icon={Camera} type="sessao" items={items} label="sessoes" />
        <CountBadge icon={Package} type="produto" items={items} label="produtos" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 12 }, (_, month) => {
          const monthItems = byMonth.get(month) || [];
          const isCurrent = year === new Date().getFullYear() && month === currentMonth;
          return (
            <Card
              key={month}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedMonth(month)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setSelectedMonth(month);
                }
              }}
              className={cn(
                'p-3 min-h-[120px] cursor-pointer transition-colors hover:border-primary/40',
                isCurrent && 'ring-2 ring-primary/40',
                selectedMonth === month && 'border-primary bg-primary/5',
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className={cn('text-sm font-semibold', isCurrent && 'text-primary')}>{MONTHS[month]}</h3>
                {monthItems.length > 0 && <Badge variant="secondary" className="text-[10px] h-5">{monthItems.length}</Badge>}
              </div>
              {monthItems.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">-</p>
              ) : (
                <div className="space-y-1.5">
                  {monthItems.map((item) => (
                    <div key={item.id} className="flex items-start gap-2 p-1.5 rounded hover:bg-muted/50 transition-colors">
                      <div className="h-2.5 w-2.5 rounded-full shrink-0 mt-1" style={{ backgroundColor: item.color }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{item.title}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(item.start + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                          {item.end && ` -> ${new Date(item.end + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`}
                          {' · '}
                          {TYPE_LABELS[item.type]}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          Origem: {TYPE_LABELS[item.type]}{item.sourceDetail ? ` - ${item.sourceDetail}` : ''}
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

      <MonthCalendar
        year={year}
        month={selectedMonth}
        items={selectedMonthItems}
        onPrevious={() => setSelectedMonth((value) => (value === 0 ? 11 : value - 1))}
        onNext={() => setSelectedMonth((value) => (value === 11 ? 0 : value + 1))}
      />

      {items.length === 0 && (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          Nenhum item encontrado para {year}.
        </Card>
      )}
    </div>
  );
}

function MonthCalendar({
  year,
  month,
  items,
  onPrevious,
  onNext,
}: {
  year: number;
  month: number;
  items: TimelineItem[];
  onPrevious: () => void;
  onNext: () => void;
}) {
  const days = useMemo(() => {
    const firstDate = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0).getDate();
    const leading = firstDate.getDay();
    const cells: Array<{ key: string; day: number | null; items: TimelineItem[] }> = [];
    for (let index = 0; index < leading; index++) {
      cells.push({ key: `empty-start-${index}`, day: null, items: [] });
    }
    for (let day = 1; day <= lastDay; day++) {
      const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      cells.push({
        key,
        day,
        items: items.filter((item) => item.start <= key && (item.end || item.start) >= key),
      });
    }
    while (cells.length % 7 !== 0) {
      cells.push({ key: `empty-end-${cells.length}`, day: null, items: [] });
    }
    return cells;
  }, [items, month, year]);

  const todayKey = new Date().toISOString().split('T')[0];

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b p-3">
        <div>
          <h2 className="text-base font-semibold">{MONTHS[month]} {year}</h2>
          <p className="text-xs text-muted-foreground">{items.length} item{items.length !== 1 ? 's' : ''} neste mes</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={onPrevious}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={onNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 border-b bg-muted/30">
        {WEEKDAYS.map((weekday) => (
          <div key={weekday} className="px-2 py-2 text-center text-[10px] font-semibold text-muted-foreground">
            {weekday}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((cell) => {
          const key = cell.day ? `${year}-${String(month + 1).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}` : cell.key;
          const isToday = key === todayKey;
          return (
            <div
              key={cell.key}
              className={cn(
                'min-h-[112px] border-r border-b p-1.5 last:border-r-0',
                !cell.day && 'bg-muted/20',
                isToday && 'bg-primary/5 ring-1 ring-primary/30 ring-inset',
              )}
            >
              {cell.day && (
                <>
                  <div className={cn('mb-1 text-xs font-semibold', isToday && 'text-primary')}>{cell.day}</div>
                  <div className="space-y-1">
                    {cell.items.slice(0, 4).map((item) => (
                      <div
                        key={`${cell.key}-${item.id}`}
                        className="rounded px-1.5 py-1 text-[10px] leading-tight text-white shadow-sm"
                        style={{ backgroundColor: item.color }}
                        title={`${TYPE_LABELS[item.type]}${item.sourceDetail ? ` - ${item.sourceDetail}` : ''}: ${item.title}`}
                      >
                        <div className="font-semibold uppercase truncate">{TYPE_LABELS[item.type]}</div>
                        <div className="truncate">{item.title}</div>
                      </div>
                    ))}
                    {cell.items.length > 4 && (
                      <div className="text-[10px] text-muted-foreground px-1">+{cell.items.length - 4} itens</div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function CountBadge({
  icon: Icon,
  type,
  items,
  label,
}: {
  icon: React.ElementType;
  type: TimelineType;
  items: TimelineItem[];
  label: string;
}) {
  return (
    <Badge variant="outline" className="gap-1 text-xs">
      <Icon className="h-3 w-3" style={{ color: TYPE_COLORS[type] }} />
      {items.filter((item) => item.type === type).length} {label}
    </Badge>
  );
}
