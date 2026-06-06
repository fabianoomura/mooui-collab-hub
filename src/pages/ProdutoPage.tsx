import { useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Calendar as CalendarIcon, CheckCircle2, ChevronDown, ChevronRight, Clock, Columns3, FileText,
  LayoutList, Package, Paperclip, Plus, Search as SearchIcon, Send, Trash2, UserRound, X,
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/integrations/supabase/client';
import {
  produtoStageLabels,
  useCreateProduto,
  useCreateProdutoDesignItem,
  useDeleteProduto,
  useDeleteProdutoDesignItem,
  useProdutoActivity,
  useProdutoComments,
  useAddProdutoComment,
  useProdutoDesignItems,
  useProdutos,
  useProdutoStages,
  useUpdateProduto,
  useUpdateProdutoDesignItem,
  useUpdateProdutoStage,
  type Produto,
  type ProdutoCollectionGroup,
  type ProdutoDesignItem,
  type ProdutoDesignStatus,
  type ProdutoStage,
  type ProdutoStageStatus,
} from '@/hooks/useProdutos';
import { useProdutoAttachments } from '@/hooks/useProdutoAttachments';
import { PipelineTracker } from '@/components/produto/PipelineTracker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useConfirm } from '@/components/ConfirmDialog';
import { LinkedItems } from '@/components/LinkedItems';
import { cn } from '@/lib/utils';

type OrgMember = { id: string; full_name: string | null };

const groupLabels: Record<ProdutoCollectionGroup, string> = {
  novas_ideias: 'Novas ideias',
  em_desenvolvimento: 'Em desenvolvimento',
  em_validacao: 'Em validacao',
  aprovado: 'Aprovado',
  arquivado: 'Arquivado',
};

const groupColors: Record<ProdutoCollectionGroup, string> = {
  novas_ideias: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  em_desenvolvimento: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  em_validacao: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  aprovado: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  arquivado: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
};

const stageStatusLabels: Record<ProdutoStageStatus, string> = {
  nao_iniciado: 'Nao iniciado',
  em_andamento: 'Em andamento',
  bloqueado: 'Bloqueado',
  finalizado: 'Finalizado',
};

const designStatusLabels: Record<ProdutoDesignStatus, string> = {
  pendente: 'Pendente',
  em_desenvolvimento: 'Em desenvolvimento',
  aprovado: 'Aprovado',
  cancelado: 'Cancelado',
};

const designStatusColors: Record<ProdutoDesignStatus, string> = {
  pendente: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
  em_desenvolvimento: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  aprovado: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  cancelado: 'bg-red-500/15 text-red-700 dark:text-red-300',
};

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function SheetCell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('min-h-10 min-w-[150px] border-r border-border/80 bg-background px-3 py-2 text-xs last:border-r-0', className)}>
      {children}
    </div>
  );
}

function SheetHeaderCell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-[150px] border-r border-border/80 bg-muted/70 px-3 py-2.5 text-xs font-semibold text-muted-foreground last:border-r-0', className)}>
      {children}
    </div>
  );
}

function SundayTableToolbar({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center gap-3 border-b bg-background px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-sm bg-primary" />
        <span className="text-sm font-semibold">{title}</span>
        <Badge variant="outline" className="text-[10px]">Sunday puro</Badge>
      </div>
      <div className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
        <span>{count} elementos</span>
        <span className="rounded border px-2 py-1">Agrupado por Grupo</span>
      </div>
    </div>
  );
}

export default function ProdutoPage() {
  const { currentOrg } = useOrganization();
  const { data: orgMembers = [] } = useQuery({
    queryKey: ['org-members-produtos', currentOrg?.id],
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
        <h1 className="text-2xl font-bold">Novos Produtos</h1>
        <p className="text-sm text-muted-foreground">Pipeline de desenvolvimento da concepcao a apresentacao.</p>
      </div>
      <ProdutosList orgMembers={orgMembers} />
    </div>
  );
}

function ProdutosList({ orgMembers }: { orgMembers: OrgMember[] }) {
  const { user } = useAuth();
  const { data: produtos = [], isLoading } = useProdutos();
  const createMut = useCreateProduto();
  const updateMut = useUpdateProduto();
  const deleteMut = useDeleteProduto();
  const confirm = useConfirm();

  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState<'all' | ProdutoCollectionGroup>('all');
  const [viewMode, setViewMode] = useState<'list' | 'calendar' | 'kanban'>('list');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [nName, setNName] = useState('');
  const [nGroup, setNGroup] = useState<ProdutoCollectionGroup>('novas_ideias');
  const [nResponsible, setNResponsible] = useState('');
  const [nLaunchTarget, setNLaunchTarget] = useState('');
  const [nStart, setNStart] = useState('');
  const [nEnd, setNEnd] = useState('');
  const [nObservations, setNObservations] = useState('');

  const userIds = useMemo(() => {
    const ids = new Set<string>();
    produtos.forEach((produto) => {
      ids.add(produto.created_by);
      if (produto.responsible) ids.add(produto.responsible);
    });
    return [...ids];
  }, [produtos]);

  const { data: profiles = [] } = useQuery({
    queryKey: ['produto-profiles', userIds.sort().join(',')],
    queryFn: async () => {
      if (userIds.length === 0) return [];
      const { data } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
      return data || [];
    },
    enabled: userIds.length > 0,
  });

  const profileMap = useMemo(() => new Map((profiles as OrgMember[]).map((p) => [p.id, p])), [profiles]);
  const q = search.trim().toLowerCase();
  const filtered = produtos.filter((produto) => {
    if (groupFilter !== 'all' && produto.collection_group !== groupFilter) return false;
    if (!q) return true;
    return (
      produto.name.toLowerCase().includes(q) ||
      (produto.code || '').toLowerCase().includes(q) ||
      (produto.observations || '').toLowerCase().includes(q)
    );
  });

  const handleCreate = () => {
    if (!nName.trim()) return;
    createMut.mutate({
      name: nName.trim(),
      collection_group: nGroup,
      responsible: nResponsible || undefined,
      launch_target: nLaunchTarget || undefined,
      cronograma_start: nStart || undefined,
      cronograma_end: nEnd || undefined,
      observations: nObservations || undefined,
    }, {
      onSuccess: () => {
        toast.success('Produto criado');
        setShowNew(false);
        setNName('');
        setNGroup('novas_ideias');
        setNResponsible('');
        setNLaunchTarget('');
        setNStart('');
        setNEnd('');
        setNObservations('');
      },
      onError: (e: any) => toast.error(e?.message || 'Erro ao criar produto'),
    });
  };

  const groupCounts = useMemo(() => {
    const counts = new Map<ProdutoCollectionGroup, number>();
    produtos.forEach((produto) => counts.set(produto.collection_group, (counts.get(produto.collection_group) || 0) + 1));
    return counts;
  }, [produtos]);

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2">
        {(Object.keys(groupLabels) as ProdutoCollectionGroup[]).map((group) => (
          <Card
            key={group}
            role="button"
            tabIndex={0}
            onClick={() => setGroupFilter(groupFilter === group ? 'all' : group)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setGroupFilter(groupFilter === group ? 'all' : group);
              }
            }}
            className={cn(
              'p-3 cursor-pointer transition-colors hover:border-primary/40',
              groupFilter === group && 'border-primary bg-primary/5',
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">{groupLabels[group]}</span>
              <Badge variant="outline" className="text-[10px]">{groupCounts.get(group) || 0}</Badge>
            </div>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex flex-1 min-w-[240px] gap-2">
          <div className="relative flex-1 min-w-0">
            <SearchIcon className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-9 pl-8" placeholder="Buscar produto, codigo ou observacao" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={groupFilter} onValueChange={(value) => setGroupFilter(value as any)}>
            <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os grupos</SelectItem>
              {(Object.keys(groupLabels) as ProdutoCollectionGroup[]).map((key) => (
                <SelectItem key={key} value={key}>{groupLabels[key]}</SelectItem>
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
          <Button size="sm" variant={viewMode === 'kanban' ? 'secondary' : 'ghost'} className="h-7 px-2" onClick={() => setViewMode('kanban')}>
            <Columns3 className="h-3.5 w-3.5" />
          </Button>
        </div>
        <Button size="sm" onClick={() => setShowNew(true)}><Plus className="h-4 w-4 mr-1" />Novo produto</Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">Nenhum produto encontrado.</Card>
      ) : viewMode === 'calendar' ? (
        <ProdutosCalendar produtos={filtered} onOpen={(produto) => { setExpandedId(produto.id); setViewMode('list'); }} />
      ) : viewMode === 'kanban' ? (
        <ProdutosKanban produtos={filtered} profileMap={profileMap} onOpen={(produto) => { setExpandedId(produto.id); setViewMode('list'); }} onGroupChange={(id, group) => updateMut.mutate({ id, collection_group: group } as any)} />
      ) : (
        <ProdutosSheetTable
          produtos={filtered}
          expandedId={expandedId}
          onToggle={(id) => setExpandedId(expandedId === id ? null : id)}
          profileMap={profileMap}
          renderExpanded={(produto) => (
            <ProdutoExpanded
              produto={produto}
              orgMembers={orgMembers}
              isOwner={produto.created_by === user?.id}
              onUpdate={(patch) => updateMut.mutate({ id: produto.id, ...patch }, { onSuccess: () => toast.success('Produto atualizado') })}
              onDelete={async () => {
                const ok = await confirm({ title: 'Excluir este produto?', destructive: true, confirmText: 'Excluir' });
                if (!ok) return;
                deleteMut.mutate(produto.id, { onSuccess: () => { toast.success('Produto excluido'); setExpandedId(null); } });
              }}
            />
          )}
        />
      )}

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo produto</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Nome</Label><Input autoFocus value={nName} onChange={(e) => setNName(e.target.value)} placeholder="Nome do produto" /></div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Grupo</Label>
                <Select value={nGroup} onValueChange={(value) => setNGroup(value as ProdutoCollectionGroup)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(groupLabels) as ProdutoCollectionGroup[]).map((key) => (
                      <SelectItem key={key} value={key}>{groupLabels[key]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Responsavel</Label>
                <Select value={nResponsible || '_none'} onValueChange={(value) => setNResponsible(value === '_none' ? '' : value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Ninguem</SelectItem>
                    {orgMembers.map((member) => (
                      <SelectItem key={member.id} value={member.id}>{member.full_name || 'Usuario'}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <div><Label className="text-xs">Lancamento alvo</Label><Input type="date" value={nLaunchTarget} onChange={(e) => setNLaunchTarget(e.target.value)} /></div>
              <div><Label className="text-xs">Inicio</Label><Input type="date" value={nStart} onChange={(e) => setNStart(e.target.value)} /></div>
              <div><Label className="text-xs">Fim</Label><Input type="date" value={nEnd} onChange={(e) => setNEnd(e.target.value)} /></div>
            </div>
            <div><Label className="text-xs">Observacoes</Label><Textarea rows={3} value={nObservations} onChange={(e) => setNObservations(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!nName.trim() || createMut.isPending}>Criar produto</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProdutosSheetTable({
  produtos,
  expandedId,
  onToggle,
  profileMap,
  renderExpanded,
}: {
  produtos: Produto[];
  expandedId: string | null;
  onToggle: (id: string) => void;
  profileMap: Map<string, OrgMember>;
  renderExpanded: (produto: Produto) => ReactNode;
}) {
  const grouped = useMemo(() => {
    return produtoKanbanGroups
      .map((group) => ({ group, items: produtos.filter((produto) => produto.collection_group === group) }))
      .filter((entry) => entry.items.length > 0);
  }, [produtos]);

  return (
    <Card className="overflow-hidden border shadow-sm">
      <SundayTableToolbar title="Board de Produtos" count={produtos.length} />
      <div className="overflow-x-auto">
        <div className="min-w-max">
          <div className="grid grid-flow-col auto-cols-max border-b">
            <SheetHeaderCell className="sticky left-0 z-10 min-w-[320px] bg-muted">Elemento</SheetHeaderCell>
            <SheetHeaderCell>Subelementos</SheetHeaderCell>
            <SheetHeaderCell>Pessoas</SheetHeaderCell>
            <SheetHeaderCell>Cronograma</SheetHeaderCell>
            <SheetHeaderCell>Lancamento</SheetHeaderCell>
            <SheetHeaderCell>Status</SheetHeaderCell>
            <SheetHeaderCell>Progresso</SheetHeaderCell>
            <SheetHeaderCell>Atualizado</SheetHeaderCell>
          </div>
          {grouped.map(({ group, items }) => (
            <div key={group}>
              <div className="border-b border-l-4 border-l-primary bg-primary/5 px-3 py-2 text-sm font-semibold text-foreground">
                {groupLabels[group]} <span className="ml-2 font-normal">{items.length} elementos</span>
              </div>
              {items.map((produto) => {
                const isExpanded = expandedId === produto.id;
                const responsible = produto.responsible ? profileMap.get(produto.responsible) : null;
                const cronograma = produto.cronograma_start && produto.cronograma_end
                  ? `${format(new Date(produto.cronograma_start + 'T12:00:00'), 'dd/MM', { locale: ptBR })} - ${format(new Date(produto.cronograma_end + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}`
                  : produto.cronograma_start
                    ? format(new Date(produto.cronograma_start + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })
                    : '';
                return (
                  <div key={produto.id} className="border-b last:border-b-0">
                    <button
                      type="button"
                      onClick={() => onToggle(produto.id)}
                      className="grid grid-flow-col auto-cols-max text-left transition-colors hover:bg-primary/5"
                    >
                      <SheetCell className="sticky left-0 z-10 flex min-w-[320px] items-center gap-2 bg-background font-medium">
                        {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                        <span className="truncate">{produto.name}</span>
                        {produto.code && <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{produto.code}</span>}
                      </SheetCell>
                      <SheetCell>15 etapas</SheetCell>
                      <SheetCell className="max-w-[220px] break-words">{responsible?.full_name || ''}</SheetCell>
                      <SheetCell className="max-w-[220px] break-words">{cronograma}</SheetCell>
                      <SheetCell>{produto.launch_target ? format(new Date(produto.launch_target + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR }) : ''}</SheetCell>
                      <SheetCell><Badge variant="outline" className={cn('text-[10px]', groupColors[produto.collection_group])}>{groupLabels[produto.collection_group]}</Badge></SheetCell>
                      <SheetCell>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                            <div className="h-full bg-emerald-500" style={{ width: `${produto.progress}%` }} />
                          </div>
                          <span>{produto.progress}%</span>
                        </div>
                      </SheetCell>
                      <SheetCell>{formatDistanceToNow(new Date(produto.updated_at), { addSuffix: true, locale: ptBR })}</SheetCell>
                    </button>
                    {isExpanded && <div className="min-w-[760px] bg-background">{renderExpanded(produto)}</div>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

/* ---- Produtos Kanban ---- */
const produtoKanbanGroups: ProdutoCollectionGroup[] = ['novas_ideias', 'em_desenvolvimento', 'em_validacao', 'aprovado', 'arquivado'];
const produtoKanbanDotColors: Record<ProdutoCollectionGroup, string> = {
  novas_ideias: 'bg-violet-500', em_desenvolvimento: 'bg-blue-500', em_validacao: 'bg-amber-500', aprovado: 'bg-emerald-500', arquivado: 'bg-slate-400',
};
const produtoKanbanColColors: Record<ProdutoCollectionGroup, string> = {
  novas_ideias: 'bg-violet-500/20', em_desenvolvimento: 'bg-blue-500/20', em_validacao: 'bg-amber-500/20', aprovado: 'bg-emerald-500/20', arquivado: 'bg-slate-400/20',
};

function ProdutosKanban({
  produtos, profileMap, onOpen, onGroupChange,
}: {
  produtos: Produto[];
  profileMap: Map<string, any>;
  onOpen: (produto: Produto) => void;
  onGroupChange: (id: string, group: ProdutoCollectionGroup) => void;
}) {
  const columns = useMemo(() => {
    return produtoKanbanGroups.map(group => ({
      id: group,
      title: groupLabels[group],
      items: produtos.filter(p => p.collection_group === group),
    }));
  }, [produtos]);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const newGroup = result.destination.droppableId as ProdutoCollectionGroup;
    const item = produtos.find(p => p.id === result.draggableId);
    if (!item || item.collection_group === newGroup) return;
    onGroupChange(item.id, newGroup);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {columns.map(col => (
          <div key={col.id} className="flex-shrink-0 w-64">
            <div className={`rounded-lg px-3 py-2 mb-3 flex items-center gap-2 ${produtoKanbanColColors[col.id]}`}>
              <div className={`h-2.5 w-2.5 rounded-full ${produtoKanbanDotColors[col.id]}`} />
              <span className="text-sm font-semibold">{col.title}</span>
              <span className="text-xs text-muted-foreground bg-background/60 rounded-full px-2 py-0.5">{col.items.length}</span>
            </div>
            <Droppable droppableId={col.id}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={cn(
                    'space-y-2 min-h-[120px] rounded-lg p-1 transition-colors',
                    snapshot.isDraggingOver && 'bg-primary/5 ring-1 ring-primary/20'
                  )}
                >
                  {col.items.map((produto, index) => {
                    const responsible = produto.responsible ? profileMap.get(produto.responsible) : null;
                    return (
                      <Draggable key={produto.id} draggableId={produto.id} index={index}>
                        {(prov, snap) => (
                          <div
                            ref={prov.innerRef}
                            {...prov.draggableProps}
                            {...prov.dragHandleProps}
                            onClick={() => onOpen(produto)}
                            className={cn(
                              'rounded-md border bg-card p-2.5 cursor-pointer hover:border-primary/40 transition-colors',
                              snap.isDragging && 'shadow-lg ring-2 ring-primary/30'
                            )}
                          >
                            {produto.code && (
                              <span className="text-[9px] font-mono font-semibold text-muted-foreground bg-muted px-1 py-0.5 rounded">{produto.code}</span>
                            )}
                            <p className="text-sm font-medium leading-tight line-clamp-2 mt-1">{produto.name}</p>
                            <div className="h-1.5 rounded-full bg-muted mt-1.5 overflow-hidden">
                              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${produto.progress}%` }} />
                            </div>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-[10px] text-muted-foreground">{produto.progress}%</span>
                              {produto.launch_target && (
                                <span className="text-[10px] text-muted-foreground">
                                  {format(new Date(produto.launch_target + 'T12:00:00'), 'dd/MM', { locale: ptBR })}
                                </span>
                              )}
                            </div>
                            {responsible && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{(responsible as any).full_name || 'Usuario'}</p>}
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>
        ))}
      </div>
    </DragDropContext>
  );
}

function ProdutosCalendar({ produtos, onOpen }: { produtos: Produto[]; onOpen: (produto: Produto) => void }) {
  const byMonth = useMemo(() => {
    const map = new Map<number, Produto[]>();
    for (let month = 0; month < 12; month++) map.set(month, []);
    produtos.forEach((produto) => {
      const date = produto.cronograma_start || produto.launch_target;
      if (!date) return;
      map.get(new Date(date + 'T12:00:00').getMonth())?.push(produto);
    });
    return map;
  }, [produtos]);
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
                {items.map((produto) => {
                  const date = produto.cronograma_start || produto.launch_target;
                  return (
                    <button key={produto.id} className="w-full rounded-md p-2 text-left hover:bg-muted/60 transition-colors" onClick={() => onOpen(produto)}>
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-orange-500 shrink-0" />
                        <span className="text-xs font-medium truncate flex-1">{produto.name}</span>
                        <Badge variant="outline" className="text-[10px]">{produto.progress}%</Badge>
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <CalendarIcon className="h-3 w-3" />
                        <span>{date ? format(new Date(date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR }) : 'Sem data'}</span>
                        <span>-</span>
                        <span>{groupLabels[produto.collection_group]}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function ProdutoExpanded({
  produto, orgMembers, isOwner, onUpdate, onDelete,
}: {
  produto: Produto;
  orgMembers: OrgMember[];
  isOwner: boolean;
  onUpdate: (patch: Partial<Produto>) => void;
  onDelete: () => void;
}) {
  const { user } = useAuth();
  const { data: stages = [] } = useProdutoStages(produto.id);
  const { data: activity = [] } = useProdutoActivity(produto.id);
  const { data: comments = [] } = useProdutoComments(produto.id);
  const addComment = useAddProdutoComment();
  const { attachments, isLoading: attLoading, uploadFile, deleteAttachment } = useProdutoAttachments(produto.id);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const selectedStage = stages.find((stage) => stage.id === selectedStageId) || stages[0] || null;
  const [detailTab, setDetailTab] = useState<'comments' | 'files' | 'activity'>('comments');
  const [commentText, setCommentText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Profiles for comments
  const commentUserIds = [...new Set(comments.map(c => c.user_id))];
  const { data: cProfiles = [] } = useQuery({
    queryKey: ['produto-cprofiles', commentUserIds.sort().join(',')],
    queryFn: async () => {
      if (commentUserIds.length === 0) return [];
      const { data } = await supabase.from('profiles').select('id, full_name').in('id', commentUserIds);
      return data || [];
    },
    enabled: commentUserIds.length > 0,
  });
  const cMap = new Map((cProfiles as any[]).map(p => [p.id, p]));

  // Activity profiles
  const actUserIds = [...new Set(activity.filter(a => a.user_id).map(a => a.user_id!))];
  const { data: aProfiles = [] } = useQuery({
    queryKey: ['produto-aprofiles', actUserIds.sort().join(',')],
    queryFn: async () => {
      if (actUserIds.length === 0) return [];
      const { data } = await supabase.from('profiles').select('id, full_name').in('id', actUserIds);
      return data || [];
    },
    enabled: actUserIds.length > 0,
  });
  const aMap = new Map((aProfiles as any[]).map(p => [p.id, p]));

  const sendComment = () => {
    if (!commentText.trim()) return;
    addComment.mutate({ produtoId: produto.id, content: commentText.trim() }, {
      onSuccess: () => setCommentText(''),
      onError: () => toast.error('Erro ao enviar'),
    });
  };

  return (
    <div className="px-3 pb-3 pt-3 border-t space-y-4">
      <div className="grid lg:grid-cols-[1fr_280px] gap-4">
        <div className="space-y-3">
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Grupo</Label>
              <Select value={produto.collection_group} onValueChange={(value) => onUpdate({ collection_group: value as ProdutoCollectionGroup })}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(groupLabels) as ProdutoCollectionGroup[]).map((key) => (
                    <SelectItem key={key} value={key}>{groupLabels[key]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Responsavel</Label>
              <Select value={produto.responsible || '_none'} onValueChange={(value) => onUpdate({ responsible: value === '_none' ? null : value } as any)}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Ninguem</SelectItem>
                  {orgMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>{member.full_name || 'Usuario'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Lancamento alvo</Label>
              <Input type="date" className="h-8" value={produto.launch_target || ''} onChange={(e) => onUpdate({ launch_target: e.target.value || null } as any)} />
            </div>
            <div>
              <Label className="text-xs">Inicio cronograma</Label>
              <Input type="date" className="h-8" value={produto.cronograma_start || ''} onChange={(e) => onUpdate({ cronograma_start: e.target.value || null } as any)} />
            </div>
            <div>
              <Label className="text-xs">Fim cronograma</Label>
              <Input type="date" className="h-8" value={produto.cronograma_end || ''} onChange={(e) => onUpdate({ cronograma_end: e.target.value || null } as any)} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Observacoes</Label>
            <Textarea rows={3} value={produto.observations || ''} onChange={(e) => onUpdate({ observations: e.target.value || null } as any)} />
          </div>
        </div>
        <div className="space-y-3">
          <Card className="p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Progresso</span>
              <span className="text-muted-foreground">{produto.progress}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted mt-2 overflow-hidden">
              <div className="h-full bg-emerald-500 transition-all" style={{ width: `${produto.progress}%` }} />
            </div>
          </Card>
          <LinkedItems sourceType="produto" sourceId={produto.id} />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs">Pipeline de desenvolvimento</Label>
          <Badge variant="outline" className="text-[10px]">{stages.filter((stage) => stage.status === 'finalizado').length}/15 etapas</Badge>
        </div>
        <PipelineTracker stages={stages} selectedStageId={selectedStage?.id} onSelectStage={setSelectedStageId} />
        {selectedStage && <StageEditor stage={selectedStage} orgMembers={orgMembers} />}
      </div>

      <DesignItemsPanel produtoId={produto.id} />

      {/* Tabs: Comentarios / Anexos / Atividade */}
      <Tabs value={detailTab} onValueChange={(v) => setDetailTab(v as any)}>
        <TabsList>
          <TabsTrigger value="comments">Comentarios ({comments.length})</TabsTrigger>
          <TabsTrigger value="files">Anexos ({attachments.length})</TabsTrigger>
          <TabsTrigger value="activity">Atividade ({activity.length})</TabsTrigger>
        </TabsList>
      </Tabs>

      {detailTab === 'comments' && (
        <div className="space-y-3">
          {comments.length === 0 && <p className="text-xs text-muted-foreground">Nenhum comentario.</p>}
          {comments.map(c => {
            const cp = cMap.get(c.user_id) as any;
            return (
              <div key={c.id} className="flex gap-2">
                <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium shrink-0">
                  {cp?.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-medium">{cp?.full_name || 'Usuario'}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: ptBR })}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{c.content}</p>
                </div>
              </div>
            );
          })}
          <div className="flex gap-2">
            <Input placeholder="Escrever comentario..." value={commentText} onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendComment(); } }} className="h-8 text-sm" />
            <Button size="sm" className="h-8 px-3" onClick={sendComment} disabled={!commentText.trim() || addComment.isPending}>
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {detailTab === 'files' && (
        <div className="space-y-3">
          <input ref={fileRef} type="file" multiple className="hidden"
            onChange={(e) => {
              if (e.target.files) {
                Array.from(e.target.files).forEach(file => {
                  if (file.size > 50 * 1024 * 1024) { toast.error(`${file.name} excede 50MB`); return; }
                  uploadFile.mutate({ produtoId: produto.id, file }, {
                    onSuccess: () => toast.success(`${file.name} enviado`),
                    onError: () => toast.error(`Erro ao enviar ${file.name}`),
                  });
                });
              }
              e.target.value = '';
            }} />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploadFile.isPending}>
            <Paperclip className="h-3.5 w-3.5 mr-1.5" />Anexar arquivo
          </Button>
          {attLoading && <p className="text-xs text-muted-foreground">Carregando...</p>}
          {attachments.length === 0 && !attLoading && <p className="text-xs text-muted-foreground">Nenhum anexo.</p>}
          {attachments.map(a => (
            <div key={a.id} className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              {a.signed_url ? (
                <a href={a.signed_url} target="_blank" rel="noopener noreferrer" className="truncate text-primary hover:underline flex-1">{a.file_name}</a>
              ) : (
                <span className="truncate flex-1">{a.file_name}</span>
              )}
              <span className="text-xs text-muted-foreground shrink-0">{a.file_size ? `${(a.file_size / 1024).toFixed(0)} KB` : ''}</span>
              {a.user_id === user?.id && (
                <button onClick={() => deleteAttachment.mutate(a.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {detailTab === 'activity' && (
        <div className="space-y-2">
          {activity.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma atividade.</p>}
          {activity.map(a => {
            const ap = a.user_id ? (aMap.get(a.user_id) as any) : null;
            return (
              <div key={a.id} className="flex items-start gap-2 text-xs">
                <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <span className="font-medium">{ap?.full_name || 'Sistema'}</span>
                  {a.action === 'created' && <span> criou o produto</span>}
                  {a.action === 'collection_group' && <span> alterou grupo: {a.from_value} → {a.to_value}</span>}
                  {a.action === 'responsible' && <span> alterou responsavel</span>}
                  {a.action === 'stage_status' && <span> alterou etapa: {a.from_value} → {a.to_value}</span>}
                  {!['created', 'collection_group', 'responsible', 'stage_status'].includes(a.action) && <span> {a.action}: {a.from_value || '-'} → {a.to_value || '-'}</span>}
                  <span className="text-muted-foreground ml-2">
                    {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: ptBR })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete button */}
      {isOwner && (
        <div className="pt-2 border-t">
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />Excluir produto
          </Button>
        </div>
      )}
    </div>
  );
}

function StageEditor({ stage, orgMembers }: { stage: ProdutoStage; orgMembers: OrgMember[] }) {
  const updateStage = useUpdateProdutoStage();
  const patch = (input: Partial<ProdutoStage>) => updateStage.mutate({ id: stage.id, produto_id: stage.produto_id, ...input });

  return (
    <Card className="p-3">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center shrink-0">
          <Package className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-start gap-2 flex-wrap">
            <h3 className="font-medium flex-1 min-w-0">{produtoStageLabels[stage.stage_key]}</h3>
            {stage.completed_at && <Badge variant="outline" className="text-[10px]">Concluida em {format(new Date(stage.completed_at + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}</Badge>}
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={stage.status} onValueChange={(value) => patch({ status: value as ProdutoStageStatus })}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(stageStatusLabels) as ProdutoStageStatus[]).map((key) => (
                    <SelectItem key={key} value={key}>{stageStatusLabels[key]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Responsavel etapa</Label>
              <Select value={stage.assignee_id || '_none'} onValueChange={(value) => patch({ assignee_id: value === '_none' ? null : value } as any)}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Ninguem</SelectItem>
                  {orgMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>{member.full_name || 'Usuario'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Data conclusao</Label>
              <Input type="date" className="h-8" value={stage.completed_at || ''} onChange={(e) => patch({ completed_at: e.target.value || null } as any)} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Notas da etapa</Label>
            <Textarea rows={2} value={stage.notes || ''} onChange={(e) => patch({ notes: e.target.value || null } as any)} />
          </div>
        </div>
      </div>
    </Card>
  );
}

function DesignItemsPanel({ produtoId }: { produtoId: string }) {
  const { data: items = [] } = useProdutoDesignItems(produtoId);
  const createItem = useCreateProdutoDesignItem();
  const updateItem = useUpdateProdutoDesignItem();
  const deleteItem = useDeleteProdutoDesignItem();
  const [newName, setNewName] = useState('');
  const [newQty, setNewQty] = useState('1');

  const addItem = () => {
    if (!newName.trim()) return;
    createItem.mutate({
      produto_id: produtoId,
      name: newName.trim(),
      qt_variacoes: Number(newQty) || 1,
      position: items.length,
    }, {
      onSuccess: () => {
        setNewName('');
        setNewQty('1');
      },
    });
  };

  return (
    <Card className="p-3">
      <div className="flex items-center justify-between gap-2 mb-3">
        <Label className="text-xs">Subelementos do produto</Label>
        <Badge variant="outline" className="text-[10px]">{items.length} itens</Badge>
      </div>
      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum subelemento cadastrado.</p>
        ) : items.map((item) => (
          <DesignItemRow
            key={item.id}
            item={item}
            onUpdate={(patch) => updateItem.mutate({ id: item.id, produto_id: produtoId, ...patch })}
            onDelete={() => deleteItem.mutate({ id: item.id, produto_id: produtoId })}
          />
        ))}
      </div>
      <div className="grid sm:grid-cols-[1fr_90px_auto] gap-2 mt-3">
        <Input className="h-8" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Novo subelemento..." onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }} />
        <Input className="h-8" type="number" min="1" value={newQty} onChange={(e) => setNewQty(e.target.value)} />
        <Button size="sm" className="h-8" onClick={addItem} disabled={!newName.trim()}><Plus className="h-3.5 w-3.5 mr-1" />Adicionar</Button>
      </div>
    </Card>
  );
}

function DesignItemRow({ item, onUpdate, onDelete }: {
  item: ProdutoDesignItem;
  onUpdate: (patch: Partial<ProdutoDesignItem>) => void;
  onDelete: () => void;
}) {
  return (
    <div className="border rounded-md p-2 space-y-2">
      <div className="flex items-center gap-2">
        <button
          className={cn('h-5 w-5 rounded border shrink-0 flex items-center justify-center', item.status === 'aprovado' ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-muted-foreground/40')}
          onClick={() => onUpdate({ status: item.status === 'aprovado' ? 'pendente' : 'aprovado' })}
        >
          {item.status === 'aprovado' && <CheckCircle2 className="h-3.5 w-3.5" />}
        </button>
        <Input className="h-7 flex-1 min-w-0 font-medium" value={item.name} onChange={(e) => onUpdate({ name: e.target.value })} />
        <button className="text-muted-foreground hover:text-destructive" onClick={onDelete}><X className="h-3.5 w-3.5" /></button>
      </div>
      <div className="grid sm:grid-cols-3 gap-2">
        <Select value={item.status} onValueChange={(value) => onUpdate({ status: value as ProdutoDesignStatus })}>
          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(designStatusLabels) as ProdutoDesignStatus[]).map((key) => (
              <SelectItem key={key} value={key}>{designStatusLabels[key]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input className="h-8" type="number" min="1" value={item.qt_variacoes ?? 1} onChange={(e) => onUpdate({ qt_variacoes: Number(e.target.value) || 1 } as any)} />
        <Input className="h-8" type="date" value={item.target_date || ''} onChange={(e) => onUpdate({ target_date: e.target.value || null } as any)} />
      </div>
      <Badge variant="outline" className={cn('text-[10px]', designStatusColors[item.status])}>{designStatusLabels[item.status]}</Badge>
    </div>
  );
}
