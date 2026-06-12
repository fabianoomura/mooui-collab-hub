import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import {
  MessageSquare, BookOpen, Calendar, CalendarDays, Rocket,
  ArrowRight, Briefcase, ClipboardCheck, ListTodo, CalendarClock,
  Globe, Camera, Package, FileText, Mail, Palette, ShoppingCart,
  DollarSign, Plane, Factory, Users, Monitor,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Skeleton } from '@/components/ui/skeleton';
import { PersonalPanel } from '@/components/dashboard/PersonalPanel';
import { KPIPanel } from '@/components/dashboard/KPIPanel';
import { ExecutivePanel } from '@/components/dashboard/ExecutivePanel';
import { useNotificationListener } from '@/hooks/useDesktopNotifications';
import { NotificationPermissionBanner } from '@/components/NotificationPermissionBanner';
import { OnboardingTour } from '@/components/OnboardingTour';

type ModuleItem = {
  title: string;
  href: string;
  icon: React.ElementType;
  stat?: string;
};

type SectorCard = {
  sector: string;
  accent: string;
  sectorIcon: React.ElementType;
  items: ModuleItem[];
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

  useNotificationListener();

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
      // Module data now lives in tasks (Sunday boards) — tasks listener above covers it
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

      // Core module queries (specialized — keep as is)
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

      // Module stats from Sunday boards (replaces dedicated table queries)
      const { data: moduleProjects } = await supabase
        .from('projects')
        .select('id, name')
        .eq('organization_id', currentOrg.id)
        .ilike('name', 'Modulo | %');

      const byPrefix = (prefix: string) =>
        (moduleProjects || [])
          .filter((p) => p.name.toLowerCase().includes(prefix.toLowerCase()))
          .map((p) => p.id);

      const countActive = async (ids: string[]) => {
        if (ids.length === 0) return 0;
        const { count } = await supabase
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .in('project_id', ids)
          .is('archived_at', null)
          .is('parent_task_id', null)
          .neq('status', 'done');
        return count ?? 0;
      };

      const [openMelhorias, conteudosPendentes, newslettersPendentes, demandasPendentes, sessoesAtivas, produtosAtivos] = await Promise.all([
        countActive(byPrefix('Melhorias')),
        countActive(byPrefix('Programacao')),
        countActive(byPrefix('Newsletters')),
        countActive(byPrefix('Demandas')),
        countActive(byPrefix('Sessoes')),
        countActive(byPrefix('Produtos')),
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
        openMelhorias,
        conteudosPendentes,
        newslettersPendentes,
        demandasPendentes,
        sessoesAtivas,
        produtosAtivos,
        nextStage: nextStage?.[0] ?? null,
      };
    },
    enabled: !!user && !!currentOrg,
  });

  const sectors: SectorCard[] = [
    {
      sector: 'Geral', sectorIcon: Users, accent: 'from-blue-500/15 to-blue-500/5 text-blue-500',
      items: [
        { title: 'Speaks', href: '/mensagens', icon: MessageSquare, stat: stats ? `${stats.recentMessages} msg 24h` : undefined },
        { title: 'Papelinho', href: '/docs', icon: BookOpen, stat: stats ? `${stats.docs} doc${stats.docs === 1 ? '' : 's'}` : undefined },
        { title: 'Salas', href: '/salas', icon: Calendar, stat: stats ? `${stats.upcomingBookings} reserva${stats.upcomingBookings === 1 ? '' : 's'}` : undefined },
        { title: 'Equipe', href: '/equipe', icon: Users },
      ],
    },
    {
      sector: 'Marketing', sectorIcon: Camera, accent: 'from-pink-500/15 to-pink-500/5 text-pink-500',
      items: [
        { title: 'Programação', href: '/programacao', icon: Camera, stat: stats ? `${stats.conteudosPendentes} pendente${stats.conteudosPendentes === 1 ? '' : 's'}` : undefined },
        { title: 'Newsletters', href: '/newsletters', icon: Mail, stat: stats ? `${stats.newslettersPendentes} pendente${stats.newslettersPendentes === 1 ? '' : 's'}` : undefined },
        { title: 'Demandas', href: '/demandas-marketing', icon: FileText, stat: stats ? `${stats.demandasPendentes} pendente${stats.demandasPendentes === 1 ? '' : 's'}` : undefined },
      ],
    },
    {
      sector: 'Estúdio', sectorIcon: Camera, accent: 'from-violet-500/15 to-violet-500/5 text-violet-500',
      items: [
        { title: 'Sessões', href: '/sessoes', icon: Camera, stat: stats ? `${stats.sessoesAtivas} ativa${stats.sessoesAtivas === 1 ? '' : 's'}` : undefined },
      ],
    },
    {
      sector: 'Design', sectorIcon: Palette, accent: 'from-purple-500/15 to-purple-500/5 text-purple-500',
      items: [
        { title: 'Design', href: '/design', icon: Palette },
      ],
    },
    {
      sector: 'Produto', sectorIcon: Package, accent: 'from-orange-500/15 to-orange-500/5 text-orange-500',
      items: [
        { title: 'Produtos', href: '/produtos', icon: Package, stat: stats ? `${stats.produtosAtivos} ativo${stats.produtosAtivos === 1 ? '' : 's'}` : undefined },
      ],
    },
    {
      sector: 'Produção', sectorIcon: Rocket, accent: 'from-rose-500/15 to-rose-500/5 text-rose-500',
      items: [
        { title: 'Lançamentos', href: '/lancamentos', icon: Rocket, stat: stats ? `${stats.activeLaunches} ativo${stats.activeLaunches === 1 ? '' : 's'}` : undefined },
        { title: 'Checagens', href: '/checagens', icon: ClipboardCheck, stat: stats ? `${stats.checklists} checagem${stats.checklists === 1 ? '' : 's'}` : undefined },
        { title: 'Boards', href: '/producao-boards', icon: Factory },
      ],
    },
    {
      sector: 'Site & TI', sectorIcon: Monitor, accent: 'from-cyan-500/15 to-cyan-500/5 text-cyan-500',
      items: [
        { title: 'Melhorias', href: '/melhorias', icon: Monitor, stat: stats ? `${stats.openMelhorias} aberta${stats.openMelhorias === 1 ? '' : 's'}` : undefined },
        { title: 'Tickets', href: '/tickets', icon: Briefcase, stat: stats ? `${stats.openTickets} aberto${stats.openTickets === 1 ? '' : 's'}` : undefined },
      ],
    },
    {
      sector: 'Comercial', sectorIcon: ShoppingCart, accent: 'from-lime-500/15 to-lime-500/5 text-lime-600',
      items: [
        { title: 'Atacado', href: '/comercial', icon: ShoppingCart },
      ],
    },
    {
      sector: 'SAC & Expedição', sectorIcon: Package, accent: 'from-yellow-500/15 to-yellow-500/5 text-yellow-600',
      items: [
        { title: 'Pedidos', href: '/pedidos', icon: Package },
      ],
    },
    {
      sector: 'Financeiro', sectorIcon: DollarSign, accent: 'from-green-500/15 to-green-500/5 text-green-600',
      items: [
        { title: 'Financeiro', href: '/financeiro', icon: DollarSign },
      ],
    },
    {
      sector: 'Internacional', sectorIcon: Plane, accent: 'from-sky-500/15 to-sky-500/5 text-sky-500',
      items: [
        { title: 'Internacional', href: '/internacional', icon: Plane },
      ],
    },
    {
      sector: 'Ações Mensais', sectorIcon: CalendarDays, accent: 'from-sky-500/15 to-sky-500/5 text-sky-600',
      items: [
        { title: 'Calendário', href: '/calendario', icon: CalendarDays, stat: stats ? `${stats.yearEvents} evento${stats.yearEvents === 1 ? '' : 's'}` : undefined },
      ],
    },
  ];

  const fmtTime = (iso?: string) => iso
    ? new Date(iso).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null;
  const fmtDay = (d?: string | null) => d
    ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : null;

  const hasToday = stats && (stats.nextTaskTitle || stats.nextBooking || stats.nextStage);

  return (
    <div className="space-y-6">
      <NotificationPermissionBanner />

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

      {/* KPIs da semana — visível para managers+ */}
      <KPIPanel />

      {/* Painel executivo — visível para directors+ */}
      <ExecutivePanel />

      {/* Painel pessoal — em atraso, agenda, mensagens, CRM */}
      <PersonalPanel />

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Módulos</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sectors.map((s) => (
            <Card key={s.sector} className="p-5 h-full border-border/60 hover:shadow-md transition-all hover:-translate-y-0.5">
              <div className="flex items-center gap-3 mb-4">
                <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${s.accent} flex items-center justify-center shrink-0`}>
                  <s.sectorIcon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-foreground">{s.sector}</h3>
              </div>
              <div className="space-y-1">
                {s.items.map((item) => (
                  <Link
                    key={item.title}
                    to={item.href}
                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-accent/50 transition-colors group"
                  >
                    <item.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm text-foreground group-hover:text-primary transition-colors flex-1 truncate">
                      {item.title}
                    </span>
                    {item.stat && (
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        {isLoading ? '…' : item.stat}
                      </span>
                    )}
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                  </Link>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>
      <OnboardingTour />
    </div>
  );
}
