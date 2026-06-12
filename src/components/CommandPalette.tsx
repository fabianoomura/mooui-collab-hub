import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput,
  CommandItem, CommandList, CommandSeparator,
} from '@/components/ui/command';
import {
  Table2, MessageSquare, BookOpen, Calendar, CalendarDays, Rocket,
  Briefcase, ClipboardCheck, Home, Users, Settings, ListTodo, Package, Bug, Layers,
  Wrench, FileText, Camera, ShoppingBag,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';

const ROUTES = [
  { label: 'Início', href: '/', icon: Home, kw: 'home dashboard inicio' },
  { label: 'Sunday', href: '/projetos', icon: Table2, kw: 'monday projetos tarefas' },
  { label: 'Speaks', href: '/mensagens', icon: MessageSquare, kw: 'slack chat mensagens' },
  { label: 'Papelinho', href: '/docs', icon: BookOpen, kw: 'notinha notion docs documentação' },
  { label: 'Salas', href: '/salas', icon: Calendar, kw: 'reserva reuniao' },
  { label: 'Calendário de Ações Mensais', href: '/calendario', icon: CalendarDays, kw: 'acoes mensais calendario eventos ano' },
  { label: 'Produção', href: '/lancamentos', icon: Rocket, kw: 'launches etapas lancamentos producao' },
  { label: 'Check Lançamentos', href: '/checagens', icon: ClipboardCheck, kw: 'checklist checagem site' },
  { label: 'Tickets de TI', href: '/tickets', icon: Briefcase, kw: 'suporte bug ti chamado' },
  { label: 'Pedidos', href: '/pedidos', icon: Package, kw: 'orders sac expedição' },
  { label: 'Melhorias', href: '/melhorias', icon: Wrench, kw: 'site shopify seo melhorias' },
  { label: 'Programacao', href: '/programacao', icon: Camera, kw: 'programacao conteudo posts redes sociais calendario kanban' },
  { label: 'Newsletters', href: '/newsletters', icon: FileText, kw: 'newsletter email brasil barcelona' },
  { label: 'Demandas Marketing', href: '/demandas-marketing', icon: FileText, kw: 'demandas marketing pautas subelementos' },
  { label: 'Sessões', href: '/sessoes', icon: Camera, kw: 'sessoes fotos videos shots' },
  { label: 'Produtos', href: '/produtos', icon: ShoppingBag, kw: 'produtos pipeline design novos' },
  { label: 'Design', href: '/design', icon: ShoppingBag, kw: 'design colecao demandas' },
  { label: 'Comercial', href: '/comercial', icon: Package, kw: 'atacado feiras b2b comercial' },
  { label: 'Financeiro', href: '/financeiro', icon: Package, kw: 'financeiro caixa fluxo' },
  { label: 'Internacional', href: '/internacional', icon: Layers, kw: 'internacional expansao global' },
  { label: 'Produção Boards', href: '/producao-boards', icon: Rocket, kw: 'producao folders compras boards' },
  { label: 'Timeline', href: '/timeline', icon: Layers, kw: 'timeline visao unificada panorama' },
  { label: 'Equipe', href: '/equipe', icon: Users, kw: 'team usuarios' },
  { label: 'Configurações', href: '/configuracoes', icon: Settings, kw: 'settings' },
];

function useDebounce(value: string, ms = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const { currentOrg } = useOrganization();

  const debouncedSearch = useDebounce(search, 300);
  const hasSearch = debouncedSearch.length >= 2;

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

  // Reset search on close
  useEffect(() => { if (!open) setSearch(''); }, [open]);

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

  // Global search queries — only fire with 2+ chars, debounced
  const { data: tasks = [] } = useQuery({
    queryKey: ['cmdk-tasks', currentOrg?.id, debouncedSearch],
    queryFn: async () => {
      if (!currentOrg) return [];
      const { data } = await supabase.from('tasks')
        .select('id, title, project_id')
        .ilike('title', `%${debouncedSearch}%`)
        .limit(8);
      return data ?? [];
    },
    enabled: !!currentOrg && open && hasSearch,
  });

  const { data: tickets = [] } = useQuery({
    queryKey: ['cmdk-tickets', currentOrg?.id, debouncedSearch],
    queryFn: async () => {
      if (!currentOrg) return [];
      const { data } = await supabase.from('tickets')
        .select('id, title')
        .eq('organization_id', currentOrg.id)
        .ilike('title', `%${debouncedSearch}%`)
        .limit(8);
      return data ?? [];
    },
    enabled: !!currentOrg && open && hasSearch,
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['cmdk-orders', currentOrg?.id, debouncedSearch],
    queryFn: async () => {
      if (!currentOrg) return [];
      const { data } = await supabase.from('orders' as any)
        .select('id, title, code')
        .eq('organization_id', currentOrg.id)
        .ilike('title', `%${debouncedSearch}%`)
        .limit(8);
      return (data ?? []) as any[];
    },
    enabled: !!currentOrg && open && hasSearch,
  });

  const { data: docs = [] } = useQuery({
    queryKey: ['cmdk-docs', currentOrg?.id, debouncedSearch],
    queryFn: async () => {
      if (!currentOrg) return [];
      const { data } = await supabase.from('doc_pages')
        .select('id, title')
        .eq('organization_id', currentOrg.id)
        .ilike('title', `%${debouncedSearch}%`)
        .limit(8);
      return data ?? [];
    },
    enabled: !!currentOrg && open && hasSearch,
  });

  // Module search — query tasks from Sunday "Modulo | ..." boards
  const { data: moduleProjects = [] } = useQuery({
    queryKey: ['cmdk-mod-projects', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return [];
      const { data } = await supabase.from('projects').select('id, name')
        .eq('organization_id', currentOrg.id).ilike('name', 'Modulo | %');
      return data ?? [];
    },
    enabled: !!currentOrg && open,
    staleTime: 300_000,
  });

  const moduleProjectIds = moduleProjects.map((p) => p.id);
  const projectNameById = Object.fromEntries(moduleProjects.map((p) => [p.id, p.name]));

  const { data: moduleSearchResults = [] } = useQuery({
    queryKey: ['cmdk-module-tasks', currentOrg?.id, debouncedSearch, moduleProjectIds.join(',')],
    queryFn: async () => {
      if (!currentOrg || !moduleProjectIds.length) return [];
      const { data } = await supabase.from('tasks')
        .select('id, title, project_id')
        .in('project_id', moduleProjectIds)
        .is('archived_at', null)
        .is('parent_task_id', null)
        .ilike('title', `%${debouncedSearch}%`)
        .limit(24);
      return (data ?? []).map((t) => ({ ...t, projectName: projectNameById[t.project_id] || '' }));
    },
    enabled: !!currentOrg && open && hasSearch && moduleProjectIds.length > 0,
  });

  const categorize = (projectName: string) => {
    const l = projectName.toLowerCase();
    if (l.includes('melhorias')) return 'melhorias';
    if (l.includes('programacao')) return 'conteudos';
    if (l.includes('newsletters')) return 'conteudos';
    if (l.includes('demandas')) return 'conteudos';
    if (l.includes('sessoes')) return 'sessoes';
    if (l.includes('produtos')) return 'produtos';
    return 'other';
  };

  const melhorias = moduleSearchResults.filter((t) => categorize(t.projectName) === 'melhorias');
  const conteudos = moduleSearchResults.filter((t) => categorize(t.projectName) === 'conteudos');
  const sessoes = moduleSearchResults.filter((t) => categorize(t.projectName) === 'sessoes');
  const produtos = moduleSearchResults.filter((t) => categorize(t.projectName) === 'produtos');

  const go = (path: string) => { setOpen(false); navigate(path); };

  const hasResults = tasks.length > 0 || tickets.length > 0 || orders.length > 0 || docs.length > 0
    || melhorias.length > 0 || conteudos.length > 0 || sessoes.length > 0 || produtos.length > 0;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Buscar páginas, tarefas, melhorias, conteúdo, produtos…"
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>Nada encontrado.</CommandEmpty>

        {/* Global search results */}
        {hasSearch && hasResults && (
          <>
            {tasks.length > 0 && (
              <CommandGroup heading="Tarefas">
                {tasks.map((t: any) => (
                  <CommandItem key={t.id} value={`tarefa ${t.title}`} onSelect={() => go('/projetos')}>
                    <ListTodo className="h-4 w-4 mr-2 text-blue-500" />
                    {t.title}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {tickets.length > 0 && (
              <CommandGroup heading="Tickets">
                {tickets.map((t: any) => (
                  <CommandItem key={t.id} value={`ticket ${t.title}`} onSelect={() => go('/tickets')}>
                    <Bug className="h-4 w-4 mr-2 text-red-500" />
                    {t.title}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {orders.length > 0 && (
              <CommandGroup heading="Pedidos">
                {orders.map((o: any) => (
                  <CommandItem key={o.id} value={`pedido ${o.title} ${o.code || ''}`} onSelect={() => go('/pedidos')}>
                    <Package className="h-4 w-4 mr-2 text-orange-500" />
                    {o.code ? `#${o.code} — ` : ''}{o.title}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {docs.length > 0 && (
              <CommandGroup heading="Docs">
                {docs.map((d: any) => (
                  <CommandItem key={d.id} value={`doc ${d.title}`} onSelect={() => go('/docs')}>
                    <BookOpen className="h-4 w-4 mr-2 text-emerald-500" />
                    {d.title}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {melhorias.length > 0 && (
              <CommandGroup heading="Melhorias">
                {melhorias.map((m: any) => (
                  <CommandItem key={m.id} value={`melhoria ${m.title}`} onSelect={() => go('/melhorias')}>
                    <Wrench className="h-4 w-4 mr-2 text-violet-500" />
                    {m.title}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {conteudos.length > 0 && (
              <CommandGroup heading="Conteúdo">
                {conteudos.map((c: any) => (
                  <CommandItem key={c.id} value={`conteudo ${c.title}`} onSelect={() => go('/programacao')}>
                    <FileText className="h-4 w-4 mr-2 text-pink-500" />
                    {c.title}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {sessoes.length > 0 && (
              <CommandGroup heading="Sessões">
                {sessoes.map((s: any) => (
                  <CommandItem key={s.id} value={`sessao ${s.title}`} onSelect={() => go('/sessoes')}>
                    <Camera className="h-4 w-4 mr-2 text-cyan-500" />
                    {s.title}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {produtos.length > 0 && (
              <CommandGroup heading="Produtos">
                {produtos.map((p: any) => (
                  <CommandItem key={p.id} value={`produto ${p.title}`} onSelect={() => go('/produtos')}>
                    <ShoppingBag className="h-4 w-4 mr-2 text-amber-500" />
                    {p.title}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            <CommandSeparator />
          </>
        )}

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
            <CommandGroup heading="Produção">
              {launches.map((l: any) => (
                <CommandItem key={l.id} value={`lancamento ${l.name}`} onSelect={() => go('/lancamentos')}>
                  <Rocket className="h-4 w-4 mr-2 text-muted-foreground" />
                  {l.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
