import { useMemo, useRef, useState } from 'react';
import { Plus, Globe, Monitor, Search as SearchIcon, Code, BarChart3, X, Send, Trash2, Paperclip, Clock, CheckCircle2, AlertCircle, FileText, LayoutList, ChevronDown, ChevronRight, Circle } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  useMelhorias, useCreateMelhoria, useUpdateMelhoria, useDeleteMelhoria,
  useMelhoriaComments, useAddMelhoriaComment, useMelhoriaActivity,
  useMelhoriaSubitems, useCreateMelhoriaSubitem, useUpdateMelhoriaSubitem, useDeleteMelhoriaSubitem,
  type Melhoria, type MelhoriaStatus, type MelhoriaPriority, type MelhoriaArea, type MelhoriaSubitem,
} from '@/hooks/useMelhorias';
import { useMelhoriaAttachments } from '@/hooks/useMelhoriaAttachments';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useConfirm } from '@/components/ConfirmDialog';
import { cn } from '@/lib/utils';
import { LinkedItems } from '@/components/LinkedItems';
import { Progress } from '@/components/ui/progress';

const priorityColors: Record<MelhoriaPriority, string> = {
  low: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
  medium: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  high: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
  critical: 'bg-destructive/15 text-destructive',
};
const priorityLabels: Record<MelhoriaPriority, string> = {
  low: 'Baixa', medium: 'Média', high: 'Alta', critical: 'Crítica',
};
const statusLabels: Record<MelhoriaStatus, string> = {
  open: 'Aberta', in_progress: 'Em andamento', done: 'Concluída', rejected: 'Rejeitada',
};
const statusColors: Record<MelhoriaStatus, string> = {
  open: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  in_progress: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  done: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  rejected: 'bg-muted text-muted-foreground',
};
const areaLabels: Record<MelhoriaArea, string> = {
  site_melhorias: 'Site Melhorias',
  shopify: 'Shopify',
  seo_onpage: 'SEO On-Page',
  seo_tecnico: 'SEO Técnico',
};
const areaIcons: Record<MelhoriaArea, typeof Globe> = {
  site_melhorias: Globe,
  shopify: Monitor,
  seo_onpage: SearchIcon,
  seo_tecnico: Code,
};

function getInitials(name?: string | null) {
  return name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
}

export default function MelhoriasPage() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const { data: melhorias = [], isLoading } = useMelhorias();
  const createMut = useCreateMelhoria();
  const updateMut = useUpdateMelhoria();
  const deleteMut = useDeleteMelhoria();
  const confirm = useConfirm();

  const [filter, setFilter] = useState<'all' | MelhoriaStatus>('all');
  const [showNew, setShowNew] = useState(false);
  const [openItem, setOpenItem] = useState<Melhoria | null>(null);
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'all' | MelhoriaPriority>('all');
  const [areaFilter, setAreaFilter] = useState<'all' | MelhoriaArea>('all');
  const [scope, setScope] = useState<'all' | 'mine' | 'assigned'>('all');
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');

  // New form state
  const [nTitle, setNTitle] = useState('');
  const [nDesc, setNDesc] = useState('');
  const [nPriority, setNPriority] = useState<MelhoriaPriority>('medium');
  const [nArea, setNArea] = useState<MelhoriaArea>('site_melhorias');
  const [nFiles, setNFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profiles
  const userIds = useMemo(() => {
    const ids = new Set<string>();
    melhorias.forEach(m => { ids.add(m.created_by); if (m.assigned_to) ids.add(m.assigned_to); });
    return [...ids];
  }, [melhorias]);
  const { data: profiles = [] } = useQuery({
    queryKey: ['melhoria-profiles', userIds.sort().join(',')],
    queryFn: async () => {
      if (userIds.length === 0) return [];
      const { data } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
      return data || [];
    },
    enabled: userIds.length > 0,
  });
  const profileMap = useMemo(() => new Map(profiles.map((p: any) => [p.id, p])), [profiles]);

  // Org members for assignment
  const { data: orgMembers = [] } = useQuery({
    queryKey: ['org-members-melhorias', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return [];
      const { data } = await supabase
        .from('organization_members').select('user_id')
        .eq('organization_id', currentOrg.id);
      const ids = (data || []).map((m: any) => m.user_id);
      if (ids.length === 0) return [];
      const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', ids);
      return profs || [];
    },
    enabled: !!currentOrg,
  });

  // Filtering
  const q = search.trim().toLowerCase();
  const baseFiltered = melhorias.filter(m => {
    if (scope === 'mine' && m.created_by !== user?.id) return false;
    if (scope === 'assigned' && m.assigned_to !== user?.id) return false;
    if (priorityFilter !== 'all' && m.priority !== priorityFilter) return false;
    if (areaFilter !== 'all' && m.area !== areaFilter) return false;
    if (q && !(m.title.toLowerCase().includes(q) || (m.description || '').toLowerCase().includes(q))) return false;
    return true;
  });
  const filtered = baseFiltered.filter(m => filter === 'all' ? true : m.status === filter);
  const counts = {
    all: baseFiltered.length,
    open: baseFiltered.filter(m => m.status === 'open').length,
    in_progress: baseFiltered.filter(m => m.status === 'in_progress').length,
    done: baseFiltered.filter(m => m.status === 'done').length,
    rejected: baseFiltered.filter(m => m.status === 'rejected').length,
  };
  const activeChips = (priorityFilter !== 'all' ? 1 : 0) + (areaFilter !== 'all' ? 1 : 0) + (scope !== 'all' ? 1 : 0) + (q ? 1 : 0);

  const handleCreate = () => {
    if (!nTitle.trim()) return;
    createMut.mutate(
      { title: nTitle.trim(), description: nDesc.trim(), priority: nPriority, area: nArea },
      {
        onSuccess: async (data: any) => {
          const mid = data?.id;
          if (mid && nFiles.length > 0 && user) {
            await Promise.allSettled(nFiles.map(async (file) => {
              const ext = file.name.split('.').pop() || 'bin';
              const path = `${mid}/${crypto.randomUUID()}.${ext}`;
              const { error: upErr } = await supabase.storage.from('melhoria-attachments').upload(path, file, {
                contentType: file.type, upsert: false,
              });
              if (upErr) return;
              await supabase.from('melhoria_attachments' as any).insert({
                melhoria_id: mid, user_id: user.id,
                file_url: path, file_name: file.name,
                file_size: file.size, file_type: file.type || null,
              });
            }));
          }
          toast.success('Melhoria criada!');
          setShowNew(false);
          setNTitle(''); setNDesc(''); setNPriority('medium'); setNArea('site_melhorias'); setNFiles([]);
        },
        onError: (e: any) => toast.error(e?.message || 'Erro'),
      }
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Melhorias de Site & Sistemas</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie melhorias de site, Shopify e SEO. Bugs e suporte ficam nos Tickets.
          </p>
        </div>
        <Button onClick={() => setShowNew(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Nova melhoria
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <SearchIcon className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por título ou descrição…" className="pl-8 h-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={scope} onValueChange={(v) => setScope(v as any)}>
            <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="assigned">Atribuídas a mim</SelectItem>
              <SelectItem value="mine">Criadas por mim</SelectItem>
            </SelectContent>
          </Select>
          <Select value={areaFilter} onValueChange={(v) => setAreaFilter(v as any)}>
            <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Área" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Qualquer área</SelectItem>
              {(Object.keys(areaLabels) as MelhoriaArea[]).map(k => (
                <SelectItem key={k} value={k}>{areaLabels[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as any)}>
            <SelectTrigger className="h-9 w-[140px]"><SelectValue placeholder="Prioridade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Qualquer prioridade</SelectItem>
              {(Object.keys(priorityLabels) as MelhoriaPriority[]).map(k => (
                <SelectItem key={k} value={k}>{priorityLabels[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {activeChips > 0 && (
            <Button variant="ghost" size="sm" className="h-9 text-xs text-muted-foreground"
              onClick={() => { setSearch(''); setPriorityFilter('all'); setAreaFilter('all'); setScope('all'); }}>
              <X className="h-3.5 w-3.5 mr-1" />Limpar
            </Button>
          )}
          <div className="flex items-center gap-1 rounded-md border p-1">
            <Button size="sm" variant={viewMode === 'list' ? 'secondary' : 'ghost'} className="h-7 px-2" onClick={() => setViewMode('list')}>
              <LayoutList className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant={viewMode === 'kanban' ? 'secondary' : 'ghost'} className="h-7 px-2" onClick={() => setViewMode('kanban')}>
              <BarChart3 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Status tabs */}
      <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="all">Todas <Badge variant="secondary" className="ml-1.5">{counts.all}</Badge></TabsTrigger>
          <TabsTrigger value="open">Abertas <Badge variant="secondary" className="ml-1.5">{counts.open}</Badge></TabsTrigger>
          <TabsTrigger value="in_progress">Em andamento <Badge variant="secondary" className="ml-1.5">{counts.in_progress}</Badge></TabsTrigger>
          <TabsTrigger value="done">Concluídas <Badge variant="secondary" className="ml-1.5">{counts.done}</Badge></TabsTrigger>
          <TabsTrigger value="rejected">Rejeitadas <Badge variant="secondary" className="ml-1.5">{counts.rejected}</Badge></TabsTrigger>
        </TabsList>
      </Tabs>

      {/* List */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          Nenhuma melhoria {filter !== 'all' ? `com status "${statusLabels[filter as MelhoriaStatus]}"` : ''}.
        </Card>
      ) : viewMode === 'kanban' ? (
        <MelhoriasKanban
          melhorias={baseFiltered}
          profileMap={profileMap as any}
          onOpen={setOpenItem}
          onStatusChange={(item, status) => updateMut.mutate({ id: item.id, status }, {
            onSuccess: () => toast.success('Status atualizado'),
            onError: (e: any) => toast.error(e?.message || 'Erro ao atualizar status'),
          })}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((m) => {
            const AreaIcon = areaIcons[m.area] || Globe;
            const author = profileMap.get(m.created_by) as any;
            const assignee = m.assigned_to ? (profileMap.get(m.assigned_to) as any) : null;
            return (
              <Card key={m.id} onClick={() => setOpenItem(m)} className="p-3 cursor-pointer hover:border-primary/40 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                    <AreaIcon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 flex-wrap">
                      {m.code && (
                        <span className="text-[10px] font-mono font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{m.code}</span>
                      )}
                      <h3 className="font-medium truncate flex-1 min-w-0">{m.title}</h3>
                      <Badge className={cn('text-[10px]', priorityColors[m.priority])} variant="outline">{priorityLabels[m.priority]}</Badge>
                      <Badge className={cn('text-[10px]', statusColors[m.status])} variant="outline">{statusLabels[m.status]}</Badge>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                      <Badge variant="outline" className="text-[10px]">{areaLabels[m.area]}</Badge>
                    </div>
                    {m.description && <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{m.description}</p>}
                    <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground">
                      <span>{author?.full_name || 'Usuário'}</span>
                      <span>·</span>
                      <span>{formatDistanceToNow(new Date(m.created_at), { addSuffix: true, locale: ptBR })}</span>
                      {assignee && (<><span>·</span><span>Atribuído: {assignee.full_name}</span></>)}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* New dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova melhoria</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Título</Label>
              <Input autoFocus value={nTitle} onChange={(e) => setNTitle(e.target.value)} placeholder="Descrição da melhoria" />
            </div>
            <div>
              <Label className="text-xs">Descrição</Label>
              <Textarea value={nDesc} onChange={(e) => setNDesc(e.target.value)} rows={4} placeholder="Detalhes, referência, objetivo…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Área</Label>
                <Select value={nArea} onValueChange={(v) => setNArea(v as MelhoriaArea)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(areaLabels) as MelhoriaArea[]).map(k => (
                      <SelectItem key={k} value={k}>{areaLabels[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Prioridade</Label>
                <Select value={nPriority} onValueChange={(v) => setNPriority(v as MelhoriaPriority)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(priorityLabels) as MelhoriaPriority[]).map(k => (
                      <SelectItem key={k} value={k}>{priorityLabels[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* File attachment */}
            <div>
              <Label className="text-xs">Anexos</Label>
              <input ref={fileInputRef} type="file" multiple className="hidden"
                onChange={(e) => { if (e.target.files) setNFiles(prev => [...prev, ...Array.from(e.target.files!)]); e.target.value = ''; }} />
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="mt-1 w-full border-2 border-dashed rounded-md p-3 text-sm text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors flex items-center justify-center gap-2">
                <Paperclip className="h-4 w-4" />Clique para anexar arquivos
              </button>
              {nFiles.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {nFiles.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs">
                      <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="truncate flex-1">{f.name}</span>
                      <span className="text-muted-foreground shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                      <button onClick={() => setNFiles(prev => prev.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!nTitle.trim() || createMut.isPending}>Criar melhoria</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      {openItem && (
        <MelhoriaDetail
          item={openItem}
          onClose={() => setOpenItem(null)}
          onUpdate={(patch) => updateMut.mutate({ id: openItem.id, ...patch }, {
            onSuccess: () => { setOpenItem(cur => cur ? { ...cur, ...patch } as Melhoria : cur); toast.success('Atualizado'); },
          })}
          onDelete={async () => {
            const ok = await confirm({ title: 'Excluir esta melhoria?', destructive: true, confirmText: 'Excluir' });
            if (!ok) return;
            deleteMut.mutate(openItem.id, { onSuccess: () => { toast.success('Melhoria excluída'); setOpenItem(null); } });
          }}
          isOwner={openItem.created_by === user?.id}
          orgMembers={orgMembers as any}
          profileMap={profileMap as any}
        />
      )}
    </div>
  );
}

function MelhoriasKanban({
  melhorias, profileMap, onOpen, onStatusChange,
}: {
  melhorias: Melhoria[];
  profileMap: Map<string, { id: string; full_name: string | null }>;
  onOpen: (item: Melhoria) => void;
  onStatusChange: (item: Melhoria, status: MelhoriaStatus) => void;
}) {
  const statuses = Object.keys(statusLabels) as MelhoriaStatus[];
  const byStatus = useMemo(() => {
    const map = new Map<MelhoriaStatus, Melhoria[]>();
    statuses.forEach((status) => map.set(status, []));
    melhorias.forEach((item) => map.get(item.status)?.push(item));
    return map;
  }, [melhorias]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
      {statuses.map((status) => {
        const items = byStatus.get(status) || [];
        return (
          <Card key={status} className="p-3 bg-muted/20">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'h-2.5 w-2.5 rounded-full',
                    status === 'open' && 'bg-amber-500',
                    status === 'in_progress' && 'bg-blue-500',
                    status === 'done' && 'bg-emerald-500',
                    status === 'rejected' && 'bg-slate-400',
                  )}
                />
                <h3 className="text-sm font-semibold">{statusLabels[status]}</h3>
              </div>
              <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
            </div>
            <div className="space-y-2">
              {items.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">-</p>}
              {items.map((item) => {
                const assignee = item.assigned_to ? profileMap.get(item.assigned_to) : null;
                return (
                  <div key={item.id} className="rounded-md border bg-card p-2 space-y-2">
                    <button className="w-full text-left" onClick={() => onOpen(item)}>
                      <div className="flex items-start gap-2">
                        {item.code && <span className="text-[10px] font-mono text-muted-foreground">{item.code}</span>}
                        <span className="text-xs font-medium flex-1 line-clamp-2">{item.title}</span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                        <Badge variant="outline" className={cn('text-[10px]', priorityColors[item.priority])}>{priorityLabels[item.priority]}</Badge>
                        <Badge variant="outline" className="text-[10px]">{areaLabels[item.area]}</Badge>
                      </div>
                      {assignee && <p className="mt-1 text-[10px] text-muted-foreground truncate">Responsavel: {assignee.full_name || 'Usuario'}</p>}
                    </button>
                    <Select value={item.status} onValueChange={(value) => onStatusChange(item, value as MelhoriaStatus)}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {statuses.map((key) => (
                          <SelectItem key={key} value={key}>{statusLabels[key]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Detail Dialog                                                     */
/* ---------------------------------------------------------------- */
function MelhoriaDetail({
  item, onClose, onUpdate, onDelete, isOwner, orgMembers, profileMap,
}: {
  item: Melhoria;
  onClose: () => void;
  onUpdate: (patch: Partial<Melhoria>) => void;
  onDelete: () => void;
  isOwner: boolean;
  orgMembers: { id: string; full_name: string | null }[];
  profileMap: Map<string, { id: string; full_name: string | null }>;
}) {
  const { user } = useAuth();
  const { data: comments = [] } = useMelhoriaComments(item.id);
  const { data: activity = [] } = useMelhoriaActivity(item.id);
  const addComment = useAddMelhoriaComment();
  const { attachments, isLoading: attLoading, uploadFile, deleteAttachment } = useMelhoriaAttachments(item.id);
  const [text, setText] = useState('');
  const [tab, setTab] = useState<'comments' | 'files' | 'activity'>('comments');
  const fileRef = useRef<HTMLInputElement>(null);

  // Profiles for comments
  const commentUserIds = [...new Set(comments.map(c => c.user_id))];
  const { data: cProfiles = [] } = useQuery({
    queryKey: ['melhoria-cprofiles', commentUserIds.sort().join(',')],
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
    queryKey: ['melhoria-aprofiles', actUserIds.sort().join(',')],
    queryFn: async () => {
      if (actUserIds.length === 0) return [];
      const { data } = await supabase.from('profiles').select('id, full_name').in('id', actUserIds);
      return data || [];
    },
    enabled: actUserIds.length > 0,
  });
  const aMap = new Map((aProfiles as any[]).map(p => [p.id, p]));

  const send = () => {
    if (!text.trim()) return;
    addComment.mutate({ melhoriaId: item.id, content: text.trim() }, {
      onSuccess: () => setText(''),
      onError: () => toast.error('Erro ao enviar'),
    });
  };

  const assignee = item.assigned_to ? profileMap.get(item.assigned_to) : null;
  const author = profileMap.get(item.created_by);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex-1 text-left flex items-baseline gap-2 flex-wrap pr-8">
            {item.code && <span className="text-xs font-mono font-semibold text-muted-foreground">{item.code}</span>}
            <span>{item.title}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Meta badges */}
          <div className="flex flex-wrap gap-2 items-center">
            <Badge variant="outline" className={cn('text-[10px]', statusColors[item.status])}>{statusLabels[item.status]}</Badge>
            <Badge variant="outline" className={cn('text-[10px]', priorityColors[item.priority])}>{priorityLabels[item.priority]}</Badge>
            <Badge variant="outline" className="text-[10px]">{areaLabels[item.area]}</Badge>
          </div>

          {item.description && <p className="text-sm whitespace-pre-wrap">{item.description}</p>}

          {/* Editable fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={item.status} onValueChange={(v) => onUpdate({ status: v as MelhoriaStatus })}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(statusLabels) as MelhoriaStatus[]).map(k => (
                    <SelectItem key={k} value={k}>{statusLabels[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Prioridade</Label>
              <Select value={item.priority} onValueChange={(v) => onUpdate({ priority: v as MelhoriaPriority })}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(priorityLabels) as MelhoriaPriority[]).map(k => (
                    <SelectItem key={k} value={k}>{priorityLabels[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Área</Label>
              <Select value={item.area} onValueChange={(v) => onUpdate({ area: v as MelhoriaArea })}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(areaLabels) as MelhoriaArea[]).map(k => (
                    <SelectItem key={k} value={k}>{areaLabels[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Responsável</Label>
              <Select value={item.assigned_to || '_none'} onValueChange={(v) => onUpdate({ assigned_to: v === '_none' ? null : v } as any)}>
                <SelectTrigger className="h-8"><SelectValue placeholder="Ninguém" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Ninguém</SelectItem>
                  {orgMembers.map((m: any) => (
                    <SelectItem key={m.id} value={m.id}>{m.full_name || 'Usuário'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Meta info */}
          <div className="text-xs text-muted-foreground space-y-0.5">
            <p>Criado por {(author as any)?.full_name || 'Usuário'} em {format(new Date(item.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
            {item.data_conclusao && <p>Concluído em {format(new Date(item.data_conclusao), 'dd/MM/yyyy', { locale: ptBR })}</p>}
          </div>

          {/* Subelementos */}
          <MelhoriaSubitemsSection melhoriaId={item.id} orgMembers={orgMembers} />

          {/* Linked items */}
          <LinkedItems sourceType="melhoria" sourceId={item.id} />

          {/* Tabs: Comments / Files / Activity */}
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList>
              <TabsTrigger value="comments">Comentários ({comments.length})</TabsTrigger>
              <TabsTrigger value="files">Anexos ({attachments.length})</TabsTrigger>
              <TabsTrigger value="activity">Atividade ({activity.length})</TabsTrigger>
            </TabsList>
          </Tabs>

          {tab === 'comments' && (
            <div className="space-y-3">
              {comments.length === 0 && <p className="text-xs text-muted-foreground">Nenhum comentário.</p>}
              {comments.map(c => {
                const cp = cMap.get(c.user_id) as any;
                return (
                  <div key={c.id} className="flex gap-2">
                    <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium shrink-0">
                      {getInitials(cp?.full_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs font-medium">{cp?.full_name || 'Usuário'}</span>
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
                <Input placeholder="Escrever comentário…" value={text} onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} className="h-8 text-sm" />
                <Button size="sm" className="h-8 px-3" onClick={send} disabled={!text.trim() || addComment.isPending}>
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

          {tab === 'files' && (
            <div className="space-y-3">
              <input ref={fileRef} type="file" multiple className="hidden"
                onChange={(e) => {
                  if (e.target.files) {
                    Array.from(e.target.files).forEach(file => {
                      uploadFile.mutate({ melhoriaId: item.id, file }, {
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
              {attLoading && <p className="text-xs text-muted-foreground">Carregando…</p>}
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

          {tab === 'activity' && (
            <div className="space-y-2">
              {activity.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma atividade.</p>}
              {activity.map(a => {
                const ap = a.user_id ? (aMap.get(a.user_id) as any) : null;
                return (
                  <div key={a.id} className="flex items-start gap-2 text-xs">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{ap?.full_name || 'Sistema'}</span>
                      {a.action === 'created' && <span> criou a melhoria</span>}
                      {a.action === 'status' && <span> alterou status: {a.from_value} → {a.to_value}</span>}
                      {a.action === 'priority' && <span> alterou prioridade: {a.from_value} → {a.to_value}</span>}
                      {a.action === 'area' && <span> alterou área: {a.from_value} → {a.to_value}</span>}
                      {a.action === 'assigned' && <span> alterou responsável</span>}
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
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />Excluir melhoria
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------------------------------------- */
/* Subitems Section (Sunday-like)                                    */
/* ---------------------------------------------------------------- */
function MelhoriaSubitemsSection({
  melhoriaId,
  orgMembers,
}: {
  melhoriaId: string;
  orgMembers: { id: string; full_name: string | null }[];
}) {
  const { data: subitems = [], isLoading } = useMelhoriaSubitems(melhoriaId);
  const createMut = useCreateMelhoriaSubitem();
  const updateMut = useUpdateMelhoriaSubitem();
  const deleteMut = useDeleteMelhoriaSubitem();
  const [expanded, setExpanded] = useState(true);
  const [newTitle, setNewTitle] = useState('');

  const doneCount = subitems.filter(s => s.status === 'done').length;
  const total = subitems.length;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  const handleAdd = () => {
    if (!newTitle.trim()) return;
    createMut.mutate(
      { melhoria_id: melhoriaId, title: newTitle.trim(), position: total },
      { onSuccess: () => setNewTitle('') },
    );
  };

  const toggleStatus = (si: MelhoriaSubitem) => {
    const next = si.status === 'done' ? 'open' : 'done';
    updateMut.mutate({ id: si.id, melhoria_id: melhoriaId, status: next });
  };

  return (
    <div className="border rounded-md">
      <button
        className="w-full flex items-center gap-2 p-3 hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <span className="text-sm font-medium flex-1 text-left">
          Subelementos
          {total > 0 && (
            <span className="text-muted-foreground font-normal ml-2">
              {doneCount}/{total} ({pct}%)
            </span>
          )}
        </span>
        {total > 0 && (
          <div className="w-24">
            <Progress value={pct} className="h-1.5" />
          </div>
        )}
      </button>

      {expanded && (
        <div className="border-t px-3 pb-3">
          {isLoading && <p className="text-xs text-muted-foreground py-2">Carregando…</p>}

          {subitems.length > 0 && (
            <div className="divide-y">
              {subitems.map((si) => (
                <div key={si.id} className="flex items-center gap-2 py-2 group">
                  {/* Status toggle */}
                  <button onClick={() => toggleStatus(si)} className="shrink-0">
                    {si.status === 'done' ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : si.status === 'in_progress' ? (
                      <Circle className="h-4 w-4 text-blue-500 fill-blue-500/20" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>

                  {/* Title */}
                  <span className={cn(
                    'text-sm flex-1 min-w-0 truncate',
                    si.status === 'done' && 'line-through text-muted-foreground',
                  )}>
                    {si.title}
                  </span>

                  {/* Priority badge */}
                  <Badge variant="outline" className={cn('text-[9px] shrink-0', priorityColors[si.priority])}>
                    {priorityLabels[si.priority]}
                  </Badge>

                  {/* Status select */}
                  <Select
                    value={si.status}
                    onValueChange={(v) => updateMut.mutate({ id: si.id, melhoria_id: melhoriaId, status: v as MelhoriaStatus })}
                  >
                    <SelectTrigger className="h-6 w-[110px] text-[10px] shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(statusLabels) as MelhoriaStatus[]).map(k => (
                        <SelectItem key={k} value={k} className="text-xs">{statusLabels[k]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Assignee */}
                  <Select
                    value={si.assigned_to || '_none'}
                    onValueChange={(v) => updateMut.mutate({ id: si.id, melhoria_id: melhoriaId, assigned_to: v === '_none' ? null : v } as any)}
                  >
                    <SelectTrigger className="h-6 w-[100px] text-[10px] shrink-0">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none" className="text-xs">Ninguém</SelectItem>
                      {orgMembers.map((m) => (
                        <SelectItem key={m.id} value={m.id} className="text-xs">{m.full_name || 'Usuário'}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Delete */}
                  <button
                    onClick={() => deleteMut.mutate({ id: si.id, melhoria_id: melhoriaId })}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity shrink-0"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add new */}
          <div className="flex gap-2 mt-2">
            <Input
              placeholder="Novo subelemento…"
              className="h-7 text-sm"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
            />
            <Button size="sm" className="h-7 px-2" onClick={handleAdd} disabled={!newTitle.trim() || createMut.isPending}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
