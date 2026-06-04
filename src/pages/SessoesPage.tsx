import { useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon, Camera, CheckCircle2, ChevronDown, ChevronRight,
  ClipboardSignature, Film, Image as ImageIcon, LayoutList, Lightbulb, Plus,
  Search as SearchIcon, Trash2, UserRound, X,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/integrations/supabase/client';
import {
  useCreateSessao, useCreateSessaoShot, useDeleteSessao, useDeleteSessaoShot,
  useSessaoActivity, useSessaoShots, useSessoes, useUpdateSessao, useUpdateSessaoShot,
  type Sessao, type SessaoShot, type SessaoShotStatus, type SessaoShotTipo, type SessaoStatus,
} from '@/hooks/useSessoes';
import {
  useCreateSessaoContract, useDeleteSessaoContract, useSessaoContracts, useUpdateSessaoContract,
  type SessaoContract,
} from '@/hooks/useSessaoContracts';
import {
  useCreateSessaoIdea, useDeleteSessaoIdea, useSessaoIdeas, useUpdateSessaoIdea,
  type SessaoIdea, type SessaoIdeaStatus,
} from '@/hooks/useSessaoIdeas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { useConfirm } from '@/components/ConfirmDialog';
import { LinkedItems } from '@/components/LinkedItems';
import { cn } from '@/lib/utils';

const sessaoStatusLabels: Record<SessaoStatus, string> = {
  planejada: 'Planejada',
  em_producao: 'Em producao',
  em_edicao: 'Em edicao',
  entregue: 'Entregue',
  cancelada: 'Cancelada',
};

const sessaoStatusColors: Record<SessaoStatus, string> = {
  planejada: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
  em_producao: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  em_edicao: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  entregue: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  cancelada: 'bg-red-500/15 text-red-700 dark:text-red-300',
};

const shotStatusLabels: Record<SessaoShotStatus, string> = {
  nao_iniciado: 'Nao iniciado',
  em_andamento: 'Em andamento',
  feito: 'Feito',
  cancelado: 'Cancelado',
};

const shotStatusColors: Record<SessaoShotStatus, string> = {
  nao_iniciado: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
  em_andamento: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  feito: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  cancelado: 'bg-red-500/15 text-red-700 dark:text-red-300',
};

const ideaStatusLabels: Record<SessaoIdeaStatus, string> = {
  nova: 'Nova',
  selecionada: 'Selecionada',
  em_producao: 'Em producao',
  usada: 'Usada',
  arquivada: 'Arquivada',
};

const ideaStatusColors: Record<SessaoIdeaStatus, string> = {
  nova: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  selecionada: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  em_producao: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  usada: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  arquivada: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
};

type OrgMember = { id: string; full_name: string | null };
const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export default function SessoesPage() {
  const { currentOrg } = useOrganization();
  const [tab, setTab] = useState<'sessoes' | 'contratos' | 'ideias'>('sessoes');

  const { data: orgMembers = [] } = useQuery({
    queryKey: ['org-members-sessoes', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return [];
      const { data } = await supabase.from('organization_members').select('user_id').eq('organization_id', currentOrg.id);
      const ids = (data || []).map((m: any) => m.user_id);
      if (ids.length === 0) return [];
      const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', ids);
      return (profiles || []) as OrgMember[];
    },
    enabled: !!currentOrg,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Sessoes de Foto & Video</h1>
        <p className="text-sm text-muted-foreground">Planejamento de producao, shots, contratos e banco de ideias.</p>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as any)}>
        <TabsList>
          <TabsTrigger value="sessoes"><Camera className="h-3.5 w-3.5 mr-1.5" />Sessoes</TabsTrigger>
          <TabsTrigger value="contratos"><ClipboardSignature className="h-3.5 w-3.5 mr-1.5" />Contratos</TabsTrigger>
          <TabsTrigger value="ideias"><Lightbulb className="h-3.5 w-3.5 mr-1.5" />Banco de ideias</TabsTrigger>
        </TabsList>

        <TabsContent value="sessoes" className="mt-4">
          <SessoesTab orgMembers={orgMembers} />
        </TabsContent>
        <TabsContent value="contratos" className="mt-4">
          <ContratosTab />
        </TabsContent>
        <TabsContent value="ideias" className="mt-4">
          <IdeiasTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SessoesTab({ orgMembers }: { orgMembers: OrgMember[] }) {
  const { user } = useAuth();
  const { data: sessoes = [], isLoading } = useSessoes();
  const createMut = useCreateSessao();
  const updateMut = useUpdateSessao();
  const deleteMut = useDeleteSessao();
  const confirm = useConfirm();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | SessaoStatus>('all');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [nTitle, setNTitle] = useState('');
  const [nDate, setNDate] = useState('');
  const [nProfessional, setNProfessional] = useState('');
  const [nResponsaveis, setNResponsaveis] = useState<string[]>([]);
  const [nNotes, setNNotes] = useState('');

  const userIds = useMemo(() => {
    const ids = new Set<string>();
    sessoes.forEach((sessao) => {
      ids.add(sessao.created_by);
      (sessao.responsaveis || []).forEach((id) => ids.add(id));
    });
    return [...ids];
  }, [sessoes]);

  const { data: profiles = [] } = useQuery({
    queryKey: ['sessao-profiles', userIds.sort().join(',')],
    queryFn: async () => {
      if (userIds.length === 0) return [];
      const { data } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
      return data || [];
    },
    enabled: userIds.length > 0,
  });

  const profileMap = useMemo(() => new Map((profiles as OrgMember[]).map((p) => [p.id, p])), [profiles]);
  const q = search.trim().toLowerCase();
  const filtered = sessoes.filter((sessao) => {
    if (statusFilter !== 'all' && sessao.status !== statusFilter) return false;
    if (!q) return true;
    return (
      sessao.title.toLowerCase().includes(q) ||
      (sessao.professional || '').toLowerCase().includes(q) ||
      (sessao.code || '').toLowerCase().includes(q)
    );
  });

  const toggleNewResponsible = (id: string) => {
    setNResponsaveis((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const handleCreate = () => {
    if (!nTitle.trim()) return;
    createMut.mutate({
      title: nTitle.trim(),
      scheduled_date: nDate || undefined,
      professional: nProfessional || undefined,
      responsaveis: nResponsaveis,
      notes: nNotes || undefined,
    }, {
      onSuccess: () => {
        toast.success('Sessao criada');
        setShowNew(false);
        setNTitle('');
        setNDate('');
        setNProfessional('');
        setNResponsaveis([]);
        setNNotes('');
      },
      onError: (e: any) => toast.error(e?.message || 'Erro ao criar sessao'),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex flex-1 min-w-[240px] gap-2">
          <div className="relative flex-1 min-w-0">
            <SearchIcon className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-9 pl-8" placeholder="Buscar por sessao, profissional ou codigo" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as any)}>
            <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {(Object.keys(sessaoStatusLabels) as SessaoStatus[]).map((key) => (
                <SelectItem key={key} value={key}>{sessaoStatusLabels[key]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1 rounded-md border p-1">
          <Button size="sm" variant={viewMode === 'list' ? 'secondary' : 'ghost'} className="h-7 px-2" onClick={() => setViewMode('list')}>
            <LayoutList className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant={viewMode === 'calendar' ? 'secondary' : 'ghost'} className="h-7 px-2" onClick={() => setViewMode('calendar')}>
            <CalendarIcon className="h-3.5 w-3.5" />
          </Button>
        </div>
        <Button size="sm" onClick={() => setShowNew(true)}><Plus className="h-4 w-4 mr-1" />Nova sessao</Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">Nenhuma sessao encontrada.</Card>
      ) : viewMode === 'calendar' ? (
        <SessoesCalendar sessoes={filtered} onOpen={(sessao) => { setExpandedId(sessao.id); setViewMode('list'); }} />
      ) : (
        <div className="space-y-2">
          {filtered.map((sessao) => {
            const isExpanded = expandedId === sessao.id;
            const responsaveis = (sessao.responsaveis || []).map((id) => profileMap.get(id)?.full_name || 'Usuario').join(', ');
            return (
              <Card key={sessao.id} className="overflow-hidden">
                <div className="p-3 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setExpandedId(isExpanded ? null : sessao.id)}>
                  <div className="flex items-start gap-2">
                    {isExpanded ? <ChevronDown className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 flex-wrap">
                        {sessao.code && <span className="text-[10px] font-mono font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{sessao.code}</span>}
                        <h3 className="font-medium truncate flex-1 min-w-0">{sessao.title}</h3>
                        <Badge variant="outline" className={cn('text-[10px]', sessaoStatusColors[sessao.status])}>{sessaoStatusLabels[sessao.status]}</Badge>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap mt-1 text-[11px] text-muted-foreground">
                        {sessao.scheduled_date && (
                          <span className="inline-flex items-center gap-1"><CalendarIcon className="h-3 w-3" />{format(new Date(sessao.scheduled_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}</span>
                        )}
                        {sessao.professional && <span className="inline-flex items-center gap-1"><Camera className="h-3 w-3" />{sessao.professional}</span>}
                        {responsaveis && <span className="inline-flex items-center gap-1"><UserRound className="h-3 w-3" />{responsaveis}</span>}
                      </div>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <SessaoExpanded
                    sessao={sessao}
                    orgMembers={orgMembers}
                    profileMap={profileMap}
                    isOwner={sessao.created_by === user?.id}
                    onUpdate={(patch) => updateMut.mutate({ id: sessao.id, ...patch }, { onSuccess: () => toast.success('Sessao atualizada') })}
                    onDelete={async () => {
                      const ok = await confirm({ title: 'Excluir esta sessao?', destructive: true, confirmText: 'Excluir' });
                      if (!ok) return;
                      deleteMut.mutate(sessao.id, { onSuccess: () => { toast.success('Sessao excluida'); setExpandedId(null); } });
                    }}
                  />
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova sessao</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Titulo</Label>
              <Input autoFocus value={nTitle} onChange={(e) => setNTitle(e.target.value)} placeholder="Ex: Fotos lancamento inverno" />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Data</Label>
                <Input type="date" value={nDate} onChange={(e) => setNDate(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Profissional</Label>
                <Input value={nProfessional} onChange={(e) => setNProfessional(e.target.value)} placeholder="Fotografo, videomaker..." />
              </div>
            </div>
            <div>
              <Label className="text-xs mb-2 block">Responsaveis</Label>
              <div className="grid sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded-md p-2">
                {orgMembers.map((member) => (
                  <label key={member.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={nResponsaveis.includes(member.id)} onCheckedChange={() => toggleNewResponsible(member.id)} />
                    <span className="truncate">{member.full_name || 'Usuario'}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs">Notas</Label>
              <Textarea rows={3} value={nNotes} onChange={(e) => setNNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!nTitle.trim() || createMut.isPending}>Criar sessao</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SessoesCalendar({ sessoes, onOpen }: { sessoes: Sessao[]; onOpen: (sessao: Sessao) => void }) {
  const byMonth = useMemo(() => {
    const map = new Map<number, Sessao[]>();
    for (let month = 0; month < 12; month++) map.set(month, []);
    sessoes.forEach((sessao) => {
      if (!sessao.scheduled_date) return;
      map.get(new Date(sessao.scheduled_date + 'T12:00:00').getMonth())?.push(sessao);
    });
    return map;
  }, [sessoes]);
  const currentMonth = new Date().getMonth();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {MONTHS.map((month, index) => {
        const items = byMonth.get(index) || [];
        const isCurrent = index === currentMonth;
        return (
          <Card key={month} className={cn('p-3 min-h-[130px]', isCurrent && 'ring-2 ring-primary/40')}>
            <div className="flex items-center justify-between mb-2">
              <h3 className={cn('text-sm font-semibold', isCurrent && 'text-primary')}>{month}</h3>
              {items.length > 0 && <Badge variant="secondary" className="text-[10px] h-5">{items.length}</Badge>}
            </div>
            {items.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-5">-</p>
            ) : (
              <div className="space-y-1.5">
                {items.map((sessao) => (
                  <button key={sessao.id} className="w-full rounded-md p-2 text-left hover:bg-muted/60 transition-colors" onClick={() => onOpen(sessao)}>
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-violet-500 shrink-0" />
                      <span className="text-xs font-medium truncate flex-1">{sessao.title}</span>
                      <Badge variant="outline" className={cn('text-[10px]', sessaoStatusColors[sessao.status])}>{sessaoStatusLabels[sessao.status]}</Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <CalendarIcon className="h-3 w-3" />
                      <span>{sessao.scheduled_date ? format(new Date(sessao.scheduled_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR }) : 'Sem data'}</span>
                      {sessao.professional && <span className="truncate">- {sessao.professional}</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function SessaoExpanded({
  sessao, orgMembers, profileMap, isOwner, onUpdate, onDelete,
}: {
  sessao: Sessao;
  orgMembers: OrgMember[];
  profileMap: Map<string, OrgMember>;
  isOwner: boolean;
  onUpdate: (patch: Partial<Sessao>) => void;
  onDelete: () => void;
}) {
  const { data: shots = [] } = useSessaoShots(sessao.id);
  const { data: activity = [] } = useSessaoActivity(sessao.id);
  const createShot = useCreateSessaoShot();
  const updateShot = useUpdateSessaoShot();
  const deleteShot = useDeleteSessaoShot();
  const [newShotTitle, setNewShotTitle] = useState('');
  const [newShotTipo, setNewShotTipo] = useState<SessaoShotTipo>('foto');

  const done = shots.filter((shot) => shot.status === 'feito').length;
  const progress = shots.length ? Math.round((done / shots.length) * 100) : 0;

  const toggleResponsible = (id: string) => {
    const current = sessao.responsaveis || [];
    onUpdate({ responsaveis: current.includes(id) ? current.filter((item) => item !== id) : [...current, id] });
  };

  const addShot = () => {
    if (!newShotTitle.trim()) return;
    createShot.mutate({
      sessao_id: sessao.id,
      title: newShotTitle.trim(),
      tipo: newShotTipo,
      position: shots.length,
    }, {
      onSuccess: () => {
        setNewShotTitle('');
        setNewShotTipo('foto');
      },
    });
  };

  return (
    <div className="px-3 pb-3 pt-3 border-t space-y-4">
      <div className="grid lg:grid-cols-[1fr_280px] gap-4">
        <div className="space-y-3">
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={sessao.status} onValueChange={(value) => onUpdate({ status: value as SessaoStatus })}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(sessaoStatusLabels) as SessaoStatus[]).map((key) => (
                    <SelectItem key={key} value={key}>{sessaoStatusLabels[key]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Data</Label>
              <Input type="date" className="h-8" value={sessao.scheduled_date || ''} onChange={(e) => onUpdate({ scheduled_date: e.target.value || null } as any)} />
            </div>
            <div>
              <Label className="text-xs">Profissional</Label>
              <Input className="h-8" value={sessao.professional || ''} onChange={(e) => onUpdate({ professional: e.target.value || null } as any)} />
            </div>
          </div>

          <div>
            <Label className="text-xs mb-2 block">Responsaveis</Label>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {orgMembers.map((member) => (
                <label key={member.id} className="flex items-center gap-2 text-sm cursor-pointer border rounded-md px-2 py-1.5">
                  <Checkbox checked={(sessao.responsaveis || []).includes(member.id)} onCheckedChange={() => toggleResponsible(member.id)} />
                  <span className="truncate">{member.full_name || 'Usuario'}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs">Notas</Label>
            <Textarea rows={3} value={sessao.notes || ''} onChange={(e) => onUpdate({ notes: e.target.value || null } as any)} />
          </div>
        </div>

        <div className="space-y-3">
          <Card className="p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Shots concluidos</span>
              <span className="text-muted-foreground">{done}/{shots.length}</span>
            </div>
            <div className="h-2 rounded-full bg-muted mt-2 overflow-hidden">
              <div className="h-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
            </div>
          </Card>
          <LinkedItems sourceType="sessao" sourceId={sessao.id} />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <Label className="text-xs">Shots da sessao</Label>
          <Badge variant="outline" className="text-[10px]">{shots.length} itens</Badge>
        </div>
        <div className="space-y-2">
          {shots.map((shot) => (
            <ShotRow
              key={shot.id}
              shot={shot}
              onUpdate={(patch) => updateShot.mutate({ id: shot.id, sessao_id: sessao.id, ...patch })}
              onDelete={() => deleteShot.mutate({ id: shot.id, sessao_id: sessao.id })}
            />
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-2 mt-2">
          <Input
            value={newShotTitle}
            onChange={(e) => setNewShotTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addShot(); } }}
            placeholder="Adicionar shot..."
            className="h-8"
          />
          <Select value={newShotTipo} onValueChange={(value) => setNewShotTipo(value as SessaoShotTipo)}>
            <SelectTrigger className="h-8 sm:w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="foto">Foto</SelectItem>
              <SelectItem value="video">Video</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" className="h-8" onClick={addShot} disabled={!newShotTitle.trim()}><Plus className="h-3.5 w-3.5 mr-1" />Shot</Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <Label className="text-xs mb-2 block">Atividade</Label>
          <div className="space-y-1 text-xs text-muted-foreground">
            {activity.length === 0 ? (
              <span>Nenhuma atividade registrada.</span>
            ) : activity.slice(-5).reverse().map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-2 border rounded-md px-2 py-1.5">
                <span>{item.action}: {item.from_value || '-'} {'->'} {item.to_value || '-'}</span>
                <span className="shrink-0">{formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: ptBR })}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-end justify-end">
          {isOwner && (
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />Excluir sessao
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ShotRow({ shot, onUpdate, onDelete }: {
  shot: SessaoShot;
  onUpdate: (patch: Partial<SessaoShot>) => void;
  onDelete: () => void;
}) {
  const isDone = shot.status === 'feito';
  return (
    <div className="border rounded-md p-2 space-y-2">
      <div className="flex items-start gap-2">
        <button
          className={cn('h-5 w-5 rounded border shrink-0 mt-0.5 flex items-center justify-center', isDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-muted-foreground/40')}
          onClick={() => onUpdate({ status: isDone ? 'nao_iniciado' : 'feito' })}
        >
          {isDone && <CheckCircle2 className="h-3.5 w-3.5" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {shot.tipo === 'foto' ? <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" /> : <Film className="h-3.5 w-3.5 text-muted-foreground" />}
            <Input className="h-7 font-medium flex-1 min-w-[180px]" value={shot.title} onChange={(e) => onUpdate({ title: e.target.value })} />
            <Badge variant="outline" className={cn('text-[10px]', shotStatusColors[shot.status])}>{shotStatusLabels[shot.status]}</Badge>
            <button className="text-muted-foreground hover:text-destructive" onClick={onDelete}><X className="h-3.5 w-3.5" /></button>
          </div>
          <div className="grid sm:grid-cols-5 gap-2 mt-2">
            <Select value={shot.tipo} onValueChange={(value) => onUpdate({ tipo: value as SessaoShotTipo })}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="foto">Foto</SelectItem>
                <SelectItem value="video">Video</SelectItem>
              </SelectContent>
            </Select>
            <Select value={shot.status} onValueChange={(value) => onUpdate({ status: value as SessaoShotStatus })}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(shotStatusLabels) as SessaoShotStatus[]).map((key) => (
                  <SelectItem key={key} value={key}>{shotStatusLabels[key]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input className="h-8" placeholder="Local" value={shot.local || ''} onChange={(e) => onUpdate({ local: e.target.value || null } as any)} />
            <Input className="h-8" placeholder="Modelo" value={shot.modelo || ''} onChange={(e) => onUpdate({ modelo: e.target.value || null } as any)} />
            <Input type="date" className="h-8" value={shot.data_entrega || ''} onChange={(e) => onUpdate({ data_entrega: e.target.value || null } as any)} />
          </div>
          <div className="grid sm:grid-cols-2 gap-2 mt-2">
            <Input className="h-8" placeholder="Funil" value={shot.funil || ''} onChange={(e) => onUpdate({ funil: e.target.value || null } as any)} />
            <Input className="h-8" placeholder="Tipo de conteudo" value={shot.content_type || ''} onChange={(e) => onUpdate({ content_type: e.target.value || null } as any)} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ContratosTab() {
  const { user } = useAuth();
  const { data: contracts = [], isLoading } = useSessaoContracts();
  const createMut = useCreateSessaoContract();
  const updateMut = useUpdateSessaoContract();
  const deleteMut = useDeleteSessaoContract();
  const confirm = useConfirm();
  const [showNew, setShowNew] = useState(false);
  const [openContract, setOpenContract] = useState<SessaoContract | null>(null);
  const [nName, setNName] = useState('');
  const [nStart, setNStart] = useState('');
  const [nEnd, setNEnd] = useState('');
  const [nPhotos, setNPhotos] = useState('0');
  const [nVideos, setNVideos] = useState('0');

  const handleCreate = () => {
    if (!nName.trim()) return;
    createMut.mutate({
      photographer_name: nName.trim(),
      contract_start: nStart || undefined,
      contract_end: nEnd || undefined,
      monthly_quota_photos: Number(nPhotos) || 0,
      monthly_quota_videos: Number(nVideos) || 0,
    }, {
      onSuccess: () => {
        toast.success('Contrato criado');
        setShowNew(false);
        setNName('');
        setNStart('');
        setNEnd('');
        setNPhotos('0');
        setNVideos('0');
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button size="sm" onClick={() => setShowNew(true)}><Plus className="h-4 w-4 mr-1" />Novo contrato</Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : contracts.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">Nenhum contrato cadastrado.</Card>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {contracts.map((contract) => (
            <Card key={contract.id} className="p-3 cursor-pointer hover:border-primary/40 transition-colors" onClick={() => setOpenContract(contract)}>
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                  <ClipboardSignature className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium truncate">{contract.photographer_name}</h3>
                  <div className="flex items-center gap-2 flex-wrap mt-1 text-[11px] text-muted-foreground">
                    {contract.contract_start && <span>{format(new Date(contract.contract_start + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}</span>}
                    {contract.contract_end && <span>ate {format(new Date(contract.contract_end + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}</span>}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Badge variant="outline" className="text-[10px]">{contract.monthly_quota_photos || 0} fotos/mes</Badge>
                    <Badge variant="outline" className="text-[10px]">{contract.monthly_quota_videos || 0} videos/mes</Badge>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo contrato</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Profissional</Label><Input autoFocus value={nName} onChange={(e) => setNName(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Inicio</Label><Input type="date" value={nStart} onChange={(e) => setNStart(e.target.value)} /></div>
              <div><Label className="text-xs">Fim</Label><Input type="date" value={nEnd} onChange={(e) => setNEnd(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Cota fotos/mes</Label><Input type="number" min="0" value={nPhotos} onChange={(e) => setNPhotos(e.target.value)} /></div>
              <div><Label className="text-xs">Cota videos/mes</Label><Input type="number" min="0" value={nVideos} onChange={(e) => setNVideos(e.target.value)} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!nName.trim() || createMut.isPending}>Criar contrato</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {openContract && (
        <ContractDetail
          contract={openContract}
          isOwner={openContract.created_by === user?.id}
          onClose={() => setOpenContract(null)}
          onUpdate={(patch) => updateMut.mutate({ id: openContract.id, ...patch }, {
            onSuccess: () => { setOpenContract((current) => current ? { ...current, ...patch } as SessaoContract : current); toast.success('Contrato atualizado'); },
          })}
          onDelete={async () => {
            const ok = await confirm({ title: 'Excluir contrato?', destructive: true, confirmText: 'Excluir' });
            if (!ok) return;
            deleteMut.mutate(openContract.id, { onSuccess: () => { toast.success('Contrato excluido'); setOpenContract(null); } });
          }}
        />
      )}
    </div>
  );
}

function ContractDetail({ contract, isOwner, onClose, onUpdate, onDelete }: {
  contract: SessaoContract;
  isOwner: boolean;
  onClose: () => void;
  onUpdate: (patch: Partial<SessaoContract>) => void;
  onDelete: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{contract.photographer_name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label className="text-xs">Profissional</Label><Input value={contract.photographer_name} onChange={(e) => onUpdate({ photographer_name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Inicio</Label><Input type="date" value={contract.contract_start || ''} onChange={(e) => onUpdate({ contract_start: e.target.value || null } as any)} /></div>
            <div><Label className="text-xs">Fim</Label><Input type="date" value={contract.contract_end || ''} onChange={(e) => onUpdate({ contract_end: e.target.value || null } as any)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Cota fotos/mes</Label><Input type="number" min="0" value={contract.monthly_quota_photos ?? 0} onChange={(e) => onUpdate({ monthly_quota_photos: Number(e.target.value) || 0 } as any)} /></div>
            <div><Label className="text-xs">Cota videos/mes</Label><Input type="number" min="0" value={contract.monthly_quota_videos ?? 0} onChange={(e) => onUpdate({ monthly_quota_videos: Number(e.target.value) || 0 } as any)} /></div>
          </div>
          <div><Label className="text-xs">Notas</Label><Textarea rows={3} value={contract.notes || ''} onChange={(e) => onUpdate({ notes: e.target.value || null } as any)} /></div>
          {isOwner && (
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />Excluir contrato
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function IdeiasTab() {
  const { user } = useAuth();
  const { data: ideas = [], isLoading } = useSessaoIdeas();
  const createMut = useCreateSessaoIdea();
  const updateMut = useUpdateSessaoIdea();
  const deleteMut = useDeleteSessaoIdea();
  const confirm = useConfirm();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | SessaoIdeaStatus>('all');
  const [showNew, setShowNew] = useState(false);
  const [openIdea, setOpenIdea] = useState<SessaoIdea | null>(null);
  const [nTitle, setNTitle] = useState('');
  const [nCategory, setNCategory] = useState('');
  const [nNotes, setNNotes] = useState('');

  const q = search.trim().toLowerCase();
  const filtered = ideas.filter((idea) => {
    if (statusFilter !== 'all' && idea.status !== statusFilter) return false;
    if (!q) return true;
    return idea.title.toLowerCase().includes(q) || (idea.category || '').toLowerCase().includes(q);
  });

  const handleCreate = () => {
    if (!nTitle.trim()) return;
    createMut.mutate({ title: nTitle.trim(), category: nCategory || undefined, notes: nNotes || undefined }, {
      onSuccess: () => {
        toast.success('Ideia criada');
        setShowNew(false);
        setNTitle('');
        setNCategory('');
        setNNotes('');
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex flex-1 min-w-[240px] gap-2">
          <div className="relative flex-1 min-w-0">
            <SearchIcon className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-9 pl-8" placeholder="Buscar ideia ou categoria" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as any)}>
            <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {(Object.keys(ideaStatusLabels) as SessaoIdeaStatus[]).map((key) => (
                <SelectItem key={key} value={key}>{ideaStatusLabels[key]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={() => setShowNew(true)}><Plus className="h-4 w-4 mr-1" />Nova ideia</Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">Nenhuma ideia encontrada.</Card>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((idea) => (
            <Card key={idea.id} className="p-3 cursor-pointer hover:border-primary/40 transition-colors" onClick={() => setOpenIdea(idea)}>
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                  <Lightbulb className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2">
                    <h3 className="font-medium truncate flex-1 min-w-0">{idea.title}</h3>
                    <Badge variant="outline" className={cn('text-[10px]', ideaStatusColors[idea.status])}>{ideaStatusLabels[idea.status]}</Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                    {idea.category && <span>{idea.category}</span>}
                    <span>{formatDistanceToNow(new Date(idea.created_at), { addSuffix: true, locale: ptBR })}</span>
                  </div>
                  {idea.notes && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{idea.notes}</p>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova ideia</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Titulo</Label><Input autoFocus value={nTitle} onChange={(e) => setNTitle(e.target.value)} /></div>
            <div><Label className="text-xs">Categoria</Label><Input value={nCategory} onChange={(e) => setNCategory(e.target.value)} placeholder="Editorial, produto, campanha..." /></div>
            <div><Label className="text-xs">Notas</Label><Textarea rows={3} value={nNotes} onChange={(e) => setNNotes(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!nTitle.trim() || createMut.isPending}>Criar ideia</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {openIdea && (
        <IdeaDetail
          idea={openIdea}
          isOwner={openIdea.created_by === user?.id}
          onClose={() => setOpenIdea(null)}
          onUpdate={(patch) => updateMut.mutate({ id: openIdea.id, ...patch }, {
            onSuccess: () => { setOpenIdea((current) => current ? { ...current, ...patch } as SessaoIdea : current); toast.success('Ideia atualizada'); },
          })}
          onDelete={async () => {
            const ok = await confirm({ title: 'Excluir ideia?', destructive: true, confirmText: 'Excluir' });
            if (!ok) return;
            deleteMut.mutate(openIdea.id, { onSuccess: () => { toast.success('Ideia excluida'); setOpenIdea(null); } });
          }}
        />
      )}
    </div>
  );
}

function IdeaDetail({ idea, isOwner, onClose, onUpdate, onDelete }: {
  idea: SessaoIdea;
  isOwner: boolean;
  onClose: () => void;
  onUpdate: (patch: Partial<SessaoIdea>) => void;
  onDelete: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{idea.title}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Badge variant="outline" className={cn('text-[10px]', ideaStatusColors[idea.status])}>{ideaStatusLabels[idea.status]}</Badge>
            {idea.category && <Badge variant="outline" className="text-[10px]">{idea.category}</Badge>}
          </div>
          <div><Label className="text-xs">Titulo</Label><Input value={idea.title} onChange={(e) => onUpdate({ title: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={idea.status} onValueChange={(value) => onUpdate({ status: value as SessaoIdeaStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(ideaStatusLabels) as SessaoIdeaStatus[]).map((key) => (
                    <SelectItem key={key} value={key}>{ideaStatusLabels[key]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Categoria</Label><Input value={idea.category || ''} onChange={(e) => onUpdate({ category: e.target.value || null } as any)} /></div>
          </div>
          <div><Label className="text-xs">Notas</Label><Textarea rows={4} value={idea.notes || ''} onChange={(e) => onUpdate({ notes: e.target.value || null } as any)} /></div>
          {isOwner && (
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />Excluir ideia
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
