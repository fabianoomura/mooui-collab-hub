import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Plus, Trash2, Rocket, AlertTriangle, CheckCircle2, Calendar as CalIcon,
  Copy, GripVertical, Sparkles, CalendarPlus, ClipboardCheck,
} from 'lucide-react';
import {
  useLaunches, useCreateLaunch, useDeleteLaunch,
  useLaunch, useLaunchStages, useUpsertStage, useDeleteStage, usePersistRecalc,
  useReorderStages, useDuplicateLaunch, useSeedDefaultStages,
  recalcStageDates, type LaunchStage,
} from '@/hooks/useLaunches';
import { useCreateChecklistFromTemplate, useTemplates } from '@/hooks/useChecklists';
import { useCreateAnnualEvent } from '@/hooks/useAnnualEvents';
import { useCreateLink } from '@/hooks/useModuleLinks';
import { LinkedItems } from '@/components/LinkedItems';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { useConfirm } from '@/components/ConfirmDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ModuleInstanceBar, useActiveInstance } from '@/components/ModuleInstanceBar';
import { AssigneePicker } from '@/components/AssigneePicker';
import { usePermissions } from '@/hooks/usePermissions';

function useAllOrgMembers(orgId?: string) {
  return useQuery({
    queryKey: ['all-org-members', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data: members } = await supabase.from('organization_members').select('user_id').eq('organization_id', orgId);
      const ids = (members || []).map(m => m.user_id);
      if (!ids.length) return [];
      const { data: profiles } = await supabase.from('profiles').select('id, full_name, avatar_url').in('id', ids);
      return (profiles || []) as Array<{ id: string; full_name: string | null; avatar_url: string | null }>;
    },
    enabled: !!orgId,
  });
}

const fmtDate = (d?: string | null) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '—';
const daysBetween = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
const todayStr = () => new Date().toISOString().split('T')[0];

export default function LaunchesPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  if (selectedId) return <LaunchDetail id={selectedId} onBack={() => setSelectedId(null)} />;
  return <LaunchList onSelect={setSelectedId} />;
}

function LaunchList({ onSelect }: { onSelect: (id: string) => void }) {
  const { activeId: activeInstance, setActive: setActiveInstance } = useActiveInstance('lancamentos');
  const { data: launches = [], isLoading } = useLaunches(activeInstance);
  const createMut = useCreateLaunch();
  const deleteMut = useDeleteLaunch();
  const dupMut = useDuplicateLaunch();
  const confirm = useConfirm();
  const { canDo } = usePermissions();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', start_date: todayStr() });

  const handleCreate = () => {
    if (!form.name.trim()) return;
    createMut.mutate({ ...form, instance_id: activeInstance ?? null }, {
      onSuccess: (l) => { toast.success('Lançamento criado'); setOpen(false); onSelect(l.id); },
      onError: (e: any) => toast.error(e.message),
    });
  };

  const handleDelete = async (l: any) => {
    const ok = await confirm({
      title: `Excluir "${l.name}"?`,
      description: 'Todas as etapas e checagens vinculadas serão removidas.',
      confirmText: 'Excluir', destructive: true,
    });
    if (ok) deleteMut.mutate(l.id, { onSuccess: () => toast.success('Lançamento excluído') });
  };

  return (
    <div className="space-y-4">
      <PageHeader
        crumbs={[{ label: 'Início', to: '/' }, { label: 'Produção' }]}
        title="Produção"
        subtitle="Etapas, prazos e gargalos em tempo real"
        actions={canDo('create_project') ? (
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Novo lançamento</span>
          </Button>
        ) : undefined}
      />

      <ModuleInstanceBar
        moduleKey="lancamentos"
        value={activeInstance}
        onChange={setActiveInstance}
      />

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
      )}

      {!isLoading && launches.length === 0 && (
        <Card className="p-10 text-center">
          <Rocket className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />
          <p className="text-sm text-muted-foreground mb-4">Nenhum lançamento criado ainda</p>
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Criar primeiro lançamento
          </Button>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {launches.map(l => (
          <Card key={l.id} className="p-4 hover:shadow-md transition-all cursor-pointer group" onClick={() => onSelect(l.id)}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold truncate">{l.name}</h3>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{l.description || 'Sem descrição'}</p>
              </div>
              <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); dupMut.mutate(l.id, { onSuccess: () => toast.success('Lançamento duplicado') }); }}
                  className="text-muted-foreground hover:text-primary p-1"
                  aria-label="Duplicar"
                >
                  <Copy className="h-4 w-4" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(l); }}
                  className="text-muted-foreground hover:text-destructive p-1"
                  aria-label="Excluir"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-border/50 text-xs text-muted-foreground flex items-center gap-1.5">
              <CalIcon className="h-3.5 w-3.5" /> Início: {fmtDate(l.start_date)}
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo lançamento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} autoFocus /></div>
            <div><Label>Descrição</Label><Textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div><Label>Data de início</Label><Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!form.name.trim() || createMut.isPending}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LaunchDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { data: launch } = useLaunch(id);
  const { data: rawStages = [], isLoading } = useLaunchStages(id);
  const { currentOrg } = useOrganization();
  const { data: members = [] } = useAllOrgMembers(currentOrg?.id);
  const upsert = useUpsertStage();
  const del = useDeleteStage();
  const persistRecalc = usePersistRecalc();
  const reorder = useReorderStages();
  const seedDefaults = useSeedDefaultStages();
  const confirm = useConfirm();
  const { data: templates = [] } = useTemplates();
  const createChecklist = useCreateChecklistFromTemplate();
  const createEvent = useCreateAnnualEvent();
  const createLink = useCreateLink();

  const [editing, setEditing] = useState<LaunchStage | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', duration_days: 1, assignee_id: '', actual_end: '', status: 'pending' });
  const [checklistDialog, setChecklistDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  const handleCreateChecklist = () => {
    if (!launch) return;
    createChecklist.mutate(
      {
        name: `Checagem - ${launch.name}`,
        templateId: selectedTemplate || undefined,
        launchId: launch.id,
      },
      {
        onSuccess: (cl) => {
          createLink.mutate({
            source_type: 'launch',
            source_id: id,
            target_type: 'checklist',
            target_id: cl.id,
          });
          toast.success('Checklist criada e vinculada');
          setChecklistDialog(false);
          setSelectedTemplate('');
        },
        onError: (e: any) => toast.error(e.message),
      },
    );
  };

  const handleCreateCalendarEvent = () => {
    if (!launch) return;
    createEvent.mutate(
      {
        title: launch.name,
        description: launch.description || null,
        category: 'lancamento',
        color: '#a855f7',
        start_date: launch.start_date,
        end_date: null,
        project_id: null,
      },
      {
        onSuccess: (evt) => {
          createLink.mutate({
            source_type: 'launch',
            source_id: id,
            target_type: 'calendar',
            target_id: evt.id,
          });
          toast.success('Evento criado no calendário');
        },
        onError: (e: any) => toast.error(e.message),
      },
    );
  };

  const stages = useMemo(() => {
    if (!launch || rawStages.length === 0) return rawStages;
    return recalcStageDates(launch.start_date, rawStages);
  }, [launch, rawStages]);

  useEffect(() => {
    if (!launch || stages.length === 0) return;
    const rawMap = new Map(rawStages.map(s => [s.id, s]));
    const changed = stages.some((s) => {
      const raw = rawMap.get(s.id);
      return !raw || s.planned_start !== raw.planned_start || s.planned_end !== raw.planned_end;
    });
    if (changed) persistRecalc.mutate({ launchId: launch.id, stages });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(stages.map(s => [s.id, s.planned_start, s.planned_end, s.actual_end, s.duration_days]))]);

  const openNewStage = () => {
    setEditing(null);
    setForm({ name: '', duration_days: 3, assignee_id: '', actual_end: '', status: 'pending' });
    setCreating(true);
  };
  const openEditStage = (s: LaunchStage) => {
    setEditing(s);
    setForm({
      name: s.name, duration_days: s.duration_days,
      assignee_id: s.assignee_id || '', actual_end: s.actual_end || '', status: s.status,
    });
    setCreating(true);
  };

  const saveStage = () => {
    if (!form.name.trim()) return;
    upsert.mutate({
      ...(editing ? { id: editing.id } : {}),
      launch_id: id,
      name: form.name.trim(),
      duration_days: Number(form.duration_days) || 1,
      position: editing ? editing.position : (rawStages.length),
      assignee_id: form.assignee_id || null,
      actual_end: form.actual_end || null,
      status: form.status,
    } as any, {
      onSuccess: () => { toast.success('Etapa salva'); setCreating(false); setEditing(null); },
      onError: (e: any) => toast.error(e.message),
    });
  };

  const askDeleteStage = async (s: LaunchStage) => {
    const ok = await confirm({
      title: `Excluir etapa "${s.name}"?`, destructive: true, confirmText: 'Excluir',
    });
    if (ok) {
      del.mutate({ id: s.id, launch_id: id });
      setCreating(false); setEditing(null);
    }
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination || result.source.index === result.destination.index) return;
    const ids = [...stages].sort((a, b) => a.position - b.position).map((s) => s.id);
    const [moved] = ids.splice(result.source.index, 1);
    ids.splice(result.destination.index, 0, moved);
    reorder.mutate({ launchId: id, orderedIds: ids }, {
      onSuccess: () => toast.success('Ordem atualizada'),
    });
  };

  // Timeline range + today marker
  const range = useMemo(() => {
    if (stages.length === 0 || !launch) return null;
    const start = launch.start_date;
    const ends = stages.map(s => s.planned_end || s.planned_start || launch.start_date);
    const max = ends.sort().pop()!;
    const totalDays = Math.max(daysBetween(start, max) + 1, 7);
    const todayOffset = daysBetween(start, todayStr());
    return { start, totalDays, todayOffset };
  }, [stages, launch]);

  if (!launch) return <Skeleton className="h-32 w-full" />;

  return (
    <div className="space-y-4">
      <PageHeader
        crumbs={[
          { label: 'Início', to: '/' },
          { label: 'Produção', to: '#' },
        ]}
        title={launch.name}
        subtitle={`${launch.description || 'Sem descrição'} · Início ${fmtDate(launch.start_date)}`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={onBack}>← Voltar</Button>
            <Button variant="outline" size="sm" onClick={() => setChecklistDialog(true)}>
              <ClipboardCheck className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Criar checklist</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handleCreateCalendarEvent} disabled={createEvent.isPending}>
              <CalendarPlus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Calendário</span>
            </Button>
            <Button size="sm" onClick={openNewStage}>
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Nova etapa</span>
            </Button>
          </>
        }
      />

      {/* Lista de etapas */}
      <Card className="p-4">
        <h2 className="font-semibold mb-3">Etapas</h2>
        {isLoading ? (
          <div className="space-y-2"><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></div>
        ) : stages.length === 0 ? (
          <div className="text-center py-8 space-y-3">
            <p className="text-sm text-muted-foreground">Adicione etapas para construir a linha do tempo.</p>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <Button size="sm" onClick={openNewStage}>
                <Plus className="h-4 w-4 mr-2" /> Adicionar etapa
              </Button>
              <Button size="sm" variant="outline" onClick={() => seedDefaults.mutate(id, {
                onSuccess: () => toast.success('Etapas padrão criadas'),
              })}>
                <Sparkles className="h-4 w-4 mr-2" /> Usar template padrão
              </Button>
            </div>
          </div>
        ) : (
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="stages">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                  {stages.map((s, i) => {
                    const member = members.find(m => m.id === s.assignee_id);
                    const delayed = s.actual_end && s.planned_end && s.actual_end > s.planned_end;
                    const done = s.status === 'done' || !!s.actual_end;
                    const overdue = !done && s.planned_end && s.planned_end < todayStr();
                    return (
                      <Draggable key={s.id} draggableId={s.id} index={i}>
                        {(prov, snap) => (
                          <div
                            ref={prov.innerRef}
                            {...prov.draggableProps}
                            onClick={() => openEditStage(s)}
                            className={cn(
                              'flex items-center gap-3 p-3 rounded-md border bg-card hover:bg-muted/40 cursor-pointer transition-shadow',
                              snap.isDragging && 'shadow-lg ring-2 ring-primary/40',
                            )}
                          >
                            <div {...prov.dragHandleProps} className="text-muted-foreground hover:text-foreground" onClick={(e) => e.stopPropagation()}>
                              <GripVertical className="h-4 w-4" />
                            </div>
                            <span className="text-xs text-muted-foreground w-5">{i + 1}.</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm truncate">{s.name}</span>
                                {done && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                                {delayed && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive flex items-center gap-1">
                                    <AlertTriangle className="h-3 w-3" /> atraso
                                  </span>
                                )}
                                {overdue && !delayed && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 flex items-center gap-1">
                                    <AlertTriangle className="h-3 w-3" /> vencida
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {s.duration_days}d · {fmtDate(s.planned_start)} → {fmtDate(s.planned_end)}
                                {s.actual_end && ` · concluído ${fmtDate(s.actual_end)}`}
                              </div>
                            </div>
                            <div onClick={(e) => e.stopPropagation()}>
                              <AssigneePicker
                                value={s.assignee_id}
                                onChange={(uid) => upsert.mutate({
                                  id: s.id, launch_id: id, name: s.name,
                                  position: s.position, duration_days: s.duration_days,
                                  assignee_id: uid,
                                } as any)}
                              />
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); askDeleteStage(s); }}
                              className="text-muted-foreground hover:text-destructive"
                              aria-label="Excluir etapa"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}
      </Card>

      {/* Linha cronológica (Gantt) — hidden on mobile, replaced by list below */}
      {range && (
        <Card className="p-4 overflow-x-auto hidden md:block">
          <h2 className="font-semibold mb-3">Linha cronológica</h2>
          <div className="min-w-[640px] relative">
            {/* eixo */}
            <div className="relative h-6 border-b mb-2 text-[10px] text-muted-foreground">
              {Array.from({ length: Math.min(range.totalDays + 1, 60) }).map((_, i) => {
                if (i % 7 !== 0) return null;
                const d = new Date(range.start + 'T00:00:00');
                d.setDate(d.getDate() + i);
                return (
                  <div key={i} className="absolute -translate-x-1/2" style={{ left: `${(i / range.totalDays) * 100}%` }}>
                    {d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                  </div>
                );
              })}
            </div>
            {/* today line */}
            {range.todayOffset >= 0 && range.todayOffset <= range.totalDays && (
              <div
                className="absolute top-0 bottom-0 w-px bg-primary z-10"
                style={{ left: `${(range.todayOffset / range.totalDays) * 100}%` }}
              >
                <div className="absolute -top-1 -translate-x-1/2 text-[9px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded font-medium">
                  hoje
                </div>
              </div>
            )}
            <div className="space-y-1.5 pt-2">
              {stages.map((s) => {
                const offset = daysBetween(range.start, s.planned_start || range.start);
                const width = Math.max(daysBetween(s.planned_start || range.start, s.planned_end || s.planned_start || range.start) + 1, 1);
                const delayed = s.actual_end && s.planned_end && s.actual_end > s.planned_end;
                const done = s.status === 'done' || !!s.actual_end;
                const bg = delayed ? 'bg-destructive' : done ? 'bg-emerald-500' : 'bg-primary';
                return (
                  <div key={s.id} className="relative h-7">
                    <div
                      className={`absolute top-0 h-7 rounded-md ${bg} text-primary-foreground text-[11px] flex items-center px-2 truncate shadow-sm cursor-pointer hover:opacity-90`}
                      style={{ left: `${(offset / range.totalDays) * 100}%`, width: `${(width / range.totalDays) * 100}%`, minWidth: 80 }}
                      title={`${s.name} · ${fmtDate(s.planned_start)} → ${fmtDate(s.planned_end)}`}
                      onClick={() => openEditStage(s)}
                    >
                      {s.name}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      {/* Mobile timeline list — shown only on small screens */}
      {range && stages.length > 0 && (
        <Card className="p-4 md:hidden">
          <h2 className="font-semibold mb-3">Linha cronológica</h2>
          <div className="space-y-2">
            {stages.map((s) => {
              const done = s.status === 'done' || !!s.actual_end;
              const delayed = s.actual_end && s.planned_end && s.actual_end > s.planned_end;
              const overdue = !done && s.planned_end && s.planned_end < todayStr();
              return (
                <button
                  key={s.id}
                  onClick={() => openEditStage(s)}
                  className="w-full flex items-center gap-3 p-3 rounded-md border bg-card hover:bg-muted/40 text-left transition-colors"
                >
                  <div className={cn(
                    'h-3 w-3 rounded-full shrink-0',
                    done ? (delayed ? 'bg-destructive' : 'bg-emerald-500') : overdue ? 'bg-destructive' : 'bg-primary',
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{s.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtDate(s.planned_start)} → {fmtDate(s.planned_end)}
                    </p>
                  </div>
                  {done && <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />}
                  {overdue && <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />}
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {/* Cross-module links */}
      <LinkedItems sourceType="launch" sourceId={id} className="px-1" />

      {/* Checklist template selection dialog */}
      <Dialog open={checklistDialog} onOpenChange={setChecklistDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Criar checklist para este lançamento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Template (opcional)</Label>
              <Select value={selectedTemplate || 'none'} onValueChange={v => setSelectedTemplate(v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Sem template" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Sem template —</SelectItem>
                  {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChecklistDialog(false)}>Cancelar</Button>
            <Button onClick={handleCreateChecklist} disabled={createChecklist.isPending}>Criar checklist</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stage sheet */}
      <Sheet open={creating} onOpenChange={setCreating}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editing ? 'Editar etapa' : 'Nova etapa'}</SheetTitle>
            {editing && <SheetDescription>Alterações no prazo recalculam etapas seguintes.</SheetDescription>}
          </SheetHeader>
          <div className="space-y-3 mt-4">
            <div><Label>Nome</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} autoFocus /></div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Duração (dias)</Label>
                <Input type="number" min={1} value={form.duration_days} onChange={e => setForm({ ...form, duration_days: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="in_progress">Em andamento</SelectItem>
                    <SelectItem value="done">Concluída</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Responsável</Label>
              <Select value={form.assignee_id || 'none'} onValueChange={v => setForm({ ...form, assignee_id: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Ninguém —</SelectItem>
                  {members.map(m => <SelectItem key={m.id} value={m.id}>{m.full_name || 'Sem nome'}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Concluída em (deixe vazio se ainda não)</Label>
              <Input type="date" value={form.actual_end} onChange={e => setForm({ ...form, actual_end: e.target.value })} />
              <p className="text-[11px] text-muted-foreground mt-1">Se posterior ao prazo, as etapas seguintes são recalculadas.</p>
            </div>
          </div>
          <DialogFooter className="flex justify-between sm:justify-between mt-4">
            {editing && (
              <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => askDeleteStage(editing)}>
                <Trash2 className="h-4 w-4 mr-1" /> Excluir
              </Button>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCreating(false)}>Cancelar</Button>
              <Button onClick={saveStage} disabled={!form.name.trim() || upsert.isPending}>Salvar</Button>
            </div>
          </DialogFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
