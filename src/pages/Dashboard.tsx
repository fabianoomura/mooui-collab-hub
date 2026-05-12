import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Table2, MessageSquare, BookOpen, Calendar, CalendarDays, Rocket, Loader2, ArrowRight, Briefcase, ClipboardCheck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';

type ModuleCard = {
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
  accent: string;
  stat: string;
};

export default function Dashboard() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['home-stats', currentOrg?.id, user?.id],
    queryFn: async () => {
      if (!user || !currentOrg) return null;
      const today = new Date().toISOString().split('T')[0];
      const year = new Date().getFullYear();

      const [tasksRes, unreadRes, docsRes, bookingsRes, eventsRes, launchesRes, dealsRes, checklistsRes] = await Promise.all([
        supabase.from('task_assignees').select('task_id').eq('user_id', user.id),
        supabase.from('messages').select('id', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 86400000).toISOString()),
        supabase.from('doc_pages').select('id', { count: 'exact', head: true }).eq('organization_id', currentOrg.id),
        supabase.from('meeting_room_bookings').select('id', { count: 'exact', head: true }).eq('organization_id', currentOrg.id).gte('starts_at', new Date().toISOString()),
        supabase.from('annual_events').select('id', { count: 'exact', head: true }).eq('organization_id', currentOrg.id).gte('start_date', `${year}-01-01`).lte('start_date', `${year}-12-31`),
        supabase.from('launches').select('id', { count: 'exact', head: true }).eq('organization_id', currentOrg.id).eq('status', 'active'),
        supabase.from('crm_deals').select('id', { count: 'exact', head: true }).eq('organization_id', currentOrg.id).eq('status', 'open'),
        supabase.from('launch_checklists').select('id', { count: 'exact', head: true }).eq('organization_id', currentOrg.id),
      ]);

      let myOpenTasks = 0;
      if (tasksRes.data?.length) {
        const ids = tasksRes.data.map(a => a.task_id);
        const { count } = await supabase.from('tasks').select('id', { count: 'exact', head: true }).in('id', ids).neq('status', 'done');
        myOpenTasks = count ?? 0;
      }

      return {
        myOpenTasks,
        recentMessages: unreadRes.count ?? 0,
        docs: docsRes.count ?? 0,
        upcomingBookings: bookingsRes.count ?? 0,
        yearEvents: eventsRes.count ?? 0,
        activeLaunches: launchesRes.count ?? 0,
        openDeals: dealsRes.count ?? 0,
        checklists: checklistsRes.count ?? 0,
      };
    },
    enabled: !!user && !!currentOrg,
  });

  const cards: ModuleCard[] = [
    {
      title: 'Monday',
      description: 'Projetos e tarefas',
      href: '/projetos',
      icon: Table2,
      accent: 'from-pink-500/15 to-pink-500/5 text-pink-500',
      stat: stats ? `${stats.myOpenTasks} tarefa${stats.myOpenTasks === 1 ? '' : 's'} sua${stats.myOpenTasks === 1 ? '' : 's'}` : '—',
    },
    {
      title: 'Slack',
      description: 'Mensagens da equipe',
      href: '/mensagens',
      icon: MessageSquare,
      accent: 'from-violet-500/15 to-violet-500/5 text-violet-500',
      stat: stats ? `${stats.recentMessages} mensagens 24h` : '—',
    },
    {
      title: 'Notinha',
      description: 'Documentação',
      href: '/docs',
      icon: BookOpen,
      accent: 'from-amber-500/15 to-amber-500/5 text-amber-600',
      stat: stats ? `${stats.docs} documento${stats.docs === 1 ? '' : 's'}` : '—',
    },
    {
      title: 'Reserva de Sala',
      description: 'Salas de reunião',
      href: '/salas',
      icon: Calendar,
      accent: 'from-emerald-500/15 to-emerald-500/5 text-emerald-600',
      stat: stats ? `${stats.upcomingBookings} reserva${stats.upcomingBookings === 1 ? '' : 's'} agendada${stats.upcomingBookings === 1 ? '' : 's'}` : '—',
    },
    {
      title: 'Calendário Anual',
      description: 'Planejamento do ano',
      href: '/calendario',
      icon: CalendarDays,
      accent: 'from-sky-500/15 to-sky-500/5 text-sky-600',
      stat: stats ? `${stats.yearEvents} evento${stats.yearEvents === 1 ? '' : 's'} em ${new Date().getFullYear()}` : '—',
    },
    {
      title: 'Lançamentos',
      description: 'Etapas, prazos e gargalos',
      href: '/lancamentos',
      icon: Rocket,
      accent: 'from-rose-500/15 to-rose-500/5 text-rose-600',
      stat: stats ? `${stats.activeLaunches} ativo${stats.activeLaunches === 1 ? '' : 's'}` : '—',
    },
    {
      title: 'Checagem Site',
      description: 'Checklist de lançamento no site',
      href: '/checagens',
      icon: ClipboardCheck,
      accent: 'from-teal-500/15 to-teal-500/5 text-teal-600',
      stat: stats ? `${stats.checklists} checagem${stats.checklists === 1 ? '' : 's'}` : '—',
    },
    {
      title: 'CRM',
      description: 'Atacado e arquitetos',
      href: '/crm',
      icon: Briefcase,
      accent: 'from-indigo-500/15 to-indigo-500/5 text-indigo-600',
      stat: stats ? `${stats.openDeals} negócio${stats.openDeals === 1 ? '' : 's'} aberto${stats.openDeals === 1 ? '' : 's'}` : '—',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Início</h1>
        <p className="text-muted-foreground text-sm mt-1">Acesso rápido aos módulos da plataforma</p>
      </div>

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
                {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : c.stat}
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
