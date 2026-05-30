import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertTriangle, CalendarClock, ListTodo, Rocket, Calendar, ClipboardCheck,
  MessageSquare, Briefcase, Send, CheckCircle2, Package, TrendingUp, Check, Play,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  AgendaItem, todayISO, addDaysISO, toMs, groupByDay, humanDayLabel, isOverdue,
} from '@/lib/personalAgenda';
import { toast } from 'sonner';

const fmtBRL = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const ICONS: Record<AgendaItem['kind'], React.ElementType> = {
  task: ListTodo,
  stage: Rocket,
  booking: Calendar,
  event: CalendarClock,
  checklist: ClipboardCheck,
};

const COLORS: Record<AgendaItem['kind'], string> = {
  task: 'text-pink-500',
  stage: 'text-rose-600',
  booking: 'text-emerald-600',
  event: 'text-sky-600',
  checklist: 'text-teal-600',
};

type WindowDays = 1 | 7 | 30;
const WINDOW_LABELS: Record<WindowDays, string> = { 1: 'Hoje', 7: '7 dias', 30: '30 dias' };

export function PersonalPanel() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const [windowDays, setWindowDays] = useState<WindowDays>(7);

  const today = todayISO();
  const windowEnd = addDaysISO(today, windowDays);

  const { data, isLoading } = useQuery({
    queryKey: ['personal-panel', user?.id, currentOrg?.id, today, windowDays],
    queryFn: async () => {
      if (!user || !currentOrg) return null;

      // 1) Tasks atribuídas a mim (open)
      const { data: assigns } = await supabase
        .from('task_assignees').select('task_id').eq('user_id', user.id);
      const taskIds = (assigns || []).map((a) => a.task_id);
      let myTasks: any[] = [];
      if (taskIds.length) {
        const { data } = await supabase
          .from('tasks')
          .select('id, title, due_date, status, priority, project_id, projects(name)')
          .in('id', taskIds).neq('status', 'done');
        myTasks = data || [];
      }

      // 2) Etapas de lançamento minhas
      const { data: myStagesData } = await supabase
        .from('launch_stages')
        .select('id, name, planned_end, status, launch_id, launches(name)')
        .eq('assignee_id', user.id).neq('status', 'done');
      const myStages = myStagesData || [];

      // 3) Reservas minhas
      const { data: myBookingsData } = await supabase
        .from('meeting_room_bookings')
        .select('id, title, starts_at, ends_at, room_id, meeting_rooms(name)')
        .eq('user_id', user.id)
        .gte('ends_at', new Date().toISOString())
        .order('starts_at');
      const myBookings = myBookingsData || [];

      // 4) Eventos anuais da organização (próximos)
      const { data: orgEventsData } = await supabase
        .from('annual_events')
        .select('id, title, start_date, end_date, color')
        .eq('organization_id', currentOrg.id)
        .gte('start_date', today)
        .lte('start_date', windowEnd)
        .order('start_date');
      const orgEvents = orgEventsData || [];

      // 5) Itens de checagem atribuídos a mim
      const { data: myCheckItemsData } = await supabase
        .from('launch_checklist_items')
        .select('id, label, due_date, status, checklist_id, launch_checklists(name)')
        .eq('assignee_id', user.id).neq('status', 'done').neq('status', 'na');
      const myCheckItems = myCheckItemsData || [];

      // 6) Mensagens enviadas (24h)
      const since = new Date(Date.now() - 86_400_000).toISOString();
      const { data: mySentData, count: sentCount } = await supabase
        .from('messages')
        .select('id, content, created_at, channel_id, channels(name)', { count: 'exact' })
        .eq('user_id', user.id).gte('created_at', since)
        .order('created_at', { ascending: false }).limit(5);
      const mySent = mySentData || [];

      // 7) Meus tickets de TI em aberto
      const { data: myTicketsData } = await supabase
        .from('tickets')
        .select('id, title, priority, status, updated_at')
        .eq('organization_id', currentOrg.id).eq('created_by', user.id).in('status', ['open', 'in_progress'])
        .order('updated_at', { ascending: false }).limit(5);
      const myTickets = myTicketsData || [];

      // 8) Pedidos atribuídos a mim
      const { data: myOrdersData } = await supabase
        .from('orders' as any)
        .select('id, title, code, priority, status, problem_type, created_at')
        .eq('organization_id', currentOrg.id)
        .eq('assigned_to', user.id)
        .not('status', 'in', '("done","cancelled","sent")')
        .order('created_at', { ascending: false })
        .limit(5);
      const myOrders = (myOrdersData || []) as any[];

      // ---- Build derived sets ----
      const priorityWeight: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      const overdue = [
        ...myTasks.filter((t) => isOverdue(t.due_date)).map((t) => ({
          kind: 'task' as const, id: t.id, title: t.title,
          subtitle: t.projects?.name ?? null, when: t.due_date,
          href: '/projetos', sortKey: toMs(t.due_date),
          priority: (t.priority as string) || 'medium',
        })),
        ...myStages.filter((s) => s.planned_end && isOverdue(s.planned_end)).map((s) => ({
          kind: 'stage' as const, id: s.id, title: s.name,
          subtitle: s.launches?.name ?? null, when: s.planned_end!,
          href: '/lancamentos', sortKey: toMs(s.planned_end!),
          priority: 'medium' as string,
        })),
        ...myCheckItems.filter((i) => i.due_date && isOverdue(i.due_date)).map((i) => ({
          kind: 'checklist' as const, id: i.id, title: i.label,
          subtitle: i.launch_checklists?.name ?? null, when: i.due_date!,
          href: '/checagens', sortKey: toMs(i.due_date!),
          priority: 'medium' as string,
        })),
      ].sort((a, b) => (priorityWeight[a.priority] ?? 2) - (priorityWeight[b.priority] ?? 2) || a.sortKey - b.sortKey);

      const upcoming: AgendaItem[] = [
        ...myTasks
          .filter((t) => t.due_date && t.due_date >= today && t.due_date <= windowEnd)
          .map((t) => ({
            kind: 'task' as const, id: t.id, title: t.title,
            subtitle: t.projects?.name ?? null, when: t.due_date,
            href: '/projetos', sortKey: toMs(t.due_date),
          })),
        ...myStages
          .filter((s) => s.planned_end && s.planned_end >= today && s.planned_end <= windowEnd)
          .map((s) => ({
            kind: 'stage' as const, id: s.id, title: s.name,
            subtitle: s.launches?.name ?? null, when: s.planned_end!,
            href: '/lancamentos', sortKey: toMs(s.planned_end!),
          })),
        ...myBookings
          .filter((b) => {
            const day = b.starts_at.split('T')[0];
            return day >= today && day <= windowEnd;
          })
          .map((b) => ({
            kind: 'booking' as const, id: b.id, title: b.title || 'Reunião',
            subtitle: b.meeting_rooms?.name ?? null, when: b.starts_at,
            href: '/salas', sortKey: toMs(b.starts_at),
          })),
        ...orgEvents.map((e) => ({
          kind: 'event' as const, id: e.id, title: e.title,
          subtitle: null, when: e.start_date,
          href: '/calendario', sortKey: toMs(e.start_date),
        })),
        ...myCheckItems
          .filter((i) => i.due_date && i.due_date >= today && i.due_date <= windowEnd)
          .map((i) => ({
            kind: 'checklist' as const, id: i.id, title: i.label,
            subtitle: i.launch_checklists?.name ?? null, when: i.due_date!,
            href: '/checagens', sortKey: toMs(i.due_date!),
          })),
      ];

      // 9) Count completed today for summary %
      const { count: doneTasks } = await supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .in('id', taskIds.length ? taskIds : ['__none__'])
        .eq('status', 'done');

      const { count: doneStages } = await supabase
        .from('launch_stages')
        .select('id', { count: 'exact', head: true })
        .eq('assignee_id', user.id)
        .eq('status', 'done');

      const { count: doneCheckItems } = await supabase
        .from('launch_checklist_items')
        .select('id', { count: 'exact', head: true })
        .eq('assignee_id', user.id)
        .eq('status', 'done');

      // Summary counters
      const totalPending = myTasks.length + myStages.length + myCheckItems.length + myOrders.length;
      const totalDone = (doneTasks ?? 0) + (doneStages ?? 0) + (doneCheckItems ?? 0);
      const totalAll = totalPending + totalDone;
      const completionPct = totalAll > 0 ? Math.round((totalDone / totalAll) * 100) : 100;

      return {
        overdue,
        agenda: groupByDay(upcoming),
        sentMessages: mySent,
        sentCount: sentCount ?? 0,
        myTickets,
        myOrders,
        totalPending,
        totalDone,
        completionPct,
        overdueCount: overdue.length,
      };
    },
    enabled: !!user && !!currentOrg,
    staleTime: 60_000,
  });

  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['personal-panel'] });

  const completeTask = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.from('tasks').update({ status: 'done' }).eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Tarefa concluída'); invalidate(); },
    onError: () => toast.error('Erro ao concluir tarefa'),
  });

  const completeStage = useMutation({
    mutationFn: async (stageId: string) => {
      const { error } = await supabase.from('launch_stages').update({ status: 'done' }).eq('id', stageId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Etapa concluída'); invalidate(); },
    onError: () => toast.error('Erro ao concluir etapa'),
  });

  const completeCheckItem = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from('launch_checklist_items').update({ status: 'done' }).eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Item concluído'); invalidate(); },
    onError: () => toast.error('Erro ao concluir item'),
  });

  const startTask = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.from('tasks').update({ status: 'in_progress' }).eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Tarefa em andamento'); invalidate(); },
    onError: () => toast.error('Erro ao atualizar tarefa'),
  });

  const startStage = useMutation({
    mutationFn: async (stageId: string) => {
      const { error } = await supabase.from('launch_stages').update({ status: 'in_progress' }).eq('id', stageId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Etapa em andamento'); invalidate(); },
    onError: () => toast.error('Erro ao atualizar etapa'),
  });

  const handleComplete = (kind: AgendaItem['kind'], id: string) => {
    if (kind === 'task') completeTask.mutate(id);
    else if (kind === 'stage') completeStage.mutate(id);
    else if (kind === 'checklist') completeCheckItem.mutate(id);
  };

  const handleStart = (kind: AgendaItem['kind'], id: string) => {
    if (kind === 'task') startTask.mutate(id);
    else if (kind === 'stage') startStage.mutate(id);
  };

  const canComplete = (kind: AgendaItem['kind']) =>
    kind === 'task' || kind === 'stage' || kind === 'checklist';

  const canStart = (kind: AgendaItem['kind']) =>
    kind === 'task' || kind === 'stage';

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Skeleton className="h-64 lg:col-span-2" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (!data) return null;

  const fmtTime = (iso: string) =>
    iso.length === 10
      ? ''
      : new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Resumo do dia */}
      <Card className="p-4 lg:col-span-3 flex items-center gap-6 flex-wrap">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Resumo do dia</span>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <span className="flex items-center gap-1.5">
            <ListTodo className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium">{data.totalPending}</span> pendências
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            <span className="font-medium">{data.totalDone}</span> concluídas
          </span>
          <span className="flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
            <span className="font-medium">{data.overdueCount}</span> em atraso
          </span>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${data.completionPct}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-muted-foreground">{data.completionPct}%</span>
        </div>
      </Card>

      {/* Coluna esquerda */}
      <div className="lg:col-span-2 space-y-4">
        {/* Em atraso */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <h2 className="text-sm font-semibold uppercase tracking-wide">Em atraso</h2>
            <Badge variant="destructive" className="ml-auto">{data.overdue.length}</Badge>
          </div>
          {data.overdue.length === 0 ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Nada em atraso. 🎉
            </p>
          ) : (
            <div className="space-y-1.5">
              {data.overdue.slice(0, 6).map((it) => {
                const Icon = ICONS[it.kind];
                const isHighPriority = it.priority === 'critical' || it.priority === 'high';
                return (
                  <div
                    key={`${it.kind}-${it.id}`}
                    className={`flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors group ${isHighPriority ? 'border-l-2 border-l-destructive' : ''}`}
                  >
                    <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      {canStart(it.kind) && (
                        <Button
                          variant="ghost" size="icon"
                          className="h-6 w-6"
                          title="Iniciar (Em andamento)"
                          onClick={() => handleStart(it.kind, it.id)}
                        >
                          <Play className="h-3 w-3 text-amber-600" />
                        </Button>
                      )}
                      {canComplete(it.kind) && (
                        <Button
                          variant="ghost" size="icon"
                          className="h-6 w-6"
                          title="Concluir"
                          onClick={() => handleComplete(it.kind, it.id)}
                        >
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        </Button>
                      )}
                    </div>
                    <Link to={it.href} className="flex items-center gap-3 flex-1 min-w-0">
                      <Icon className={`h-4 w-4 shrink-0 ${COLORS[it.kind]}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium truncate group-hover:text-primary">{it.title}</p>
                          {isHighPriority && (
                            <Badge variant="destructive" className="text-[9px] px-1 py-0 shrink-0">
                              {it.priority === 'critical' ? 'Crítica' : 'Alta'}
                            </Badge>
                          )}
                        </div>
                        {it.subtitle && (
                          <p className="text-xs text-muted-foreground truncate">{it.subtitle}</p>
                        )}
                      </div>
                    </Link>
                    <span className="text-xs text-destructive font-medium shrink-0">
                      {humanDayLabel(it.when.split('T')[0])}
                    </span>
                  </div>
                );
              })}
              {data.overdue.length > 6 && (
                <p className="text-xs text-muted-foreground text-center pt-1">
                  +{data.overdue.length - 6} item(ns)
                </p>
              )}
            </div>
          )}
        </Card>

        {/* Agenda dinâmica */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <CalendarClock className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wide">
              {windowDays === 1 ? 'Agenda de hoje' : `Próximos ${windowDays} dias`}
            </h2>
            <div className="ml-auto flex items-center gap-1 bg-muted rounded-md p-0.5">
              {([1, 7, 30] as WindowDays[]).map((d) => (
                <button
                  key={d}
                  onClick={() => setWindowDays(d)}
                  className={`px-2 py-0.5 text-[11px] font-medium rounded transition-colors ${
                    windowDays === d
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {WINDOW_LABELS[d]}
                </button>
              ))}
            </div>
          </div>
          {data.agenda.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem compromissos agendados.</p>
          ) : (
            <div className="space-y-4">
              {data.agenda.map(({ day, items }) => (
                <div key={day}>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 capitalize">
                    {humanDayLabel(day)}
                  </div>
                  <div className="space-y-1">
                    {items.map((it) => {
                      const Icon = ICONS[it.kind];
                      return (
                        <div
                          key={`${it.kind}-${it.id}`}
                          className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors group"
                        >
                          <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            {canStart(it.kind) && (
                              <Button
                                variant="ghost" size="icon"
                                className="h-6 w-6"
                                title="Iniciar (Em andamento)"
                                onClick={() => handleStart(it.kind, it.id)}
                              >
                                <Play className="h-3 w-3 text-amber-600" />
                              </Button>
                            )}
                            {canComplete(it.kind) && (
                              <Button
                                variant="ghost" size="icon"
                                className="h-6 w-6"
                                title="Concluir"
                                onClick={() => handleComplete(it.kind, it.id)}
                              >
                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                              </Button>
                            )}
                          </div>
                          <Link to={it.href} className="flex items-center gap-3 flex-1 min-w-0">
                            <Icon className={`h-4 w-4 shrink-0 ${COLORS[it.kind]}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate group-hover:text-primary">{it.title}</p>
                              {it.subtitle && (
                                <p className="text-xs text-muted-foreground truncate">{it.subtitle}</p>
                              )}
                            </div>
                          </Link>
                          {fmtTime(it.when) && (
                            <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                              {fmtTime(it.when)}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Coluna direita */}
      <div className="space-y-4">
        {/* Mensagens enviadas */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Send className="h-4 w-4 text-violet-500" />
            <h2 className="text-sm font-semibold uppercase tracking-wide">Você enviou</h2>
            <Badge variant="secondary" className="ml-auto">{data.sentCount} 24h</Badge>
          </div>
          {data.sentMessages.length === 0 ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <MessageSquare className="h-4 w-4" /> Nenhuma mensagem nas últimas 24h.
            </p>
          ) : (
            <div className="space-y-2">
              {data.sentMessages.map((m: any) => (
                <Link
                  key={m.id} to="/mensagens"
                  className="block p-2 rounded-md hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <Badge variant="outline" className="text-[10px]">
                      #{m.channels?.name?.replace(/^dm:.*/, 'dm') || 'canal'}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs text-foreground/80 line-clamp-2 group-hover:text-primary">
                    {m.content}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Pedidos atribuídos */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Package className="h-4 w-4 text-orange-500" />
            <h2 className="text-sm font-semibold uppercase tracking-wide">Seus pedidos</h2>
            <Badge variant="secondary" className="ml-auto">{data.myOrders.length}</Badge>
          </div>
          {data.myOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum pedido pendente.</p>
          ) : (
            <div className="space-y-1">
              {data.myOrders.map((o: any) => (
                <Link
                  key={o.id} to="/pedidos"
                  className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate group-hover:text-primary">{o.title}</p>
                    {o.code && <p className="text-[10px] text-muted-foreground">#{o.code}</p>}
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {({ low: 'Baixa', medium: 'Média', high: 'Alta', urgent: 'Urgente' } as Record<string,string>)[o.priority] ?? o.priority}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Tickets de TI */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Briefcase className="h-4 w-4 text-indigo-600" />
            <h2 className="text-sm font-semibold uppercase tracking-wide">Seus tickets</h2>
            <Badge variant="secondary" className="ml-auto">{data.myTickets.length}</Badge>
          </div>
          {data.myTickets.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum ticket em aberto.</p>
          ) : (
            <div className="space-y-1">
              {data.myTickets.map((t: any) => (
                <Link
                  key={t.id} to="/tickets"
                  className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate group-hover:text-primary">{t.title}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">{({ low: 'Baixa', medium: 'Média', high: 'Alta', urgent: 'Urgente' } as Record<string,string>)[t.priority] ?? t.priority}</Badge>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
