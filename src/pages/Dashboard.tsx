import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import {
  Table2, MessageSquare, BookOpen, Calendar, CalendarDays, Rocket,
  ArrowRight, Briefcase, ClipboardCheck, ListTodo, CalendarClock,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Skeleton } from '@/components/ui/skeleton';
import { PersonalPanel } from '@/components/dashboard/PersonalPanel';

type ModuleCard = {
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
  accent: string;
  stat: string;
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export default function Dashboard() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const qc = useQueryClient();

  // Atualização dinâmica: invalida estatísticas quando dados mudam
  useEffect(() => {
    if (!user || !currentOrg) return;
    const invalidate = () => {
      qc.invalidateQueries({ queryKey: ['home-stats'] });
      qc.invalidateQueries({ queryKey: ['personal-panel'] });
    };
    const ch = supabase
      .channel(`dash:${user.id}:${currentOrg.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_assignees' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'launches' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'launch_stages' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'launch_checklists' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meeting_room_bookings' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'annual_events' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'doc_pages' }, invalidate)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, invalidate)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, currentOrg, qc]);

  const firstName =
    (user?.user_metadata as any)?.full_name?.split(' ')[0]
    ?? user?.email?.split('@')[0]
    ?? '';

  const todayLabel = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long',
  });

  const { data: stats, isLoading, isFetching } = useQuery({
    queryKey: ['home-stats', currentOrg?.id, user?.id],
    queryFn: async () => {
      if (!user || !currentOrg) return null;
      const today = new Date().toISOString().split('T')[0];
      const year = new Date().getFullYear();

      const [tasksRes, unreadRes, docsRes, bookingsRes, eventsRes, launchesRes, ticketsRes, checklistsRes] = await Promise.all([
        supabase.from('task_assignees').select('task_id').eq('user_id', user.id),
        supabase.from('messages').select('id', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 86400000).toISOString()),
        supabase.from('doc_pages').select('id', { count: 'exact', head: true }).eq('organization_id', currentOrg.id),
        supabase.from('meeting_room_bookings').select('id, starts_at, title', { count: 'exact' }).eq('organization_id', currentOrg.id).gte('starts_at', new Date().toISOString()).order('starts_at').limit(1),
        supabase.from('annual_events').select('id', { count: 'exact', head: true }).eq('organization_id', currentOrg.id).gte('start_date', `${year}-01-01`).lte('start_date', `${year}-12-31`),
        supabase.from('launches').select('id', { count: 'exact', head: true }).eq('organization_id', currentOrg.id).eq('status', 'active'),
        supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('organization_id', currentOrg.id).in('status', ['open', 'in_progress']),
        supabase.from('launch_checklists').select('id', { count: 'exact', head: true }).eq('organization_id', currentOrg.id),
      ]);

      let myOpenTasks = 0;
      let nextTaskTitle: string | null = null;
      if (tasksRes.data?.length) {
        const ids = tasksRes.data.map(a => a.task_id);
        const { data: openTasks, count } = await supabase
          .from('tasks')
          .select('id, title, due_date', { count: 'exact' })
          .in('id', ids).neq('status', 'done')
          .order('due_date', { ascending: true, nullsFirst: false })
          .limit(1);
        myOpenTasks = count ?? 0;
        nextTaskTitle = openTasks?.[0]?.title ?? null;
      }

      // Próxima etapa do lançamento atribuída ao usuário
      const { data: nextStage } = await supabase
        .from('launch_stages')
        .select('id, name, planned_end, launches(name)')
        .eq('assignee_id', user.id)
        .neq('status', 'done')
        .order('planned_end', { ascending: true, nullsFirst: false })
        .limit(1);

      const nextBooking = bookingsRes.data?.[0] ?? null;

      return {
        myOpenTasks,
        nextTaskTitle,
        recentMessages: unreadRes.count ?? 0,
        docs: docsRes.count ?? 0,
        upcomingBookings: bookingsRes.count ?? 0,
        nextBooking,
        yearEvents: eventsRes.count ?? 0,
        activeLaunches: launchesRes.count ?? 0,
        openTickets: ticketsRes.count ?? 0,
        checklists: checklistsRes.count ?? 0,
        nextStage: nextStage?.[0] ?? null,
      };
    },
    enabled: !!user && !!currentOrg,
  });

  const cards: ModuleCard[] = [
    { title: 'Sunday', description: 'Projetos e tarefas', href: '/projetos', icon: Table2, accent: 'from-pink-500/15 to-pink-500/5 text-pink-500',
      stat: stats ? `${stats.myOpenTasks} tarefa${stats.myOpenTasks === 1 ? '' : 's'} sua${stats.myOpenTasks === 1 ? '' : 's'}` : '—' },
    { title: 'Speaks', description: 'Mensagens da equipe', href: '/mensagens', icon: MessageSquare, accent: 'from-violet-500/15 to-violet-500/5 text-violet-500',
      stat: stats ? `${stats.recentMessages} mensagens 24h` : '—' },
    { title: 'Papelinho', description: 'Documentação', href: '/docs', icon: BookOpen, accent: 'from-amber-500/15 to-amber-500/5 text-amber-600',
      stat: stats ? `${stats.docs} documento${stats.docs === 1 ? '' : 's'}` : '—' },
    { title: 'Reserva de Sala', description: 'Salas de reunião', href: '/salas', icon: Calendar, accent: 'from-emerald-500/15 to-emerald-500/5 text-emerald-600',
      stat: stats ? `${stats.upcomingBookings} reserva${stats.upcomingBookings === 1 ? '' : 's'} agendada${stats.upcomingBookings === 1 ? '' : 's'}` : '—' },
    { title: 'Calendário de Marketing', description: 'Planejamento do ano', href: '/calendario', icon: CalendarDays, accent: 'from-sky-500/15 to-sky-500/5 text-sky-600',
      stat: stats ? `${stats.yearEvents} evento${stats.yearEvents === 1 ? '' : 's'} em ${new Date().getFullYear()}` : '—' },
    { title: 'Produção', description: 'Etapas, prazos e gargalos', href: '/lancamentos', icon: Rocket, accent: 'from-rose-500/15 to-rose-500/5 text-rose-600',
      stat: stats ? `${stats.activeLaunches} ativo${stats.activeLaunches === 1 ? '' : 's'}` : '—' },
    { title: 'Check Lançamentos', description: 'Checklist de validação no site', href: '/checagens', icon: ClipboardCheck, accent: 'from-teal-500/15 to-teal-500/5 text-teal-600',
      stat: stats ? `${stats.checklists} checagem${stats.checklists === 1 ? '' : 's'}` : '—' },
    { title: 'Tickets de TI', description: 'Bugs e suporte', href: '/tickets', icon: Briefcase, accent: 'from-indigo-500/15 to-indigo-500/5 text-indigo-600',
      stat: stats ? `${stats.openTickets} aberto${stats.openTickets === 1 ? '' : 's'}` : '—' },
  ];

  const fmtTime = (iso?: string) => iso
    ? new Date(iso).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null;
  const fmtDay = (d?: string | null) => d
    ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : null;

  const hasToday = stats && (stats.nextTaskTitle || stats.nextBooking || stats.nextStage);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {greeting()}{firstName ? `, ${firstName}` : ''} 👋
          </h1>
          <p className="text-muted-foreground text-sm mt-1 capitalize">{todayLabel}</p>
        </div>
        {isFetching && !isLoading && (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground mt-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            Atualizando…
          </span>
        )}
      </div>

      {/* Hoje */}
      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : hasToday ? (
        <Card className="p-5 bg-gradient-to-br from-primary/[0.07] to-primary/[0.02] border-primary/20">
          <div className="flex items-center gap-2 mb-3">
            <CalendarClock className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/80">Hoje</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {stats?.nextTaskTitle && (
              <Link to="/projetos" className="group">
                <div className="flex items-start gap-2.5">
                  <ListTodo className="h-4 w-4 text-pink-500 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase text-muted-foreground tracking-wide">Próxima tarefa</p>
                    <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{stats.nextTaskTitle}</p>
                    <p className="text-xs text-muted-foreground">{stats.myOpenTasks} no total</p>
                  </div>
                </div>
              </Link>
            )}
            {stats?.nextBooking && (
              <Link to="/salas" className="group">
                <div className="flex items-start gap-2.5">
                  <Calendar className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase text-muted-foreground tracking-wide">Próxima reserva</p>
                    <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{(stats.nextBooking as any).title || 'Reunião'}</p>
                    <p className="text-xs text-muted-foreground">{fmtTime((stats.nextBooking as any).starts_at)}</p>
                  </div>
                </div>
              </Link>
            )}
            {stats?.nextStage && (
              <Link to="/lancamentos" className="group">
                <div className="flex items-start gap-2.5">
                  <Rocket className="h-4 w-4 text-rose-600 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase text-muted-foreground tracking-wide">Sua próxima etapa</p>
                    <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{(stats.nextStage as any).name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {(stats.nextStage as any).launches?.name}{(stats.nextStage as any).planned_end ? ` · até ${fmtDay((stats.nextStage as any).planned_end)}` : ''}
                    </p>
                  </div>
                </div>
              </Link>
            )}
          </div>
        </Card>
      ) : null}

      {/* Painel pessoal — em atraso, agenda, mensagens, CRM */}
      <PersonalPanel />

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Módulos</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((c) => (
            <Link key={c.title} to={c.href} className="group">
              <Card className="p-5 h-full hover:shadow-md transition-all hover:-translate-y-0.5 border-border/60">
                <div className={`h-11 w-11 rounded-xl bg-gradient-to-br ${c.accent} flex items-center justify-center mb-4`}>
                  <c.icon className="h-5 w-5" />
                </div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-foreground">{c.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{c.description}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </div>
                <div className="mt-4 pt-3 border-t border-border/50 text-xs text-muted-foreground">
                  {isLoading ? <Skeleton className="h-3.5 w-24" /> : c.stat}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
