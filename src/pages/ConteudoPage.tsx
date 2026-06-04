import { useMemo, useRef, useState } from 'react';
import {
  Plus, Search as SearchIcon, X, Calendar as CalendarIcon, List, Clock, Trash2, Send,
  ChevronDown, ChevronRight, Mail, FileText, CheckCircle2, Paperclip, Image as ImageIcon,
  Video, ExternalLink,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  useConteudoItems, useCreateConteudo, useUpdateConteudo, useDeleteConteudo,
  useConteudoActivity, useConteudoComments, useAddConteudoComment, useConteudoAttachments, useConteudoChecklist,
  useCreateConteudoChecklistItem, useUpdateConteudoChecklistItem, useDeleteConteudoChecklistItem,
  type ConteudoItem, type ConteudoStatus, type ConteudoChannel, type ConteudoType,
  type ConteudoChecklistItem, type ConteudoChecklistStatus,
} from '@/hooks/useConteudo';
import {
  useNewsletters, useCreateNewsletter, useUpdateNewsletter, useDeleteNewsletter,
  type Newsletter, type NewsletterStatus, type NewsletterChannel,
} from '@/hooks/useNewsletters';
import {
  usePautas, usePautaItems, useCreatePauta, useUpdatePauta, useDeletePauta,
  useCreatePautaItem, useUpdatePautaItem, useDeletePautaItem,
  type Pauta, type PautaStatus, type PautaPriority, type PautaItem,
} from '@/hooks/usePautas';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useConfirm } from '@/components/ConfirmDialog';
import { cn } from '@/lib/utils';
import { LinkedItems } from '@/components/LinkedItems';
import { ContentCalendar } from '@/components/conteudo/ContentCalendar';

/* ================================================================ */
/* Labels & Colors                                                   */
/* ================================================================ */

const channelLabels: Record<ConteudoChannel, string> = {
  mooui_kids: 'MOOUI Kids', mooui_home: 'MOOUI Home', amo_mooui: 'Amo MOOUI',
  barcelona: 'Barcelona', outras_redes: 'Outras Redes', pinterest: 'Pinterest',
};
const channelOrder: ConteudoChannel[] = ['mooui_kids', 'mooui_home', 'amo_mooui', 'barcelona', 'outras_redes', 'pinterest'];
const channelColors: Record<ConteudoChannel, string> = {
  mooui_kids: 'bg-pink-500/15 text-pink-700 dark:text-pink-300',
  mooui_home: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  amo_mooui: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  barcelona: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  outras_redes: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
  pinterest: 'bg-red-600/15 text-red-700 dark:text-red-300',
};
const statusLabels: Record<ConteudoStatus, string> = {
  nao_iniciado: 'Não iniciado', em_andamento: 'Em andamento', em_revisao: 'Em revisão',
  aprovado: 'Aprovado', publicado: 'Publicado',
};
const statusColors: Record<ConteudoStatus, string> = {
  nao_iniciado: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
  em_andamento: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  em_revisao: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  aprovado: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  publicado: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
};
const typeLabels: Record<ConteudoType, string> = {
  foto: 'Foto', video: 'Vídeo', carrossel: 'Carrossel', reels: 'Reels', stories: 'Stories',
};
const nlStatusLabels: Record<NewsletterStatus, string> = {
  nao_iniciado: 'Não iniciado', em_andamento: 'Em andamento', enviado: 'Enviado',
};
const nlStatusColors: Record<NewsletterStatus, string> = {
  nao_iniciado: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
  em_andamento: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  enviado: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
};
const nlChannelLabels: Record<NewsletterChannel, string> = { brasil: 'Brasil', barcelona: 'Barcelona' };
const pautaStatusLabels: Record<PautaStatus, string> = {
  pendente: 'Pendente', em_andamento: 'Em andamento', concluida: 'Concluída',
};
const pautaStatusColors: Record<PautaStatus, string> = {
  pendente: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  em_andamento: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  concluida: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
};
const pautaPriorityLabels: Record<PautaPriority, string> = { low: 'Baixa', medium: 'Média', high: 'Alta' };
const pautaPriorityColors: Record<PautaPriority, string> = {
  low: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
  medium: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  high: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
};
const pautaItemStatusLabels: Record<string, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em andamento',
  concluido: 'Concluído',
};
const pautaItemStatusColors: Record<string, string> = {
  pendente: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
  em_andamento: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  concluido: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
};

/* ================================================================ */
/* Main Page                                                         */
/* ================================================================ */

export default function ConteudoPage() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const [mainTab, setMainTab] = useState<'programacao' | 'newsletters' | 'pautas'>('programacao');

  // Org members for assignment
  const { data: orgMembers = [] } = useQuery({
    queryKey: ['org-members-conteudo', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return [];
      const { data } = await supabase.from('organization_members').select('user_id').eq('organization_id', currentOrg.id);
      const ids = (data || []).map((m: any) => m.user_id);
      if (ids.length === 0) return [];
      const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', ids);
      return profs || [];
    },
    enabled: !!currentOrg,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Conteúdo & Redes Sociais</h1>
        <p className="text-sm text-muted-foreground">Programação de posts, newsletters e pautas editoriais.</p>
      </div>

      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as any)}>
        <TabsList>
          <TabsTrigger value="programacao"><CalendarIcon className="h-3.5 w-3.5 mr-1.5" />Programação</TabsTrigger>
          <TabsTrigger value="newsletters"><Mail className="h-3.5 w-3.5 mr-1.5" />Newsletters</TabsTrigger>
          <TabsTrigger value="pautas"><FileText className="h-3.5 w-3.5 mr-1.5" />Pautas</TabsTrigger>
        </TabsList>

        <TabsContent value="programacao" className="mt-4">
          <ProgramacaoTab orgMembers={orgMembers as any} />
        </TabsContent>
        <TabsContent value="newsletters" className="mt-4">
          <NewslettersTab />
        </TabsContent>
        <TabsContent value="pautas" className="mt-4">
          <PautasTab orgMembers={orgMembers as any} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ================================================================ */
/* TAB 1: Programação                                               */
/* ================================================================ */

function ProgramacaoTab({ orgMembers }: { orgMembers: { id: string; full_name: string | null }[] }) {
  const { user } = useAuth();
  const { data: items = [], isLoading } = useConteudoItems();
  const createMut = useCreateConteudo();
  const updateMut = useUpdateConteudo();
  const deleteMut = useDeleteConteudo();
  const confirm = useConfirm();

  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [channelFilter, setChannelFilter] = useState<'all' | ConteudoChannel>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ConteudoStatus>('all');
  const [search, setSearch] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [openItem, setOpenItem] = useState<ConteudoItem | null>(null);

  // New form
  const [nTitle, setNTitle] = useState('');
  const [nChannel, setNChannel] = useState<ConteudoChannel>('mooui_kids');
  const [nType, setNType] = useState<ConteudoType>('foto');
  const [nDate, setNDate] = useState('');
  const [nTimeSlot, setNTimeSlot] = useState('');
  const [nRepost, setNRepost] = useState(false);
  const [nNotes, setNNotes] = useState('');

  // Profiles
  const userIds = useMemo(() => {
    const ids = new Set<string>();
    items.forEach(i => { ids.add(i.created_by); if (i.assigned_to) ids.add(i.assigned_to); });
    return [...ids];
  }, [items]);
  const { data: profiles = [] } = useQuery({
    queryKey: ['conteudo-profiles', userIds.sort().join(',')],
    queryFn: async () => {
      if (userIds.length === 0) return [];
      const { data } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
      return data || [];
    },
    enabled: userIds.length > 0,
  });
  const profileMap = useMemo(() => new Map(profiles.map((p: any) => [p.id, p])), [profiles]);

  const q = search.trim().toLowerCase();
  const filtered = items.filter(i => {
    if (channelFilter !== 'all' && i.channel !== channelFilter) return false;
    if (statusFilter !== 'all' && i.status !== statusFilter) return false;
    if (q && !i.title.toLowerCase().includes(q)) return false;
    return true;
  });
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const channelStats = useMemo(() => {
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    return channelOrder.map(channel => {
      const channelItems = items.filter(i => i.channel === channel);
      const scheduled = channelItems.filter(i => !!i.scheduled_date).length;
      const pending = channelItems.filter(i => i.status !== 'publicado').length;
      const week = channelItems.filter(i => {
        if (!i.scheduled_date) return false;
        const date = new Date(`${i.scheduled_date}T12:00:00`);
        return date >= today && date <= nextWeek;
      }).length;
      return { channel, total: channelItems.length, scheduled, pending, week };
    });
  }, [items, today]);

  const handleCreate = () => {
    if (!nTitle.trim()) return;
    createMut.mutate({
      title: nTitle.trim(), channel: nChannel, content_type: nType,
      scheduled_date: nDate || undefined, time_slot: nTimeSlot || undefined,
      is_repost: nRepost, notes: nNotes || undefined,
    }, {
      onSuccess: () => {
        toast.success('Conteúdo criado!');
        setShowNew(false);
        setNTitle(''); setNChannel('mooui_kids'); setNType('foto'); setNDate(''); setNTimeSlot(''); setNRepost(false); setNNotes('');
      },
      onError: (e: any) => toast.error(e?.message || 'Erro'),
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant={view === 'list' ? 'default' : 'outline'} size="sm" onClick={() => setView('list')}>
            <List className="h-3.5 w-3.5 mr-1" />Lista
          </Button>
          <Button variant={view === 'calendar' ? 'default' : 'outline'} size="sm" onClick={() => setView('calendar')}>
            <CalendarIcon className="h-3.5 w-3.5 mr-1" />Calendário
          </Button>
        </div>
        <Button onClick={() => setShowNew(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" />Novo conteúdo
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
        {channelStats.map(stat => {
          const active = channelFilter === stat.channel;
          return (
            <button
              key={stat.channel}
              type="button"
              onClick={() => setChannelFilter(active ? 'all' : stat.channel)}
              className={cn(
                'rounded-md border bg-card p-3 text-left transition-colors hover:border-primary/50 hover:bg-muted/40',
                active && 'border-primary ring-1 ring-primary/30'
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium truncate">{channelLabels[stat.channel]}</span>
                <Badge variant="outline" className={cn('text-[10px] shrink-0', channelColors[stat.channel])}>
                  {stat.pending}
                </Badge>
              </div>
              <div className="mt-2 text-2xl font-semibold leading-none">{stat.total}</div>
              <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <span>{stat.week} na semana</span>
                <span>{stat.scheduled} datados</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <SearchIcon className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar…" className="pl-8 h-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={channelFilter} onValueChange={(v) => setChannelFilter(v as any)}>
          <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os canais</SelectItem>
            {channelOrder.map(k => (
              <SelectItem key={k} value={k}>{channelLabels[k]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {(Object.keys(statusLabels) as ConteudoStatus[]).map(k => (
              <SelectItem key={k} value={k}>{statusLabels[k]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* View */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : view === 'calendar' ? (
        <ContentCalendar items={filtered} onClickItem={setOpenItem} />
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">Nenhum conteúdo encontrado.</Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(item => {
            const author = profileMap.get(item.created_by) as any;
            return (
              <Card key={item.id} onClick={() => setOpenItem(item)} className="p-3 cursor-pointer hover:border-primary/40 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 flex-wrap">
                      {item.code && <span className="text-[10px] font-mono font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{item.code}</span>}
                      <h3 className="font-medium truncate flex-1 min-w-0">{item.title}</h3>
                      <Badge className={cn('text-[10px]', channelColors[item.channel])} variant="outline">{channelLabels[item.channel]}</Badge>
                      <Badge className={cn('text-[10px]', statusColors[item.status])} variant="outline">{statusLabels[item.status]}</Badge>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap mt-1">
                      <Badge variant="outline" className="text-[10px]">{typeLabels[item.content_type]}</Badge>
                      {item.is_repost && <Badge variant="outline" className="text-[10px] bg-muted">Repost</Badge>}
                      {item.scheduled_date && (
                        <span className="text-[10px] text-muted-foreground">
                          {format(new Date(item.scheduled_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                          {item.time_slot && ` ${item.time_slot}`}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                      <span>{author?.full_name || 'Usuário'}</span>
                      <span>·</span>
                      <span>{formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: ptBR })}</span>
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
          <DialogHeader><DialogTitle>Novo conteúdo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Título</Label>
              <Input autoFocus value={nTitle} onChange={(e) => setNTitle(e.target.value)} placeholder="Título do post" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Canal</Label>
                <Select value={nChannel} onValueChange={(v) => setNChannel(v as ConteudoChannel)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {channelOrder.map(k => (
                      <SelectItem key={k} value={k}>{channelLabels[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={nType} onValueChange={(v) => setNType(v as ConteudoType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(typeLabels) as ConteudoType[]).map(k => (
                      <SelectItem key={k} value={k}>{typeLabels[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Data agendada</Label>
                <Input type="date" value={nDate} onChange={(e) => setNDate(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Horário</Label>
                <Input value={nTimeSlot} onChange={(e) => setNTimeSlot(e.target.value)} placeholder="Ex: 10h, 14h" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="repost" checked={nRepost} onChange={(e) => setNRepost(e.target.checked)} className="rounded" />
              <Label htmlFor="repost" className="text-xs cursor-pointer">É repost</Label>
            </div>
            <div>
              <Label className="text-xs">Observações</Label>
              <Textarea value={nNotes} onChange={(e) => setNNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!nTitle.trim() || createMut.isPending}>Criar conteúdo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      {openItem && (
        <ConteudoElementDetail
          item={openItem}
          onClose={() => setOpenItem(null)}
          onUpdate={(patch) => updateMut.mutate({ id: openItem.id, ...patch }, {
            onSuccess: () => { setOpenItem(cur => cur ? { ...cur, ...patch } as ConteudoItem : cur); toast.success('Atualizado'); },
          })}
          onDelete={async () => {
            const ok = await confirm({ title: 'Excluir este conteúdo?', destructive: true, confirmText: 'Excluir' });
            if (!ok) return;
            deleteMut.mutate(openItem.id, { onSuccess: () => { toast.success('Conteúdo excluído'); setOpenItem(null); } });
          }}
          isOwner={openItem.created_by === user?.id}
          orgMembers={orgMembers}
          profileMap={profileMap as any}
        />
      )}
    </div>
  );
}

/* ================================================================ */
/* Conteudo Detail                                                   */
/* ================================================================ */

function ConteudoDetail({
  item, onClose, onUpdate, onDelete, isOwner, orgMembers, profileMap,
}: {
  item: ConteudoItem;
  onClose: () => void;
  onUpdate: (patch: Partial<ConteudoItem>) => void;
  onDelete: () => void;
  isOwner: boolean;
  orgMembers: { id: string; full_name: string | null }[];
  profileMap: Map<string, { id: string; full_name: string | null }>;
}) {
  const { data: activity = [] } = useConteudoActivity(item.id);
  const [tab, setTab] = useState<'details' | 'activity'>('details');

  const actUserIds = [...new Set(activity.filter(a => a.user_id).map(a => a.user_id!))];
  const { data: aProfiles = [] } = useQuery({
    queryKey: ['conteudo-aprofiles', actUserIds.sort().join(',')],
    queryFn: async () => {
      if (actUserIds.length === 0) return [];
      const { data } = await supabase.from('profiles').select('id, full_name').in('id', actUserIds);
      return data || [];
    },
    enabled: actUserIds.length > 0,
  });
  const aMap = new Map((aProfiles as any[]).map(p => [p.id, p]));
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
          <div className="flex flex-wrap gap-2 items-center">
            <Badge variant="outline" className={cn('text-[10px]', statusColors[item.status])}>{statusLabels[item.status]}</Badge>
            <Badge variant="outline" className={cn('text-[10px]', channelColors[item.channel])}>{channelLabels[item.channel]}</Badge>
            <Badge variant="outline" className="text-[10px]">{typeLabels[item.content_type]}</Badge>
            {item.is_repost && <Badge variant="outline" className="text-[10px] bg-muted">Repost</Badge>}
          </div>

          {/* Editable fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={item.status} onValueChange={(v) => onUpdate({ status: v as ConteudoStatus })}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(statusLabels) as ConteudoStatus[]).map(k => (
                    <SelectItem key={k} value={k}>{statusLabels[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Canal</Label>
              <Select value={item.channel} onValueChange={(v) => onUpdate({ channel: v as ConteudoChannel })}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(channelLabels) as ConteudoChannel[]).map(k => (
                    <SelectItem key={k} value={k}>{channelLabels[k]}</SelectItem>
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
            <div>
              <Label className="text-xs">Data agendada</Label>
              <Input type="date" className="h-8" value={item.scheduled_date || ''} onChange={(e) => onUpdate({ scheduled_date: e.target.value || null } as any)} />
            </div>
          </div>

          {item.notes && <p className="text-sm whitespace-pre-wrap text-muted-foreground">{item.notes}</p>}

          <div className="text-xs text-muted-foreground">
            <p>Criado por {(author as any)?.full_name || 'Usuário'} em {format(new Date(item.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
          </div>

          <LinkedItems sourceType="conteudo" sourceId={item.id} />

          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList>
              <TabsTrigger value="details">Detalhes</TabsTrigger>
              <TabsTrigger value="activity">Atividade ({activity.length})</TabsTrigger>
            </TabsList>
          </Tabs>

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
                      {a.action === 'created' && <span> criou o conteúdo</span>}
                      {a.action === 'status' && <span> alterou status: {a.from_value} → {a.to_value}</span>}
                      {a.action === 'channel' && <span> alterou canal: {a.from_value} → {a.to_value}</span>}
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

          {isOwner && (
            <div className="pt-2 border-t">
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={onDelete}>
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />Excluir conteúdo
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ConteudoElementDetail({
  item, onClose, onUpdate, onDelete, isOwner, orgMembers, profileMap,
}: {
  item: ConteudoItem;
  onClose: () => void;
  onUpdate: (patch: Partial<ConteudoItem>) => void;
  onDelete: () => void;
  isOwner: boolean;
  orgMembers: { id: string; full_name: string | null }[];
  profileMap: Map<string, { id: string; full_name: string | null }>;
}) {
  const { user } = useAuth();
  const { data: activity = [] } = useConteudoActivity(item.id);
  const { data: comments = [] } = useConteudoComments(item.id);
  const addComment = useAddConteudoComment();
  const [tab, setTab] = useState<'details' | 'comments' | 'project' | 'files' | 'activity'>('details');
  const [commentText, setCommentText] = useState('');
  const author = profileMap.get(item.created_by);

  // Comment profiles
  const commentUserIds = [...new Set(comments.map(c => c.user_id))];
  const { data: cProfiles = [] } = useQuery({
    queryKey: ['conteudo-cprofiles', commentUserIds.sort().join(',')],
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
    queryKey: ['conteudo-aprofiles-element', actUserIds.sort().join(',')],
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
    addComment.mutate({ conteudoItemId: item.id, content: commentText.trim() }, {
      onSuccess: () => setCommentText(''),
      onError: () => toast.error('Erro ao enviar'),
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex-1 text-left flex items-baseline gap-2 flex-wrap pr-8">
            {item.code && <span className="text-xs font-mono font-semibold text-muted-foreground">{item.code}</span>}
            <span>{item.title}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <Badge variant="outline" className={cn('text-[10px]', statusColors[item.status])}>{statusLabels[item.status]}</Badge>
            <Badge variant="outline" className={cn('text-[10px]', channelColors[item.channel])}>{channelLabels[item.channel]}</Badge>
            <Badge variant="outline" className="text-[10px]">{typeLabels[item.content_type]}</Badge>
            {item.content_category && <Badge variant="outline" className="text-[10px]">{item.content_category}</Badge>}
            {item.is_repost && <Badge variant="outline" className="text-[10px] bg-muted">Repost</Badge>}
          </div>

          <div className="text-xs text-muted-foreground">
            <p>Criado por {(author as any)?.full_name || 'Usuario'} em {format(new Date(item.created_at), "dd/MM/yyyy 'as' HH:mm", { locale: ptBR })}</p>
          </div>

          <LinkedItems sourceType="conteudo" sourceId={item.id} />

          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList className="flex flex-wrap h-auto">
              <TabsTrigger value="details">Detalhes</TabsTrigger>
              <TabsTrigger value="comments">Comentarios ({comments.length})</TabsTrigger>
              <TabsTrigger value="project">Projeto</TabsTrigger>
              <TabsTrigger value="files">Arquivos</TabsTrigger>
              <TabsTrigger value="activity">Atividade ({activity.length})</TabsTrigger>
            </TabsList>
          </Tabs>

          {tab === 'details' && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Titulo</Label>
                <Input className="h-8" value={item.title} onChange={(e) => onUpdate({ title: e.target.value })} />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Status</Label>
                  <Select value={item.status} onValueChange={(v) => onUpdate({ status: v as ConteudoStatus })}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(statusLabels) as ConteudoStatus[]).map(k => (
                        <SelectItem key={k} value={k}>{statusLabels[k]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Responsavel</Label>
                  <Select value={item.assigned_to || '_none'} onValueChange={(v) => onUpdate({ assigned_to: v === '_none' ? null : v } as any)}>
                    <SelectTrigger className="h-8"><SelectValue placeholder="Ninguem" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Ninguem</SelectItem>
                      {orgMembers.map((m: any) => (
                        <SelectItem key={m.id} value={m.id}>{m.full_name || 'Usuario'}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Canal</Label>
                  <Select value={item.channel} onValueChange={(v) => onUpdate({ channel: v as ConteudoChannel })}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {channelOrder.map(k => (
                        <SelectItem key={k} value={k}>{channelLabels[k]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Tipo de conteudo</Label>
                  <Select value={item.content_type} onValueChange={(v) => onUpdate({ content_type: v as ConteudoType })}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(typeLabels) as ConteudoType[]).map(k => (
                        <SelectItem key={k} value={k}>{typeLabels[k]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Data agendada</Label>
                  <Input type="date" className="h-8" value={item.scheduled_date || ''} onChange={(e) => onUpdate({ scheduled_date: e.target.value || null } as any)} />
                </div>
                <div>
                  <Label className="text-xs">Horario</Label>
                  <Input className="h-8" value={item.time_slot || ''} onChange={(e) => onUpdate({ time_slot: e.target.value || null } as any)} placeholder="Ex: Manha, Tarde, 10h" />
                </div>
                <div>
                  <Label className="text-xs">Categoria / tipo do Excel</Label>
                  <Input className="h-8" value={item.content_category || ''} onChange={(e) => onUpdate({ content_category: e.target.value || null } as any)} />
                </div>
                <div>
                  <Label className="text-xs">Foto principal do Excel</Label>
                  <Input className="h-8" value={item.photo_url || ''} onChange={(e) => onUpdate({ photo_url: e.target.value || null } as any)} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={item.is_repost} onChange={(e) => onUpdate({ is_repost: e.target.checked })} />
                <span>Repost</span>
              </label>
              {item.photo_url && (
                <a href={item.photo_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
                  <ExternalLink className="h-3.5 w-3.5" />Abrir foto principal
                </a>
              )}
              <div>
                <Label className="text-xs">Observacoes</Label>
                <Textarea rows={4} value={item.notes || ''} onChange={(e) => onUpdate({ notes: e.target.value || null } as any)} />
              </div>
            </div>
          )}

          {tab === 'comments' && (
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

          {tab === 'project' && <ConteudoProjectPanel conteudoItemId={item.id} orgMembers={orgMembers} />}
          {tab === 'files' && <ConteudoFilesPanel conteudoItemId={item.id} />}

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
                      {a.action === 'created' && <span> criou o conteudo</span>}
                      {a.action === 'status' && <span> alterou status: {a.from_value} → {a.to_value}</span>}
                      {a.action === 'channel' && <span> alterou canal: {a.from_value} → {a.to_value}</span>}
                      {a.action === 'assigned' && <span> alterou responsavel</span>}
                      <span className="text-muted-foreground ml-2">
                        {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: ptBR })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {isOwner && (
            <div className="pt-2 border-t">
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={onDelete}>
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />Excluir conteudo
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ConteudoProjectPanel({
  conteudoItemId,
  orgMembers,
}: {
  conteudoItemId: string;
  orgMembers: { id: string; full_name: string | null }[];
}) {
  const { data: items = [] } = useConteudoChecklist(conteudoItemId);
  const createItem = useCreateConteudoChecklistItem();
  const updateItem = useUpdateConteudoChecklistItem();
  const deleteItem = useDeleteConteudoChecklistItem();
  const [newTitle, setNewTitle] = useState('');

  const done = items.filter((item) => item.status === 'concluido').length;
  const progress = items.length ? Math.round((done / items.length) * 100) : 0;

  const addItem = () => {
    if (!newTitle.trim()) return;
    createItem.mutate({
      conteudo_item_id: conteudoItemId,
      title: newTitle.trim(),
      position: items.length,
    }, {
      onSuccess: () => setNewTitle(''),
      onError: (e: any) => toast.error(e?.message || 'Erro ao criar item'),
    });
  };

  return (
    <div className="space-y-3">
      <Card className="p-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Checklist do elemento</span>
          <span className="text-muted-foreground">{done}/{items.length}</span>
        </div>
        <div className="h-2 rounded-full bg-muted mt-2 overflow-hidden">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
      </Card>

      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum item de projeto cadastrado.</p>
        ) : items.map((item) => (
          <ConteudoChecklistRow
            key={item.id}
            item={item}
            orgMembers={orgMembers}
            onUpdate={(patch) => updateItem.mutate({ id: item.id, conteudo_item_id: conteudoItemId, ...patch })}
            onDelete={() => deleteItem.mutate({ id: item.id, conteudo_item_id: conteudoItemId })}
          />
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }}
          placeholder="Adicionar etapa, entrega ou pendencia..."
          className="h-8"
        />
        <Button size="sm" className="h-8" onClick={addItem} disabled={!newTitle.trim() || createItem.isPending}>
          <Plus className="h-3.5 w-3.5 mr-1" />Item
        </Button>
      </div>
    </div>
  );
}

function ConteudoChecklistRow({
  item,
  orgMembers,
  onUpdate,
  onDelete,
}: {
  item: ConteudoChecklistItem;
  orgMembers: { id: string; full_name: string | null }[];
  onUpdate: (patch: Partial<ConteudoChecklistItem>) => void;
  onDelete: () => void;
}) {
  const isDone = item.status === 'concluido';
  return (
    <div className="grid gap-2 rounded-md border bg-card p-2 sm:grid-cols-[auto_1fr_120px_120px_140px_130px_auto] sm:items-center">
      <button
        className={cn('h-5 w-5 rounded border flex items-center justify-center', isDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-muted-foreground/40')}
        onClick={() => onUpdate({ status: isDone ? 'pendente' : 'concluido' })}
      >
        {isDone && <CheckCircle2 className="h-3.5 w-3.5" />}
      </button>
      <Input className="h-8" value={item.title} onChange={(e) => onUpdate({ title: e.target.value })} />
      <Select value={item.status} onValueChange={(value) => onUpdate({ status: value as ConteudoChecklistStatus })}>
        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          {Object.keys(pautaItemStatusLabels).map((key) => (
            <SelectItem key={key} value={key}>{pautaItemStatusLabels[key]}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={(item as any).priority || 'medium'} onValueChange={(value) => onUpdate({ priority: value } as any)}>
        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="low">Baixa</SelectItem>
          <SelectItem value="medium">Média</SelectItem>
          <SelectItem value="high">Alta</SelectItem>
          <SelectItem value="critical">Crítica</SelectItem>
        </SelectContent>
      </Select>
      <Select value={item.assigned_to || '_none'} onValueChange={(value) => onUpdate({ assigned_to: value === '_none' ? null : value } as any)}>
        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="_none">Ninguém</SelectItem>
          {orgMembers.map((member) => (
            <SelectItem key={member.id} value={member.id}>{member.full_name || 'Usuário'}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input type="date" className="h-8" value={item.due_date || ''} onChange={(e) => onUpdate({ due_date: e.target.value || null } as any)} />
      <button className="text-muted-foreground hover:text-destructive justify-self-start sm:justify-self-end" onClick={onDelete}>
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function ConteudoFilesPanel({ conteudoItemId }: { conteudoItemId: string }) {
  const { user } = useAuth();
  const { attachments, isLoading, uploadFile, deleteAttachment } = useConteudoAttachments(conteudoItemId);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      uploadFile.mutate({ conteudoItemId, file }, {
        onSuccess: () => toast.success(`${file.name} enviado`),
        onError: (e: any) => toast.error(e?.message || `Erro ao enviar ${file.name}`),
      });
    });
  };

  return (
    <div className="space-y-3">
      <input
        ref={fileRef}
        type="file"
        multiple
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="w-full rounded-md border-2 border-dashed p-4 text-sm text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors flex items-center justify-center gap-2"
      >
        <Paperclip className="h-4 w-4" />Anexar fotos ou videos
      </button>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Carregando arquivos...</p>
      ) : attachments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum arquivo anexado.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-2">
          {attachments.map((attachment) => {
            const isVideo = attachment.file_type?.startsWith('video/');
            const isImage = attachment.file_type?.startsWith('image/');
            return (
              <Card key={attachment.id} className="p-2">
                <div className="flex items-start gap-2">
                  <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                    {isVideo ? <Video className="h-4 w-4 text-muted-foreground" /> : <ImageIcon className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    {attachment.signed_url ? (
                      <a href={attachment.signed_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary hover:underline truncate block">
                        {attachment.file_name}
                      </a>
                    ) : (
                      <p className="text-sm font-medium truncate">{attachment.file_name}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground">
                      {attachment.file_size ? `${(attachment.file_size / 1024 / 1024).toFixed(2)} MB` : 'Arquivo'}
                      {attachment.profile?.full_name ? ` - ${attachment.profile.full_name}` : ''}
                    </p>
                  </div>
                  {attachment.user_id === user?.id && (
                    <button className="text-muted-foreground hover:text-destructive" onClick={() => deleteAttachment.mutate(attachment.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {isImage && attachment.signed_url && (
                  <img src={attachment.signed_url} alt={attachment.file_name} className="mt-2 h-28 w-full rounded object-cover" />
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ================================================================ */
/* TAB 2: Newsletters                                               */
/* ================================================================ */

function NewslettersTab() {
  const { user } = useAuth();
  const { data: newsletters = [], isLoading } = useNewsletters();
  const createMut = useCreateNewsletter();
  const updateMut = useUpdateNewsletter();
  const deleteMut = useDeleteNewsletter();
  const confirm = useConfirm();

  const [showNew, setShowNew] = useState(false);
  const [openItem, setOpenItem] = useState<Newsletter | null>(null);
  const [channelFilter, setChannelFilter] = useState<'all' | NewsletterChannel>('all');

  // New form
  const [nTitle, setNTitle] = useState('');
  const [nDate, setNDate] = useState('');
  const [nTema, setNTema] = useState('');
  const [nChannel, setNChannel] = useState<NewsletterChannel>('brasil');

  const filtered = newsletters.filter(n => channelFilter === 'all' || n.channel === channelFilter);

  const handleCreate = () => {
    if (!nTitle.trim()) return;
    createMut.mutate({
      title: nTitle.trim(), scheduled_date: nDate || undefined,
      tema: nTema || undefined, channel: nChannel,
    }, {
      onSuccess: () => {
        toast.success('Newsletter criada!');
        setShowNew(false);
        setNTitle(''); setNDate(''); setNTema(''); setNChannel('brasil');
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Select value={channelFilter} onValueChange={(v) => setChannelFilter(v as any)}>
          <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os canais</SelectItem>
            {(Object.keys(nlChannelLabels) as NewsletterChannel[]).map(k => (
              <SelectItem key={k} value={k}>{nlChannelLabels[k]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => setShowNew(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" />Nova newsletter
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">Nenhuma newsletter encontrada.</Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(nl => (
            <Card key={nl.id} onClick={() => setOpenItem(nl)} className="p-3 cursor-pointer hover:border-primary/40 transition-colors">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 flex-wrap">
                    <h3 className="font-medium truncate flex-1 min-w-0">{nl.title}</h3>
                    <Badge variant="outline" className="text-[10px]">{nlChannelLabels[nl.channel]}</Badge>
                    <Badge variant="outline" className={cn('text-[10px]', nlStatusColors[nl.status])}>{nlStatusLabels[nl.status]}</Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                    {nl.scheduled_date && <span>{format(new Date(nl.scheduled_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}</span>}
                    {nl.tema && <><span>·</span><span>Tema: {nl.tema}</span></>}
                    {nl.open_rate != null && <><span>·</span><span>Open: {nl.open_rate}%</span></>}
                    {nl.click_rate != null && <><span>·</span><span>Click: {nl.click_rate}%</span></>}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* New dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova newsletter</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Título</Label><Input autoFocus value={nTitle} onChange={(e) => setNTitle(e.target.value)} placeholder="Título da newsletter" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Canal</Label>
                <Select value={nChannel} onValueChange={(v) => setNChannel(v as NewsletterChannel)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(nlChannelLabels) as NewsletterChannel[]).map(k => (<SelectItem key={k} value={k}>{nlChannelLabels[k]}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Data</Label><Input type="date" value={nDate} onChange={(e) => setNDate(e.target.value)} /></div>
            </div>
            <div><Label className="text-xs">Tema</Label><Input value={nTema} onChange={(e) => setNTema(e.target.value)} placeholder="Tema da newsletter" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!nTitle.trim() || createMut.isPending}>Criar newsletter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      {openItem && (
        <NewsletterDetail
          item={openItem}
          onClose={() => setOpenItem(null)}
          onUpdate={(patch) => updateMut.mutate({ id: openItem.id, ...patch }, {
            onSuccess: () => { setOpenItem(cur => cur ? { ...cur, ...patch } as Newsletter : cur); toast.success('Atualizado'); },
          })}
          onDelete={async () => {
            const ok = await confirm({ title: 'Excluir newsletter?', destructive: true, confirmText: 'Excluir' });
            if (!ok) return;
            deleteMut.mutate(openItem.id, { onSuccess: () => { toast.success('Newsletter excluída'); setOpenItem(null); } });
          }}
          isOwner={openItem.created_by === user?.id}
        />
      )}
    </div>
  );
}

function NewsletterDetail({
  item, onClose, onUpdate, onDelete, isOwner,
}: {
  item: Newsletter; onClose: () => void; onUpdate: (patch: Partial<Newsletter>) => void; onDelete: () => void; isOwner: boolean;
}) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{item.title}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className={cn('text-[10px]', nlStatusColors[item.status])}>{nlStatusLabels[item.status]}</Badge>
            <Badge variant="outline" className="text-[10px]">{nlChannelLabels[item.channel]}</Badge>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={item.status} onValueChange={(v) => onUpdate({ status: v as NewsletterStatus })}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(nlStatusLabels) as NewsletterStatus[]).map(k => (<SelectItem key={k} value={k}>{nlStatusLabels[k]}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Data</Label>
              <Input type="date" className="h-8" value={item.scheduled_date || ''} onChange={(e) => onUpdate({ scheduled_date: e.target.value || null } as any)} />
            </div>
            <div>
              <Label className="text-xs">Tema</Label>
              <Input className="h-8" value={item.tema || ''} onChange={(e) => onUpdate({ tema: e.target.value || null } as any)} />
            </div>
            <div>
              <Label className="text-xs">Base</Label>
              <Input className="h-8" value={item.base || ''} onChange={(e) => onUpdate({ base: e.target.value || null } as any)} />
            </div>
            <div>
              <Label className="text-xs">Hora envio</Label>
              <Input className="h-8" value={item.hora || ''} onChange={(e) => onUpdate({ hora: e.target.value || null } as any)} />
            </div>
            <div>
              <Label className="text-xs">Título do e-mail</Label>
              <Input className="h-8" value={item.titulo_email || ''} onChange={(e) => onUpdate({ titulo_email: e.target.value || null } as any)} />
            </div>
            <div>
              <Label className="text-xs">Open Rate (%)</Label>
              <Input type="number" step="0.01" className="h-8" value={item.open_rate ?? ''} onChange={(e) => onUpdate({ open_rate: e.target.value ? parseFloat(e.target.value) : null } as any)} />
            </div>
            <div>
              <Label className="text-xs">Click Rate (%)</Label>
              <Input type="number" step="0.01" className="h-8" value={item.click_rate ?? ''} onChange={(e) => onUpdate({ click_rate: e.target.value ? parseFloat(e.target.value) : null } as any)} />
            </div>
          </div>

          {item.notes && <p className="text-sm whitespace-pre-wrap text-muted-foreground">{item.notes}</p>}

          {isOwner && (
            <div className="pt-2 border-t">
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={onDelete}>
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />Excluir newsletter
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ================================================================ */
/* TAB 3: Pautas                                                    */
/* ================================================================ */

function PautasTab({ orgMembers }: { orgMembers: { id: string; full_name: string | null }[] }) {
  const { user } = useAuth();
  const { data: pautas = [], isLoading } = usePautas();
  const createMut = useCreatePauta();
  const updateMut = useUpdatePauta();
  const deleteMut = useDeletePauta();
  const confirm = useConfirm();

  const [showNew, setShowNew] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // New form
  const [nTitle, setNTitle] = useState('');
  const [nPriority, setNPriority] = useState<PautaPriority>('medium');
  const [nAssigned, setNAssigned] = useState('');

  // Profiles
  const userIds = useMemo(() => {
    const ids = new Set<string>();
    pautas.forEach(p => { ids.add(p.created_by); if (p.assigned_to) ids.add(p.assigned_to); });
    return [...ids];
  }, [pautas]);
  const { data: profiles = [] } = useQuery({
    queryKey: ['pauta-profiles', userIds.sort().join(',')],
    queryFn: async () => {
      if (userIds.length === 0) return [];
      const { data } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
      return data || [];
    },
    enabled: userIds.length > 0,
  });
  const profileMap = useMemo(() => new Map(profiles.map((p: any) => [p.id, p])), [profiles]);

  const handleCreate = () => {
    if (!nTitle.trim()) return;
    createMut.mutate({
      title: nTitle.trim(), priority: nPriority,
      assigned_to: nAssigned || undefined,
    }, {
      onSuccess: () => {
        toast.success('Pauta criada!');
        setShowNew(false);
        setNTitle(''); setNPriority('medium'); setNAssigned('');
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button onClick={() => setShowNew(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" />Nova pauta
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : pautas.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">Nenhuma pauta cadastrada.</Card>
      ) : (
        <div className="space-y-2">
          {pautas.map(pauta => {
            const isExpanded = expandedId === pauta.id;
            const author = profileMap.get(pauta.created_by) as any;
            const assignee = pauta.assigned_to ? (profileMap.get(pauta.assigned_to) as any) : null;
            return (
              <Card key={pauta.id} className="overflow-hidden">
                <div
                  className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : pauta.id)}
                >
                  <div className="flex items-start gap-2">
                    {isExpanded ? <ChevronDown className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 flex-wrap">
                        <h3 className="font-medium truncate flex-1 min-w-0">{pauta.title}</h3>
                        <Badge variant="outline" className={cn('text-[10px]', pautaPriorityColors[pauta.priority])}>{pautaPriorityLabels[pauta.priority]}</Badge>
                        <Badge variant="outline" className={cn('text-[10px]', pautaStatusColors[pauta.status])}>{pautaStatusLabels[pauta.status]}</Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                        <span>{author?.full_name || 'Usuário'}</span>
                        {assignee && <><span>·</span><span>Atribuído: {assignee.full_name}</span></>}
                        {pauta.scheduled_date && <><span>·</span><span>{format(new Date(pauta.scheduled_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}</span></>}
                      </div>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <PautaExpanded
                    pauta={pauta}
                    orgMembers={orgMembers}
                    onUpdate={(patch) => updateMut.mutate({ id: pauta.id, ...patch })}
                    onDelete={async () => {
                      const ok = await confirm({ title: 'Excluir esta pauta?', destructive: true, confirmText: 'Excluir' });
                      if (!ok) return;
                      deleteMut.mutate(pauta.id, { onSuccess: () => { toast.success('Pauta excluída'); setExpandedId(null); } });
                    }}
                    isOwner={pauta.created_by === user?.id}
                  />
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* New dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova pauta</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Título</Label><Input autoFocus value={nTitle} onChange={(e) => setNTitle(e.target.value)} placeholder="Título da pauta" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Prioridade</Label>
                <Select value={nPriority} onValueChange={(v) => setNPriority(v as PautaPriority)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(pautaPriorityLabels) as PautaPriority[]).map(k => (<SelectItem key={k} value={k}>{pautaPriorityLabels[k]}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Responsável</Label>
                <Select value={nAssigned || '_none'} onValueChange={(v) => setNAssigned(v === '_none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Ninguém" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Ninguém</SelectItem>
                    {orgMembers.map((m: any) => (<SelectItem key={m.id} value={m.id}>{m.full_name || 'Usuário'}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!nTitle.trim() || createMut.isPending}>Criar pauta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PautaExpanded({
  pauta, orgMembers, onUpdate, onDelete, isOwner,
}: {
  pauta: Pauta;
  orgMembers: { id: string; full_name: string | null }[];
  onUpdate: (patch: Partial<Pauta>) => void;
  onDelete: () => void;
  isOwner: boolean;
}) {
  const { data: items = [] } = usePautaItems(pauta.id);
  const createItem = useCreatePautaItem();
  const updateItem = useUpdatePautaItem();
  const deleteItem = useDeletePautaItem();
  const [newItemTitle, setNewItemTitle] = useState('');

  const addItem = () => {
    if (!newItemTitle.trim()) return;
    createItem.mutate({ pauta_id: pauta.id, title: newItemTitle.trim(), position: items.length }, {
      onSuccess: () => setNewItemTitle(''),
    });
  };

  return (
    <div className="px-3 pb-3 border-t space-y-3 pt-3">
      {/* Editable fields */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Status</Label>
          <Select value={pauta.status} onValueChange={(v) => onUpdate({ status: v as PautaStatus })}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(pautaStatusLabels) as PautaStatus[]).map(k => (<SelectItem key={k} value={k}>{pautaStatusLabels[k]}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Prioridade</Label>
          <Select value={pauta.priority} onValueChange={(v) => onUpdate({ priority: v as PautaPriority })}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(pautaPriorityLabels) as PautaPriority[]).map(k => (<SelectItem key={k} value={k}>{pautaPriorityLabels[k]}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Responsável</Label>
          <Select value={pauta.assigned_to || '_none'} onValueChange={(v) => onUpdate({ assigned_to: v === '_none' ? null : v } as any)}>
            <SelectTrigger className="h-8"><SelectValue placeholder="Ninguém" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">Ninguém</SelectItem>
              {orgMembers.map((m: any) => (<SelectItem key={m.id} value={m.id}>{m.full_name || 'Usuário'}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Sub-items */}
      <div>
        <Label className="text-xs mb-1 block">Itens da pauta</Label>
        <div className="space-y-1">
          {items.map(it => {
            const assignee = it.assigned_to ? orgMembers.find(m => m.id === it.assigned_to) : null;
            return (
            <div key={it.id} className="grid grid-cols-[auto_1fr_132px_150px_auto] items-center gap-2 rounded-md border bg-card px-2 py-1.5 group">
              <button
                className={cn('h-4 w-4 rounded border shrink-0 flex items-center justify-center', it.status === 'concluido' ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-muted-foreground/40')}
                onClick={() => updateItem.mutate({ id: it.id, pauta_id: pauta.id, status: it.status === 'concluido' ? 'pendente' : 'concluido' })}
              >
                {it.status === 'concluido' && <CheckCircle2 className="h-3 w-3" />}
              </button>
              <span className={cn('text-sm flex-1', it.status === 'concluido' && 'line-through text-muted-foreground')}>{it.title}</span>
              <Select
                value={it.status || 'pendente'}
                onValueChange={(status) => updateItem.mutate({ id: it.id, pauta_id: pauta.id, status })}
              >
                <SelectTrigger className={cn('h-7 text-[11px]', pautaItemStatusColors[it.status] || pautaItemStatusColors.pendente)}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(pautaItemStatusLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={it.assigned_to || '_none'}
                onValueChange={(assigned_to) => updateItem.mutate({ id: it.id, pauta_id: pauta.id, assigned_to: assigned_to === '_none' ? null : assigned_to } as any)}
              >
                <SelectTrigger className="h-7 text-[11px]">
                  <SelectValue placeholder="Responsável">
                    {assignee?.full_name || 'Ninguém'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Ninguém</SelectItem>
                  {orgMembers.map((m: any) => (<SelectItem key={m.id} value={m.id}>{m.full_name || 'Usuário'}</SelectItem>))}
                </SelectContent>
              </Select>
              <button onClick={() => deleteItem.mutate({ id: it.id, pauta_id: pauta.id })} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </div>
          )})}
        </div>
        <div className="flex gap-2 mt-2">
          <Input
            value={newItemTitle}
            onChange={(e) => setNewItemTitle(e.target.value)}
            placeholder="Adicionar item…"
            className="h-7 text-sm"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }}
          />
          <Button size="sm" className="h-7 px-2" onClick={addItem} disabled={!newItemTitle.trim()}>
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {isOwner && (
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5 mr-1.5" />Excluir pauta
        </Button>
      )}
    </div>
  );
}
