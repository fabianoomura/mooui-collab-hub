import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ChevronLeft, ChevronRight, Plus, Trash2, Search, LayoutGrid, GanttChart, CalendarRange } from 'lucide-react';
import {
  useAnnualEvents, useCreateAnnualEvent, useUpdateAnnualEvent, useDeleteAnnualEvent, type AnnualEvent,
} from '@/hooks/useAnnualEvents';
import {
  defaultEventEtapas, useEventEtapas, useSeedEventEtapas, useUpdateEventEtapa,
  type EventEtapa, type EventEtapaStatus,
} from '@/hooks/useEventEtapas';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { useConfirm } from '@/components/ConfirmDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ModuleInstanceBar, useActiveInstance } from '@/components/ModuleInstanceBar';
import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/integrations/supabase/client';

const CATEGORIES = [
  { value: 'lancamento', label: 'Lançamento', color: '#D6336C' },
  { value: 'acao', label: 'Ação', color: '#2563EB' },
  { value: 'marco', label: 'Marco', color: '#16A34A' },
  { value: 'data', label: 'Data importante', color: '#F59E0B' },
];
const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
type MarketingCalendarOrigin = 'calendar' | 'conteudo' | 'sessao';
type MarketingCalendarItem = AnnualEvent & {
  origin: MarketingCalendarOrigin;
  originLabel: string;
  originDetail?: string;
  readonly?: boolean;
};

const ORIGIN_LABELS: Record<MarketingCalendarOrigin, string> = {
  calendar: 'Calendario',
  conteudo: 'Conteudo',
  sessao: 'Sessao',
};

const ETAPA_STATUS_LABELS: Record<EventEtapaStatus, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em andamento',
  concluida: 'Concluida',
};

export default function CalendarPage() {
  const { currentOrg } = useOrganization();
  const [year, setYear] = useState(new Date().getFullYear());
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', description: '', category: 'acao', start_date: '', end_date: '' });
  const [search, setSearch] = useState('');
  const [activeCats, setActiveCats] = useState<string[]>([]);

  const { activeId: activeInstance, setActive: setActiveInstance } = useActiveInstance('calendario');
  const { data: events = [], isLoading } = useAnnualEvents(year, activeInstance);
  const { data: conteudos = [] } = useQuery({
    queryKey: ['calendar-origin-conteudo', currentOrg?.id, year],
    queryFn: async () => {
      if (!currentOrg) return [];
      const { data, error } = await supabase
        .from('conteudo_items' as any)
        .select('id, title, channel, content_type, status, scheduled_date')
        .eq('organization_id', currentOrg.id)
        .gte('scheduled_date', `${year}-01-01`)
        .lte('scheduled_date', `${year}-12-31`);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentOrg,
  });
  const { data: sessoes = [] } = useQuery({
    queryKey: ['calendar-origin-sessoes', currentOrg?.id, year],
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
  const createEvt = useCreateAnnualEvent();
  const updateEvt = useUpdateAnnualEvent();
  const deleteEvt = useDeleteAnnualEvent();
  const seedEtapas = useSeedEventEtapas();
  const confirm = useConfirm();

  const { data: orgMembers = [] } = useQuery({
    queryKey: ['org-members-calendar-etapas', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return [];
      const { data } = await supabase.from('organization_members').select('user_id').eq('organization_id', currentOrg.id);
      const ids = (data || []).map((m: any) => m.user_id);
      if (ids.length === 0) return [];
      const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', ids);
      return profiles || [];
    },
    enabled: !!currentOrg,
  });

  const today = new Date();
  const currentMonth = today.getMonth();
  const isCurrentYear = year === today.getFullYear();

  const calendarItems = useMemo<MarketingCalendarItem[]>(() => {
    const annualItems = events.map((event) => ({
      ...event,
      origin: 'calendar' as const,
      originLabel: ORIGIN_LABELS.calendar,
      originDetail: CATEGORIES.find((category) => category.value === event.category)?.label || event.category,
    }));
    const contentItems = (conteudos as any[])
      .filter((item) => item.scheduled_date)
      .map((item) => ({
        id: `conteudo-${item.id}`,
        organization_id: currentOrg?.id || '',
        title: item.title,
        description: item.content_type || item.status || null,
        category: 'conteudo',
        color: '#ec4899',
        start_date: item.scheduled_date,
        end_date: null,
        project_id: null,
        created_by: '',
        created_at: '',
        updated_at: '',
        origin: 'conteudo' as const,
        originLabel: ORIGIN_LABELS.conteudo,
        originDetail: [item.channel, item.content_type].filter(Boolean).join(' / '),
        readonly: true,
      }));
    const sessionItems = (sessoes as any[])
      .filter((item) => item.scheduled_date)
      .map((item) => ({
        id: `sessao-${item.id}`,
        organization_id: currentOrg?.id || '',
        title: item.title,
        description: item.professional || item.status || null,
        category: 'sessao',
        color: '#8b5cf6',
        start_date: item.scheduled_date,
        end_date: null,
        project_id: null,
        created_by: '',
        created_at: '',
        updated_at: '',
        origin: 'sessao' as const,
        originLabel: ORIGIN_LABELS.sessao,
        originDetail: item.professional || item.status,
        readonly: true,
      }));
    return [...annualItems, ...contentItems, ...sessionItems];
  }, [events, conteudos, sessoes, currentOrg?.id]);

  const filtered = useMemo(() => {
    return calendarItems.filter((e) => {
      if (activeCats.length && (e.origin !== 'calendar' || !activeCats.includes(e.category))) return false;
      if (search.trim() && !`${e.title} ${e.originLabel} ${e.originDetail || ''}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [calendarItems, activeCats, search]);

  const byMonth = useMemo(() => {
    const map: Record<number, MarketingCalendarItem[]> = {};
    for (let i = 0; i < 12; i++) map[i] = [];
    filtered.forEach(e => {
      const startM = new Date(e.start_date + 'T00:00:00').getMonth();
      const endM = e.end_date ? new Date(e.end_date + 'T00:00:00').getMonth() : startM;
      // Span a faixa em todos os meses cobertos
      for (let m = startM; m <= endM; m++) map[m].push(e);
    });
    return map;
  }, [filtered]);

  const openNew = (monthIdx?: number) => {
    const m = monthIdx ?? new Date().getMonth();
    const dd = String(new Date().getDate()).padStart(2, '0');
    const mm = String(m + 1).padStart(2, '0');
    setEditingId(null);
    setForm({ title: '', description: '', category: 'acao', start_date: `${year}-${mm}-${dd}`, end_date: '' });
    setOpen(true);
  };

  const openEdit = (e: AnnualEvent) => {
    setEditingId(e.id);
    setForm({
      title: e.title,
      description: e.description || '',
      category: e.category,
      start_date: e.start_date,
      end_date: e.end_date || '',
    });
    setOpen(true);
  };

  const openCalendarItem = (item: MarketingCalendarItem) => {
    if (item.origin === 'calendar') {
      openEdit(item);
      return;
    }
    toast.info(`Origem: ${item.originLabel}${item.originDetail ? ` - ${item.originDetail}` : ''}`);
  };

  const handleSave = () => {
    if (!form.title.trim() || !form.start_date) return;
    const cat = CATEGORIES.find(c => c.value === form.category)!;
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      category: form.category,
      color: cat.color,
      start_date: form.start_date,
      end_date: form.end_date || null,
    };
    if (editingId) {
      updateEvt.mutate({ id: editingId, ...payload }, {
        onSuccess: () => { toast.success('Evento atualizado'); setOpen(false); },
        onError: (e: any) => toast.error(e.message),
      });
    } else {
      createEvt.mutate({ ...payload, project_id: null, instance_id: activeInstance ?? null } as any, {
        onSuccess: (created: any) => {
          if (created?.id) seedEtapas.mutate(created.id);
          toast.success('Evento criado');
          setOpen(false);
        },
        onError: (e: any) => toast.error(e.message),
      });
    }
  };

  const handleDelete = async () => {
    if (!editingId) return;
    const ok = await confirm({ title: 'Excluir este evento?', destructive: true, confirmText: 'Excluir' });
    if (!ok) return;
    deleteEvt.mutate(editingId, {
      onSuccess: () => { toast.success('Evento excluído'); setOpen(false); },
      onError: (e: any) => toast.error(e.message),
    });
  };

  const toggleCat = (c: string) =>
    setActiveCats(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);

  return (
    <div className="space-y-4">
      <PageHeader
        crumbs={[{ label: 'Início', to: '/' }, { label: 'Calendário de Marketing' }]}
        title="Calendário de Marketing"
        subtitle="Planejamento de lançamentos, ações e datas-chave"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="icon" onClick={() => setYear(y => y - 1)}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="text-base sm:text-lg font-semibold w-14 text-center">{year}</span>
            <Button variant="outline" size="icon" onClick={() => setYear(y => y + 1)}><ChevronRight className="h-4 w-4" /></Button>
            <Button size="sm" onClick={() => openNew()}>
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Novo evento</span>
            </Button>
          </div>
        }
      />

      <ModuleInstanceBar moduleKey="calendario" value={activeInstance} onChange={setActiveInstance} />

      {/* Search + filter chips */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar evento…"
            className="pl-8 h-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {CATEGORIES.map(c => {
            const active = activeCats.includes(c.value);
            return (
              <button
                key={c.value}
                onClick={() => toggleCat(c.value)}
                className={cn(
                  'text-xs px-2.5 py-1 rounded-full border transition-colors flex items-center gap-1.5',
                  active ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/50',
                )}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
                <span className={active ? 'text-foreground' : 'text-muted-foreground'}>{c.label}</span>
              </button>
            );
          })}
          {activeCats.length > 0 && (
            <button onClick={() => setActiveCats([])} className="text-xs text-muted-foreground hover:text-foreground underline">
              limpar
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-44 w-full" />)}
        </div>
      ) : (
        <Tabs defaultValue="agenda" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="agenda" className="gap-1.5"><CalendarRange className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Próximos 30d</span><span className="sm:hidden">30d</span></TabsTrigger>
            <TabsTrigger value="grid" className="gap-1.5"><LayoutGrid className="h-3.5 w-3.5" /> Grade</TabsTrigger>
            <TabsTrigger value="timeline" className="gap-1.5"><GanttChart className="h-3.5 w-3.5" /> Linha</TabsTrigger>
          </TabsList>

          <TabsContent value="agenda" className="mt-4">
            <AgendaView events={filtered} onEventClick={openCalendarItem} onNew={() => openNew()} />
          </TabsContent>

          <TabsContent value="grid" className="mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {MONTHS.map((m, i) => {
                const isCurrent = isCurrentYear && i === currentMonth;
                return (
                  <Card
                    key={m}
                    className={cn(
                      'p-4 min-h-[180px] flex flex-col',
                      isCurrent && 'ring-2 ring-primary/40 bg-primary/[0.02]',
                    )}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold flex items-center gap-2">
                        {m}
                        {isCurrent && <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full font-medium">hoje</span>}
                      </h3>
                      <button onClick={() => openNew(i)} className="text-muted-foreground hover:text-primary" aria-label="Adicionar evento">
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="space-y-1.5 flex-1">
                      {byMonth[i].length === 0 && (
                        <p className="text-xs text-muted-foreground italic">Sem eventos</p>
                      )}
                      {byMonth[i].map(e => (
                        <button
                          key={`${e.id}-${i}`}
                          onClick={() => openCalendarItem(e)}
                          className="w-full flex items-start gap-2 p-2 rounded-md bg-muted/40 hover:bg-muted text-xs text-left transition-colors"
                        >
                          <div className="h-2 w-2 rounded-full mt-1 shrink-0" style={{ backgroundColor: e.color }} />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{e.title}</div>
                            <div className="mt-0.5">
                              <Badge variant="outline" className="h-4 px-1 text-[9px]">{e.originLabel}</Badge>
                            </div>
                            <div className="text-muted-foreground">
                              {new Date(e.start_date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                              {e.end_date && ` → ${new Date(e.end_date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="timeline" className="mt-4">
            <TimelineView
              year={year}
              events={filtered}
              isCurrentYear={isCurrentYear}
              onEventClick={openCalendarItem}
            />
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? 'Editar evento' : 'Novo evento'}</DialogTitle></DialogHeader>
          <Tabs defaultValue="detalhes">
            <TabsList className={cn('grid w-full', editingId ? 'grid-cols-2' : 'grid-cols-1')}>
              <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
              {editingId && <TabsTrigger value="etapas">Etapas</TabsTrigger>}
            </TabsList>
            <TabsContent value="detalhes" className="mt-4">
              <div className="space-y-3">
                <div>
                  <Label>Título</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
                </div>
                <div>
                  <Label>Categoria</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => (
                        <SelectItem key={c.value} value={c.value}>
                          <span className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                            {c.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Data início</Label>
                    <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                  </div>
                  <div>
                    <Label>Data fim (opcional)</Label>
                    <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
              </div>
            </TabsContent>
            {editingId && (
              <TabsContent value="etapas" className="mt-4">
                <EventEtapasEditor eventId={editingId} orgMembers={orgMembers as any[]} />
              </TabsContent>
            )}
          </Tabs>
          <DialogFooter className="gap-2 sm:justify-between">
            {editingId ? (
              <Button variant="ghost" onClick={handleDelete} className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4 mr-1" /> Excluir
              </Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={!form.title.trim() || createEvt.isPending || updateEvt.isPending}>
                {editingId ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EventEtapasEditor({ eventId, orgMembers }: {
  eventId: string;
  orgMembers: { id: string; full_name: string | null }[];
}) {
  const { data: etapas = [] } = useEventEtapas(eventId);
  const seedEtapas = useSeedEventEtapas();
  const updateEtapa = useUpdateEventEtapa();

  const rows = etapas.length ? etapas : defaultEventEtapas.map((etapa) => ({
    id: etapa.etapa_key,
    event_id: eventId,
    status: 'pendente' as EventEtapaStatus,
    responsavel: null,
    created_at: '',
    updated_at: '',
    ...etapa,
  } satisfies EventEtapa));

  return (
    <div className="space-y-3">
      {etapas.length === 0 && (
        <div className="rounded-md border bg-muted/30 p-3 flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">Este evento ainda nao tem etapas.</p>
          <Button size="sm" onClick={() => seedEtapas.mutate(eventId)}>Criar etapas</Button>
        </div>
      )}
      <div className="space-y-2">
        {rows.map((etapa) => {
          const persisted = etapas.some((item) => item.id === etapa.id);
          return (
            <div key={etapa.etapa_key} className="grid sm:grid-cols-[1fr_150px_160px] gap-2 rounded-md border p-2">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{etapa.title}</div>
                <div className="text-[10px] text-muted-foreground font-mono">{etapa.etapa_key}</div>
              </div>
              <Select
                value={etapa.status}
                disabled={!persisted}
                onValueChange={(status) => updateEtapa.mutate({ id: etapa.id, event_id: eventId, status: status as EventEtapaStatus })}
              >
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(ETAPA_STATUS_LABELS) as EventEtapaStatus[]).map((key) => (
                    <SelectItem key={key} value={key}>{ETAPA_STATUS_LABELS[key]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={etapa.responsavel || '_none'}
                disabled={!persisted}
                onValueChange={(responsavel) => updateEtapa.mutate({ id: etapa.id, event_id: eventId, responsavel: responsavel === '_none' ? null : responsavel } as any)}
              >
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Ninguem</SelectItem>
                  {orgMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>{member.full_name || 'Usuario'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function dayOfYear(d: Date) {
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d.getTime() - start.getTime();
  return Math.floor(diff / 86400000);
}

function TimelineView({
  year, events, isCurrentYear, onEventClick,
}: {
  year: number;
  events: MarketingCalendarItem[];
  isCurrentYear: boolean;
  onEventClick: (e: MarketingCalendarItem) => void;
}) {
  const totalDays = ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0) ? 366 : 365;

  const sorted = useMemo(
    () => [...events].sort((a, b) => a.start_date.localeCompare(b.start_date)),
    [events]
  );

  const todayPct = useMemo(() => {
    if (!isCurrentYear) return null;
    return (dayOfYear(new Date()) / totalDays) * 100;
  }, [isCurrentYear, totalDays]);

  // Month boundaries as percentage
  const monthMarkers = useMemo(() => {
    const arr: { label: string; pct: number; widthPct: number }[] = [];
    for (let m = 0; m < 12; m++) {
      const startDay = dayOfYear(new Date(year, m, 1));
      const endDay = m === 11 ? totalDays : dayOfYear(new Date(year, m + 1, 1));
      arr.push({
        label: MONTHS[m],
        pct: (startDay / totalDays) * 100,
        widthPct: ((endDay - startDay) / totalDays) * 100,
      });
    }
    return arr;
  }, [year, totalDays]);

  return (
    <Card className="p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-[900px]">
          {/* Header com meses */}
          <div className="sticky top-0 z-10 bg-card border-b">
            <div className="flex">
              <div className="w-44 sm:w-56 shrink-0 px-3 py-2 text-xs font-semibold text-muted-foreground border-r">
                Evento
              </div>
              <div className="relative flex-1">
                <div className="flex h-9">
                  {monthMarkers.map((m, i) => (
                    <div
                      key={m.label}
                      className={cn(
                        'flex items-center justify-center text-xs font-medium border-r last:border-r-0',
                        isCurrentYear && i === new Date().getMonth() ? 'text-primary' : 'text-muted-foreground'
                      )}
                      style={{ width: `${m.widthPct}%` }}
                    >
                      {m.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Linhas */}
          {sorted.length === 0 && (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              Nenhum evento no período
            </div>
          )}
          <TooltipProvider delayDuration={200}>
            {sorted.map((e) => {
              const startD = new Date(e.start_date + 'T00:00:00');
              const endD = e.end_date ? new Date(e.end_date + 'T00:00:00') : startD;
              // Clamp to year
              const yStart = new Date(year, 0, 1);
              const yEnd = new Date(year, 11, 31);
              const s = startD < yStart ? yStart : startD;
              const en = endD > yEnd ? yEnd : endD;
              const startPct = (dayOfYear(s) / totalDays) * 100;
              const widthPct = Math.max(((dayOfYear(en) - dayOfYear(s) + 1) / totalDays) * 100, 0.6);

              return (
                <div key={e.id} className="flex items-center border-b last:border-b-0 hover:bg-muted/30 transition-colors group">
                  <div className="w-44 sm:w-56 shrink-0 px-3 py-2.5 border-r">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: e.color }} />
                      <span className="text-xs font-medium truncate">{e.title}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate ml-4">{e.originLabel}{e.originDetail ? ` - ${e.originDetail}` : ''}</div>
                  </div>
                  <div className="relative flex-1 h-10">
                    {/* Month gridlines */}
                    {monthMarkers.map((m, i) => (
                      <div
                        key={i}
                        className="absolute top-0 bottom-0 border-r border-border/40"
                        style={{ left: `${m.pct + m.widthPct}%` }}
                      />
                    ))}
                    {/* Today line */}
                    {todayPct !== null && (
                      <div
                        className="absolute top-0 bottom-0 w-px bg-primary/60 z-10"
                        style={{ left: `${todayPct}%` }}
                      />
                    )}
                    {/* Bar */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => onEventClick(e)}
                          className="absolute top-1/2 -translate-y-1/2 h-6 rounded-md shadow-sm hover:shadow-md hover:brightness-110 transition-all flex items-center px-2 overflow-hidden"
                          style={{
                            left: `${startPct}%`,
                            width: `${widthPct}%`,
                            backgroundColor: e.color,
                            minWidth: '8px',
                          }}
                        >
                          <span className="text-[10px] font-medium text-white truncate whitespace-nowrap">
                            {e.title}
                          </span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <div className="text-xs">
                          <div className="font-semibold">{e.title}</div>
                          <div className="text-muted-foreground">Origem: {e.originLabel}{e.originDetail ? ` - ${e.originDetail}` : ''}</div>
                          <div className="text-muted-foreground">
                            {startD.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                            {e.end_date && ` → ${endD.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`}
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              );
            })}
          </TooltipProvider>

      {/* Legenda */}
      <div className="px-3 py-2 border-t flex items-center gap-3 flex-wrap text-xs text-muted-foreground bg-muted/20">
        {todayPct !== null && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-px h-3 bg-primary" /> hoje
          </span>
        )}
        <span>{sorted.length} evento{sorted.length !== 1 ? 's' : ''} em {year}</span>
      </div>
        </div>
      </div>
    </Card>
  );
}

function AgendaView({
  events, onEventClick, onNew,
}: {
  events: MarketingCalendarItem[];
  onEventClick: (e: MarketingCalendarItem) => void;
  onNew: () => void;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + 30);

  const upcoming = useMemo(() => {
    return events
      .map(e => {
        const start = new Date(e.start_date + 'T00:00:00');
        const end = e.end_date ? new Date(e.end_date + 'T00:00:00') : start;
        return { e, start, end };
      })
      .filter(({ start, end }) => end >= today && start <= horizon)
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [events]);

  // Group by day key (yyyy-mm-dd of the effective day in the window)
  const groups = useMemo(() => {
    const map = new Map<string, { date: Date; items: typeof upcoming }>();
    upcoming.forEach(item => {
      const effective = item.start < today ? today : item.start;
      const key = effective.toISOString().split('T')[0];
      if (!map.has(key)) map.set(key, { date: effective, items: [] });
      map.get(key)!.items.push(item);
    });
    return Array.from(map.values());
  }, [upcoming]);

  if (upcoming.length === 0) {
    return (
      <Card className="p-10 text-center">
        <CalendarRange className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground mb-3">Nada nos próximos 30 dias</p>
        <Button size="sm" onClick={onNew}><Plus className="h-4 w-4 mr-1" /> Novo evento</Button>
      </Card>
    );
  }

  const dayLabel = (d: Date) => {
    const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
    if (diff === 0) return 'Hoje';
    if (diff === 1) return 'Amanhã';
    return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'short' });
  };

  return (
    <div className="space-y-3">
      {groups.map(({ date, items }) => {
        const key = date.toISOString().split('T')[0];
        const isToday = key === today.toISOString().split('T')[0];
        return (
          <Card key={key} className={cn('p-4', isToday && 'ring-1 ring-primary/40 bg-primary/[0.02]')}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="flex flex-col items-center justify-center w-12 h-12 rounded-md bg-muted/60 shrink-0">
                  <span className="text-[10px] uppercase text-muted-foreground">
                    {date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}
                  </span>
                  <span className="text-base font-semibold leading-none">{date.getDate()}</span>
                </div>
                <div>
                  <div className="text-sm font-semibold capitalize">{dayLabel(date)}</div>
                  <div className="text-xs text-muted-foreground">
                    {items.length} evento{items.length !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              {items.map(({ e, start, end }) => {
                const isRange = e.end_date && end.getTime() !== start.getTime();
                return (
                  <button
                    key={e.id}
                    onClick={() => onEventClick(e)}
                    className="w-full flex items-start gap-3 p-2.5 rounded-md hover:bg-muted/60 transition-colors text-left"
                  >
                    <div className="h-2.5 w-2.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: e.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{e.title}</div>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <Badge variant="outline" className="h-4 px-1 text-[9px]">{e.originLabel}</Badge>
                        {e.originDetail && <span className="text-[10px] text-muted-foreground truncate">{e.originDetail}</span>}
                      </div>
                      {e.description && (
                        <div className="text-xs text-muted-foreground line-clamp-1">{e.description}</div>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground shrink-0 text-right">
                      {isRange
                        ? `até ${end.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`
                        : start.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
