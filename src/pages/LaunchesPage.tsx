import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Plus, Trash2, ArrowLeft, Rocket, AlertTriangle, CheckCircle2, Calendar as CalIcon } from 'lucide-react';
import {
  useLaunches, useCreateLaunch, useDeleteLaunch,
  useLaunch, useLaunchStages, useUpsertStage, useDeleteStage, usePersistRecalc,
  recalcStageDates, type LaunchStage,
} from '@/hooks/useLaunches';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';

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

export default function LaunchesPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (selectedId) return <LaunchDetail id={selectedId} onBack={() => setSelectedId(null)} />;
  return <LaunchList onSelect={setSelectedId} />;
}

function LaunchList({ onSelect }: { onSelect: (id: string) => void }) {
  const { data: launches = [], isLoading } = useLaunches();
  const createMut = useCreateLaunch();
  const deleteMut = useDeleteLaunch();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', start_date: new Date().toISOString().split('T')[0] });

  const handleCreate = () => {
    if (!form.name.trim()) return;
    createMut.mutate(form, {
      onSuccess: (l) => { toast.success('Lançamento criado'); setOpen(false); onSelect(l.id); },
      onError: (e: any) => toast.error(e.message),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Lançamentos</h1>
          <p className="text-muted-foreground text-sm mt-1">Etapas, prazos e gargalos em tempo real</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Novo lançamento</Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}

      {!isLoading && launches.length === 0 && (
        <Card className="p-10 text-center">
          <Rocket className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />
          <p className="text-sm text-muted-foreground">Nenhum lançamento criado ainda</p>
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
              <button
                onClick={(e) => { e.stopPropagation(); if (confirm(`Excluir "${l.name}"?`)) deleteMut.mutate(l.id); }}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
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
  const { data: rawStages = [] } = useLaunchStages(id);
  const { currentOrg } = useOrganization();
  const { data: members = [] } = useAllOrgMembers(currentOrg?.id);
  const upsert = useUpsertStage();
  const del = useDeleteStage();
  const persistRecalc = usePersistRecalc();

  const [stageOpen, setStageOpen] = useState(false);
  const [editing, setEditing] = useState<LaunchStage | null>(null);
  const [form, setForm] = useState({ name: '', duration_days: 1, assignee_id: '', actual_end: '', status: 'pending' });

  // Recalcula em memória
  const stages = useMemo(() => {
    if (!launch || rawStages.length === 0) return rawStages;
    return recalcStageDates(launch.start_date, rawStages);
  }, [launch, rawStages]);

  // Auto-persiste planejamento sempre que recalcular detectar diferença
  useEffect(() => {
    if (!launch || stages.length === 0) return;
    const changed = stages.some((s, i) => s.planned_start !== rawStages[i]?.planned_start || s.planned_end !== rawStages[i]?.planned_end);
    if (changed) persistRecalc.mutate({ launchId: launch.id, stages });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(stages.map(s => [s.id, s.planned_start, s.planned_end, s.actual_end, s.duration_days]))]);

  const openNewStage = () => {
    setEditing(null);
    setForm({ name: '', duration_days: 3, assignee_id: '', actual_end: '', status: 'pending' });
    setStageOpen(true);
  };
  const openEditStage = (s: LaunchStage) => {
    setEditing(s);
    setForm({
      name: s.name, duration_days: s.duration_days,
      assignee_id: s.assignee_id || '', actual_end: s.actual_end || '', status: s.status,
    });
    setStageOpen(true);
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
      onSuccess: () => { toast.success('Etapa salva'); setStageOpen(false); },
      onError: (e: any) => toast.error(e.message),
    });
  };

  // Timeline range
  const range = useMemo(() => {
    if (stages.length === 0 || !launch) return null;
    const start = launch.start_date;
    const ends = stages.map(s => s.planned_end || s.planned_start || launch.start_date);
    const max = ends.sort().pop()!;
    const totalDays = Math.max(daysBetween(start, max) + 1, 7);
    return { start, totalDays };
  }, [stages, launch]);

  if (!launch) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold truncate">{launch.name}</h1>
            <p className="text-muted-foreground text-xs sm:text-sm truncate">{launch.description || 'Sem descrição'} · Início {fmtDate(launch.start_date)}</p>
          </div>
        </div>
        <Button size="sm" onClick={openNewStage}><Plus className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Nova etapa</span></Button>
      </div>

      {/* Lista de etapas */}
      <Card className="p-4">
        <h2 className="font-semibold mb-3">Etapas</h2>
        {stages.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">Adicione etapas para construir a linha do tempo.</p>
        ) : (
          <div className="space-y-2">
            {stages.map((s, i) => {
              const member = members.find(m => m.id === s.assignee_id);
              const delayed = s.actual_end && s.planned_end && s.actual_end > s.planned_end;
              const done = s.status === 'done' || !!s.actual_end;
              return (
                <div
                  key={s.id}
                  onClick={() => openEditStage(s)}
                  className="flex items-center gap-3 p-3 rounded-md border bg-card hover:bg-muted/40 cursor-pointer"
                >
                  <span className="text-xs text-muted-foreground w-5">{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{s.name}</span>
                      {done && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                      {delayed && <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> atraso</span>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {s.duration_days}d · {fmtDate(s.planned_start)} → {fmtDate(s.planned_end)}
                      {s.actual_end && ` · concluído ${fmtDate(s.actual_end)}`}
                    </div>
                  </div>
                  {member && (
                    <Avatar className="h-7 w-7">
                      {member.avatar_url && <AvatarImage src={member.avatar_url} />}
                      <AvatarFallback className="text-[10px]">{(member.full_name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); if (confirm(`Excluir etapa "${s.name}"?`)) del.mutate({ id: s.id, launch_id: id }); }}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Linha cronológica (Gantt) */}
      {range && (
        <Card className="p-4 overflow-x-auto">
          <h2 className="font-semibold mb-3">Linha cronológica</h2>
          <div className="min-w-[640px]">
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
            <div className="space-y-1.5">
              {stages.map((s) => {
                const offset = daysBetween(range.start, s.planned_start || range.start);
                const width = Math.max(daysBetween(s.planned_start || range.start, s.planned_end || s.planned_start || range.start) + 1, 1);
                const delayed = s.actual_end && s.planned_end && s.actual_end > s.planned_end;
                const done = s.status === 'done' || !!s.actual_end;
                const bg = delayed ? 'bg-destructive' : done ? 'bg-emerald-500' : 'bg-primary';
                return (
                  <div key={s.id} className="relative h-7">
                    <div
                      className={`absolute top-0 h-7 rounded-md ${bg} text-primary-foreground text-[11px] flex items-center px-2 truncate shadow-sm`}
                      style={{ left: `${(offset / range.totalDays) * 100}%`, width: `${(width / range.totalDays) * 100}%`, minWidth: 80 }}
                      title={`${s.name} · ${fmtDate(s.planned_start)} → ${fmtDate(s.planned_end)}`}
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

      {/* Stage dialog */}
      <Dialog open={stageOpen} onOpenChange={setStageOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Editar etapa' : 'Nova etapa'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
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
              <p className="text-[11px] text-muted-foreground mt-1">Se posterior ao prazo, as etapas seguintes serão recalculadas.</p>
            </div>
          </div>
          <DialogFooter className="flex justify-between sm:justify-between">
            {editing && (
              <Button variant="ghost" className="text-destructive" onClick={() => { if (confirm('Excluir etapa?')) { del.mutate({ id: editing.id, launch_id: id }); setStageOpen(false); } }}>
                Excluir
              </Button>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStageOpen(false)}>Cancelar</Button>
              <Button onClick={saveStage} disabled={!form.name.trim() || upsert.isPending}>Salvar</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
