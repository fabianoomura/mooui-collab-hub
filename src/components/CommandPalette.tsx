import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput,
  CommandItem, CommandList, CommandSeparator,
} from '@/components/ui/command';
import {
  Table2, MessageSquare, BookOpen, Calendar, CalendarDays, Rocket,
  Briefcase, ClipboardCheck, Home, Users, Settings,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';

const ROUTES = [
  { label: 'Início', href: '/', icon: Home, kw: 'home dashboard inicio' },
  { label: 'Projetos', href: '/projetos', icon: Table2, kw: 'monday tarefas' },
  { label: 'Mensagens', href: '/mensagens', icon: MessageSquare, kw: 'slack chat' },
  { label: 'Documentação', href: '/docs', icon: BookOpen, kw: 'notinha notion' },
  { label: 'Salas', href: '/salas', icon: Calendar, kw: 'reserva reuniao' },
  { label: 'Calendário', href: '/calendario', icon: CalendarDays, kw: 'eventos ano' },
  { label: 'Lançamentos', href: '/lancamentos', icon: Rocket, kw: 'launches etapas' },
  { label: 'Checagem Site', href: '/checagens', icon: ClipboardCheck, kw: 'checklist' },
  { label: 'CRM', href: '/crm', icon: Briefcase, kw: 'vendas funil atacado arquiteto' },
  { label: 'Equipe', href: '/equipe', icon: Users, kw: 'team usuarios' },
  { label: 'Configurações', href: '/configuracoes', icon: Settings, kw: 'settings' },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { currentOrg } = useOrganization();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const { data: launches = [] } = useQuery({
    queryKey: ['cmdk-launches', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return [];
      const { data } = await supabase.from('launches').select('id, name')
        .eq('organization_id', currentOrg.id).limit(20);
      return data ?? [];
    },
    enabled: !!currentOrg && open,
  });

  const { data: deals = [] } = useQuery({
    queryKey: ['cmdk-deals', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return [];
      const { data } = await supabase.from('crm_deals').select('id, title')
        .eq('organization_id', currentOrg.id).eq('status', 'open').limit(20);
      return data ?? [];
    },
    enabled: !!currentOrg && open,
  });

  const go = (path: string) => { setOpen(false); navigate(path); };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Buscar páginas, lançamentos, negócios…" />
      <CommandList>
        <CommandEmpty>Nada encontrado.</CommandEmpty>
        <CommandGroup heading="Navegar">
          {ROUTES.map((r) => (
            <CommandItem key={r.href} value={`${r.label} ${r.kw}`} onSelect={() => go(r.href)}>
              <r.icon className="h-4 w-4 mr-2 text-muted-foreground" />
              {r.label}
            </CommandItem>
          ))}
        </CommandGroup>
        {launches.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Lançamentos">
              {launches.map((l: any) => (
                <CommandItem key={l.id} value={`lancamento ${l.name}`} onSelect={() => go('/lancamentos')}>
                  <Rocket className="h-4 w-4 mr-2 text-muted-foreground" />
                  {l.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
        {deals.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Negócios">
              {deals.map((d: any) => (
                <CommandItem key={d.id} value={`negocio ${d.title}`} onSelect={() => go('/crm')}>
                  <Briefcase className="h-4 w-4 mr-2 text-muted-foreground" />
                  {d.title}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
