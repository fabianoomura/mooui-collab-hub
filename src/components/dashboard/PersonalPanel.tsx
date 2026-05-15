import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertTriangle, CalendarClock, ListTodo, Rocket, Calendar, ClipboardCheck,
  MessageSquare, Briefcase, Send, CheckCircle2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  AgendaItem, todayISO, addDaysISO, toMs, groupByDay, humanDayLabel, isOverdue,
} from '@/lib/personalAgenda';

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

export function PersonalPanel() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();

  const today = todayISO();
  const window7 = addDaysISO(today, 7);

  const { data, isLoading } = useQuery({
    queryKey: ['personal-panel', user?.id, currentOrg?.id, today],
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
          .select('id, title, due_date, status, project_id, projects(name)')
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
        .lte('start_date', window7)
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

      // ---- Build derived sets ----
      const overdue = [
        ...myTasks.filter((t) => isOverdue(t.due_date)).map((t) => ({
          kind: 'task' as const, id: t.id, title: t.title,
          subtitle: t.projects?.name ?? null, when: t.due_date,
          href: '/projetos', sortKey: toMs(t.due_date),
        })),
        ...myStages.filter((s) => s.planned_end && isOverdue(s.planned_end)).map((s) => ({
          kind: 'stage' as const, id: s.id, title: s.name,
          subtitle: s.launches?.name ?? null, when: s.planned_end!,
          href: '/lancamentos', sortKey: toMs(s.planned_end!),
        })),
        ...myCheckItems.filter((i) => i.due_date && isOverdue(i.due_date)).map((i) => ({
          kind: 'checklist' as const, id: i.id, title: i.label,
          subtitle: i.launch_checklists?.name ?? null, when: i.due_date!,
          href: '/checagens', sortKey: toMs(i.due_date!),
        })),
      ].sort((a, b) => a.sortKey - b.sortKey);

      const upcoming: AgendaItem[] = [
        ...myTasks
          .filter((t) => t.due_date && t.due_date >= today && t.due_date <= window7)
          .map((t) => ({
            kind: 'task' as const, id: t.id, title: t.title,
            subtitle: t.projects?.name ?? null, when: t.due_date,
            href: '/projetos', sortKey: toMs(t.due_date),
          })),
        ...myStages
          .filter((s) => s.planned_end && s.planned_end >= today && s.planned_end <= window7)
          .map((s) => ({
            kind: 'stage' as const, id: s.id, title: s.name,
            subtitle: s.launches?.name ?? null, when: s.planned_end!,
            href: '/lancamentos', sortKey: toMs(s.planned_end!),
          })),
        ...myBookings
          .filter((b) => {
            const day = b.starts_at.split('T')[0];
            return day >= today && day <= window7;
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
          .filter((i) => i.due_date && i.due_date >= today && i.due_date <= window7)
          .map((i) => ({
            kind: 'checklist' as const, id: i.id, title: i.label,
            subtitle: i.launch_checklists?.name ?? null, when: i.due_date!,
            href: '/checagens', sortKey: toMs(i.due_date!),
          })),
      ];

      return {
        overdue,
        agenda: groupByDay(upcoming),
        sentMessages: mySent,
        sentCount: sentCount ?? 0,
        myTickets,
        completedToday: myTasks.filter((t) => t.status === 'done').length, // 0 here (filtered out)
      };
    },
    enabled: !!user && !!currentOrg,
    staleTime: 60_000,
  });

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
                return (
                  <Link
                    key={`${it.kind}-${it.id}`} to={it.href}
                    className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors group"
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${COLORS[it.kind]}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate group-hover:text-primary">{it.title}</p>
                      {it.subtitle && (
                        <p className="text-xs text-muted-foreground truncate">{it.subtitle}</p>
                      )}
                    </div>
                    <span className="text-xs text-destructive font-medium shrink-0">
                      {humanDayLabel(it.when.split('T')[0])}
                    </span>
                  </Link>
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

        {/* Agenda 7 dias */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <CalendarClock className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wide">Próximos 7 dias</h2>
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
                        <Link
                          key={`${it.kind}-${it.id}`} to={it.href}
                          className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors group"
                        >
                          <Icon className={`h-4 w-4 shrink-0 ${COLORS[it.kind]}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate group-hover:text-primary">{it.title}</p>
                            {it.subtitle && (
                              <p className="text-xs text-muted-foreground truncate">{it.subtitle}</p>
                            )}
                          </div>
                          {fmtTime(it.when) && (
                            <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                              {fmtTime(it.when)}
                            </span>
                          )}
                        </Link>
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
