import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Bug, HelpCircle, Wrench, MoreHorizontal, Trash2, Send, Search, X, Inbox, Headset, UserCheck, Clock, CheckCircle2, AlertCircle, Paperclip, BarChart3 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  useTickets, useCreateTicket, useUpdateTicket, useDeleteTicket,
  useTicketComments, useAddTicketComment, useIsITSupport, useTicketActivity,
  type Ticket, type TicketStatus, type TicketPriority, type TicketCategory, type TicketActivity,
} from '@/hooks/useTickets';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useConfirm } from '@/components/ConfirmDialog';
import { cn } from '@/lib/utils';
import { TicketFilesTab } from '@/components/tickets/TicketFilesTab';
import { SlaBadge, useSlaBreached } from '@/components/tickets/SlaBadge';
import { TicketLabelChips, TicketLabelPicker } from '@/components/tickets/TicketLabelPicker';
import { useTicketLabelAssignments, useTicketLabels } from '@/hooks/useTicketLabels';
import { TicketsReport } from '@/components/tickets/TicketsReport';
import { usePermissions } from '@/hooks/usePermissions';

const priorityColors: Record<TicketPriority, string> = {
  low: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
  medium: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  high: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
  urgent: 'bg-destructive/15 text-destructive',
};
const priorityLabels: Record<TicketPriority, string> = {
  low: 'Baixa', medium: 'Média', high: 'Alta', urgent: 'Urgente',
};
const statusLabels: Record<TicketStatus, string> = {
  open: 'Aberto', in_progress: 'Em andamento', resolved: 'Resolvido', closed: 'Fechado',
};
const statusColors: Record<TicketStatus, string> = {
  open: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  in_progress: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  resolved: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  closed: 'bg-muted text-muted-foreground',
};
const categoryIcon = (c: TicketCategory) =>
  c === 'bug' ? Bug : c === 'duvida' ? HelpCircle : c === 'solicitacao' ? Wrench : MoreHorizontal;
const categoryLabels: Record<TicketCategory, string> = {
  bug: 'Bug', duvida: 'Dúvida', solicitacao: 'Solicitação', outro: 'Outro',
};

function getInitials(name?: string | null) {
  return name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
}

export default function TicketsPage() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const { data: isIT = false } = useIsITSupport();
  const { data: tickets = [], isLoading } = useTickets();
  const createMut = useCreateTicket();
  const updateMut = useUpdateTicket();
  const deleteMut = useDeleteTicket();
  const confirm = useConfirm();
  const { canDo } = usePermissions();

  const [viewMode, setViewMode] = useState<'list' | 'report'>('list');
  const [view, setView] = useState<'mine' | 'manage'>('mine');
  const [filter, setFilter] = useState<'all' | TicketStatus>('all');
  const [showNew, setShowNew] = useState(false);
  const [openTicket, setOpenTicket] = useState<Ticket | null>(null);
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'all' | TicketPriority>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | TicketCategory>('all');
  const [scope, setScope] = useState<'all' | 'mine' | 'assigned'>('all');
  const [slaFilter, setSlaFilter] = useState<'all' | 'breached'>('all');
  const [labelFilter, setLabelFilter] = useState<string>('all');
  const { labels: orgLabels } = useTicketLabels();
  const { data: labelAssignments = [] } = useTicketLabelAssignments();
  const isBreached = useSlaBreached();

  // Quando a visão muda, ajusta o scope default
  useEffect(() => {
    if (view === 'mine') setScope('mine');
    else setScope('all');
    setFilter('all');
  }, [view]);

  // New ticket form
  const [nTitle, setNTitle] = useState('');
  const [nDesc, setNDesc] = useState('');
  const [nPriority, setNPriority] = useState<TicketPriority>('medium');
  const [nCategory, setNCategory] = useState<TicketCategory>('bug');
  const [nFiles, setNFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profiles for author/assignee names
  const userIds = useMemo(() => {
    const ids = new Set<string>();
    tickets.forEach(t => { ids.add(t.created_by); if (t.assigned_to) ids.add(t.assigned_to); });
    return [...ids];
  }, [tickets]);
  const { data: profiles = [] } = useQuery({
    queryKey: ['ticket-profiles', userIds.sort().join(',')],
    queryFn: async () => {
      if (userIds.length === 0) return [];
      const { data } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
      return data || [];
    },
    enabled: userIds.length > 0,
  });
  const profileMap = useMemo(
    () => new Map(profiles.map((p: any) => [p.id, p])),
    [profiles],
  );

  // Membros do setor de TI (gerentes + operadores) + admins/diretores
  const { data: itMembers = [] } = useQuery({
    queryKey: ['it-support-members', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return [];
      const ids = new Set<string>();
      // 1) Membros do dept TI
      const { data: deptIds } = await supabase.rpc('get_dept_member_ids', {
        _org_id: currentOrg.id, _dept_name: 'TI',
      });
      (deptIds || []).forEach((r: any) => ids.add(r.user_id));
      // 2) Admins/diretores da org
      const { data: admins } = await supabase
        .from('organization_members').select('user_id')
        .eq('organization_id', currentOrg.id).eq('role', 'admin');
      (admins || []).forEach((m: any) => ids.add(m.user_id));
      const { data: directors } = await supabase
        .from('user_roles').select('user_id').eq('role', 'director');
      const orgUserIds = new Set((admins || []).map((m: any) => m.user_id));
      const { data: orgMembers } = await supabase
        .from('organization_members').select('user_id')
        .eq('organization_id', currentOrg.id);
      (orgMembers || []).forEach((m: any) => orgUserIds.add(m.user_id));
      (directors || []).forEach((r: any) => { if (orgUserIds.has(r.user_id)) ids.add(r.user_id); });
      if (ids.size === 0) return [];
      const { data: profs } = await supabase
        .from('profiles').select('id, full_name').in('id', [...ids]);
      return profs || [];
    },
    enabled: !!currentOrg && isIT,
  });

  const q = search.trim().toLowerCase();
  const ticketLabelMap = useMemo(() => {
    const m = new Map<string, string[]>();
    labelAssignments.forEach(a => {
      const arr = m.get(a.ticket_id) || [];
      arr.push(a.label_id);
      m.set(a.ticket_id, arr);
    });
    return m;
  }, [labelAssignments]);
  const baseFiltered = tickets.filter(t => {
    if (scope === 'mine' && t.created_by !== user?.id) return false;
    if (scope === 'assigned' && t.assigned_to !== user?.id) return false;
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
    if (slaFilter === 'breached' && !isBreached(t)) return false;
    if (labelFilter !== 'all' && !(ticketLabelMap.get(t.id) || []).includes(labelFilter)) return false;
    if (q && !(t.title.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q))) return false;
    return true;
  });
  const filtered = baseFiltered.filter(t => filter === 'all' ? true : t.status === filter);
  const counts = {
    all: baseFiltered.length,
    open: baseFiltered.filter(t => t.status === 'open').length,
    in_progress: baseFiltered.filter(t => t.status === 'in_progress').length,
    resolved: baseFiltered.filter(t => t.status === 'resolved').length,
    closed: baseFiltered.filter(t => t.status === 'closed').length,
  };
  const activeChips = (priorityFilter !== 'all' ? 1 : 0) + (categoryFilter !== 'all' ? 1 : 0) + (scope !== 'all' ? 1 : 0) + (q ? 1 : 0) + (slaFilter !== 'all' ? 1 : 0) + (labelFilter !== 'all' ? 1 : 0);

  const handleCreate = () => {
    if (!nTitle.trim()) return;
    createMut.mutate(
      { title: nTitle.trim(), description: nDesc.trim(), priority: nPriority, category: nCategory },
      {
        onSuccess: async (data: any) => {
          const ticketId = data?.id;
          // Upload pending files
          if (ticketId && nFiles.length > 0 && user) {
            await Promise.allSettled(nFiles.map(async (file) => {
              const ext = file.name.split('.').pop() || 'bin';
              const path = `${ticketId}/${crypto.randomUUID()}.${ext}`;
              const { error: upErr } = await supabase.storage.from('ticket-attachments').upload(path, file, {
                contentType: file.type, upsert: false,
              });
              if (upErr) return;
              await supabase.from('ticket_attachments').insert({
                ticket_id: ticketId, user_id: user.id,
                file_url: path, file_name: file.name,
                file_size: file.size, file_type: file.type || null,
              });
            }));
          }
          toast.success('Ticket aberto!');
          setShowNew(false);
          setNTitle(''); setNDesc(''); setNPriority('medium'); setNCategory('bug'); setNFiles([]);
        },
        onError: (e: any) => toast.error(e?.message || 'Erro'),
      }
    );
  };

  return (
    <div className="space-y-4">

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Tickets de TI</h1>
          <p className="text-sm text-muted-foreground">
            {view === 'manage'
              ? 'Gestão: atribua responsáveis e acompanhe o andamento interno.'
              : 'Abra um chamado e acompanhe o status dele.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canDo('view_reports') && (
            <Button
              variant={viewMode === 'report' ? 'default' : 'outline'}
              onClick={() => setViewMode(v => v === 'list' ? 'report' : 'list')}
            >
              <BarChart3 className="h-4 w-4 mr-1.5" />
              Relatório
            </Button>
          )}
          <Button onClick={() => setShowNew(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Abrir ticket
          </Button>
        </div>
      </div>

      {viewMode === 'report' ? (
        <TicketsReport />
      ) : (<>
      {/* View switcher: Meus tickets / Gestão TI (apenas TI vê gestão) */}
      {isIT && (
        <Tabs value={view} onValueChange={(v) => setView(v as any)}>
          <TabsList>
            <TabsTrigger value="mine">
              <Inbox className="h-3.5 w-3.5 mr-1.5" />
              Meus tickets
            </TabsTrigger>
            <TabsTrigger value="manage">
              <Headset className="h-3.5 w-3.5 mr-1.5" />
              Gestão TI
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {/* Busca + filtros */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por título ou descrição…"
            className="pl-8 h-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {view === 'manage' && (
            <Select value={scope} onValueChange={(v) => setScope(v as any)}>
              <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tickets</SelectItem>
                <SelectItem value="assigned">Atribuídos a mim</SelectItem>
                <SelectItem value="mine">Abertos por mim</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as any)}>
            <SelectTrigger className="h-9 w-[130px]"><SelectValue placeholder="Prioridade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Qualquer prioridade</SelectItem>
              {(Object.keys(priorityLabels) as TicketPriority[]).map(k => (
                <SelectItem key={k} value={k}>{priorityLabels[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as any)}>
            <SelectTrigger className="h-9 w-[130px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Qualquer categoria</SelectItem>
              {(Object.keys(categoryLabels) as TicketCategory[]).map(k => (
                <SelectItem key={k} value={k}>{categoryLabels[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={slaFilter} onValueChange={(v) => setSlaFilter(v as any)}>
            <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">SLA: qualquer</SelectItem>
              <SelectItem value="breached">SLA estourado</SelectItem>
            </SelectContent>
          </Select>
          {orgLabels.length > 0 && (
            <Select value={labelFilter} onValueChange={setLabelFilter}>
              <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Qualquer label</SelectItem>
                {orgLabels.map(l => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {activeChips > 0 && (
            <Button
              variant="ghost" size="sm" className="h-9 text-xs text-muted-foreground"
              onClick={() => {
                setSearch(''); setPriorityFilter('all'); setCategoryFilter('all');
                setScope(view === 'mine' ? 'mine' : 'all');
                setSlaFilter('all'); setLabelFilter('all');
              }}
            >
              <X className="h-3.5 w-3.5 mr-1" />Limpar
            </Button>
          )}
        </div>
      </div>

      {view === 'manage' && isIT ? (
        <ManageKanban
          tickets={baseFiltered}
          profileMap={profileMap as any}
          itMembers={itMembers as any}
          onOpen={(t) => setOpenTicket(t)}
          onAssign={(t, userId) => updateMut.mutate({
            id: t.id,
            assigned_to: userId,
            status: userId && t.status === 'open' ? 'in_progress' : t.status,
          })}
          onStatus={(t, status) => updateMut.mutate({ id: t.id, status })}
        />
      ) : (
        <>
          <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
            <TabsList className="flex flex-wrap h-auto">
              <TabsTrigger value="all">Todos <Badge variant="secondary" className="ml-1.5">{counts.all}</Badge></TabsTrigger>
              <TabsTrigger value="open">Abertos <Badge variant="secondary" className="ml-1.5">{counts.open}</Badge></TabsTrigger>
              <TabsTrigger value="in_progress">Em andamento <Badge variant="secondary" className="ml-1.5">{counts.in_progress}</Badge></TabsTrigger>
              <TabsTrigger value="resolved">Resolvidos <Badge variant="secondary" className="ml-1.5">{counts.resolved}</Badge></TabsTrigger>
              <TabsTrigger value="closed">Fechados <Badge variant="secondary" className="ml-1.5">{counts.closed}</Badge></TabsTrigger>
            </TabsList>
          </Tabs>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : filtered.length === 0 ? (
            <Card className="p-10 text-center text-sm text-muted-foreground">
              Nenhum ticket {filter !== 'all' ? `com status "${statusLabels[filter as TicketStatus]}"` : ''}.
            </Card>
          ) : (
            <div className="space-y-2">
              {filtered.map((t) => {
            const Icon = categoryIcon(t.category);
            const author = profileMap.get(t.created_by) as any;
            const assignee = t.assigned_to ? (profileMap.get(t.assigned_to) as any) : null;
            return (
              <Card
                key={t.id}
                onClick={() => setOpenTicket(t)}
                className="p-3 cursor-pointer hover:border-primary/40 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 flex-wrap">
                      {t.code && (
                        <span className="text-[10px] font-mono font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {t.code}
                        </span>
                      )}
                      <h3 className="font-medium truncate flex-1 min-w-0">{t.title}</h3>
                      <Badge className={cn('text-[10px]', priorityColors[t.priority])} variant="outline">
                        {priorityLabels[t.priority]}
                      </Badge>
                      <Badge className={cn('text-[10px]', statusColors[t.status])} variant="outline">
                        {statusLabels[t.status]}
                      </Badge>
                      <SlaBadge ticket={t} />
                    </div>
                    <div className="mt-1"><TicketLabelChips ticketId={t.id} /></div>
                    {t.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{t.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground">
                      <span>{author?.full_name || 'Usuário'}</span>
                      <span>•</span>
                      <span>{formatDistanceToNow(new Date(t.created_at), { addSuffix: true, locale: ptBR })}</span>
                      {assignee && (
                        <>
                          <span>•</span>
                          <span>Atribuído: {assignee.full_name}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
            </div>
          )}
        </>
      )}


      </>)}

      {/* New ticket dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Abrir ticket</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Título</Label>
              <Input autoFocus value={nTitle} onChange={(e) => setNTitle(e.target.value)} placeholder="Resumo do problema" />
            </div>
            <div>
              <Label className="text-xs">Descrição</Label>
              <Textarea value={nDesc} onChange={(e) => setNDesc(e.target.value)} rows={4} placeholder="Como reproduzir, mensagem de erro, etc." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Categoria</Label>
                <Select value={nCategory} onValueChange={(v) => setNCategory(v as TicketCategory)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(categoryLabels) as TicketCategory[]).map(k => (
                      <SelectItem key={k} value={k}>{categoryLabels[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Prioridade</Label>
                <Select value={nPriority} onValueChange={(v) => setNPriority(v as TicketPriority)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(priorityLabels) as TicketPriority[]).map(k => (
                      <SelectItem key={k} value={k}>{priorityLabels[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* File attachment zone */}
            <div>
              <Label className="text-xs">Anexos</Label>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) setNFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-1 w-full border-2 border-dashed rounded-md p-3 text-sm text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors flex items-center justify-center gap-2"
              >
                <Paperclip className="h-4 w-4" />
                Clique para anexar arquivos
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
            <Button onClick={handleCreate} disabled={!nTitle.trim() || createMut.isPending}>Abrir ticket</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      {openTicket && (
        <TicketDetail
          ticket={openTicket}
          onClose={() => setOpenTicket(null)}
          onUpdate={(patch) => updateMut.mutate({ id: openTicket.id, ...patch }, {
            onSuccess: () => {
              setOpenTicket((cur) => cur ? { ...cur, ...patch } as Ticket : cur);
              toast.success('Atualizado');
            },
          })}
          onDelete={async () => {
            const ok = await confirm({ title: 'Excluir este ticket?', destructive: true, confirmText: 'Excluir' });
            if (!ok) return;
            deleteMut.mutate(openTicket.id, {
              onSuccess: () => { toast.success('Ticket excluído'); setOpenTicket(null); },
            });
          }}
          isIT={isIT}
          isOwner={openTicket.created_by === user?.id}
          itMembers={itMembers as any}
          authorName={(profileMap.get(openTicket.created_by) as any)?.full_name || 'Usuário'}
        />
      )}
    </div>
  );
}

function TicketDetail({
  ticket, onClose, onUpdate, onDelete, isIT, isOwner, itMembers, authorName,
}: {
  ticket: Ticket;
  onClose: () => void;
  onUpdate: (patch: Partial<Ticket>) => void;
  onDelete: () => void;
  isIT: boolean;
  isOwner: boolean;
  itMembers: { id: string; full_name: string | null }[];
  authorName: string;
}) {
  const { user } = useAuth();
  const { data: comments = [] } = useTicketComments(ticket.id);
  const addComment = useAddTicketComment();
  const [text, setText] = useState('');

  const commentUserIds = [...new Set(comments.map(c => c.user_id))];
  const { data: cProfiles = [] } = useQuery({
    queryKey: ['comment-profiles', commentUserIds.sort().join(',')],
    queryFn: async () => {
      if (commentUserIds.length === 0) return [];
      const { data } = await supabase.from('profiles').select('id, full_name').in('id', commentUserIds);
      return data || [];
    },
    enabled: commentUserIds.length > 0,
  });
  const cMap = new Map((cProfiles as any[]).map(p => [p.id, p]));

  const send = () => {
    if (!text.trim()) return;
    addComment.mutate({ ticketId: ticket.id, content: text.trim() }, {
      onSuccess: () => setText(''),
      onError: () => toast.error('Erro ao enviar'),
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex-1 text-left flex items-baseline gap-2 flex-wrap pr-8">
            {ticket.code && (
              <span className="text-xs font-mono font-semibold text-muted-foreground">{ticket.code}</span>
            )}
            <span>{ticket.title}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Meta */}
          <div className="flex flex-wrap gap-2 items-center">
            <Badge variant="outline" className={cn('text-[10px]', statusColors[ticket.status])}>
              {statusLabels[ticket.status]}
            </Badge>
            <Badge variant="outline" className={cn('text-[10px]', priorityColors[ticket.priority])}>
              Prioridade: {priorityLabels[ticket.priority]}
            </Badge>
            <Badge variant="outline" className="text-[10px]">{categoryLabels[ticket.category]}</Badge>
            <SlaBadge ticket={ticket} />
            <div className="flex-1" />
            <TicketLabelPicker ticketId={ticket.id} />
          </div>
          <TicketLabelChips ticketId={ticket.id} />

          {ticket.description && (
            <Card className="p-3 bg-muted/30">
              <p className="text-sm whitespace-pre-wrap">{ticket.description}</p>
            </Card>
          )}

          <p className="text-xs text-muted-foreground">
            Aberto por <span className="font-medium">{authorName}</span> {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true, locale: ptBR })}
          </p>

          {/* IT controls */}
          {isIT && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-md border border-border p-3">
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={ticket.status} onValueChange={(v) => onUpdate({ status: v as TicketStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(statusLabels) as TicketStatus[]).map(k => (
                      <SelectItem key={k} value={k}>{statusLabels[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Atribuir a</Label>
                <div className="flex gap-1.5">
                  <Select
                    value={ticket.assigned_to || 'none'}
                    onValueChange={(v) => onUpdate({ assigned_to: v === 'none' ? null : v })}
                  >
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Ninguém" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Ninguém</SelectItem>
                      {itMembers.map(m => (
                        <SelectItem key={m.id} value={m.id}>{m.full_name || 'Sem nome'}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {user && ticket.assigned_to !== user.id && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onUpdate({ assigned_to: user.id, status: ticket.status === 'open' ? 'in_progress' : ticket.status })}
                      title="Pegar pra mim"
                    >
                      Pegar
                    </Button>
                  )}
                </div>
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">Prioridade</Label>
                <Select value={ticket.priority} onValueChange={(v) => onUpdate({ priority: v as TicketPriority })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(priorityLabels) as TicketPriority[]).map(k => (
                      <SelectItem key={k} value={k}>{priorityLabels[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Tabs: Comentários / Atividade */}
          <Tabs defaultValue="comments">
            <TabsList>
              <TabsTrigger value="comments">Comentários ({comments.length})</TabsTrigger>
              <TabsTrigger value="files">Anexos</TabsTrigger>
              <TabsTrigger value="activity">Atividade</TabsTrigger>
            </TabsList>
            <TabsContent value="comments" className="mt-3">
              <div className="space-y-2">
                {comments.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nenhum comentário ainda.</p>
                )}
                {comments.map((c) => {
                  const p = cMap.get(c.user_id) as any;
                  return (
                    <div key={c.id} className="flex gap-2">
                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarFallback className="bg-primary/15 text-primary text-[10px]">
                          {getInitials(p?.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-medium">{p?.full_name || 'Usuário'}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: ptBR })}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap break-words">{c.content}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-2 mt-3">
                <Textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Adicionar comentário…"
                  rows={2}
                  className="resize-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
                  }}
                />
                <Button onClick={send} disabled={!text.trim() || addComment.isPending} size="icon">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </TabsContent>
            <TabsContent value="files" className="mt-3">
              <TicketFilesTab ticketId={ticket.id} />
            </TabsContent>
            <TabsContent value="activity" className="mt-3">
              <ActivityTimeline ticketId={ticket.id} itMembers={itMembers} authorName={authorName} authorId={ticket.created_by} />
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {(isIT || isOwner) && (
            <Button variant="outline" onClick={onDelete} className="text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4 mr-1.5" /> Excluir
            </Button>
          )}
          <Button onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Kanban de gestão TI
// ============================================================

const KANBAN_COLS: { key: TicketStatus; label: string; Icon: typeof AlertCircle }[] = [
  { key: 'open', label: 'Abertos', Icon: AlertCircle },
  { key: 'in_progress', label: 'Em andamento', Icon: Clock },
  { key: 'resolved', label: 'Resolvidos', Icon: CheckCircle2 },
  { key: 'closed', label: 'Fechados', Icon: UserCheck },
];

function ManageKanban({
  tickets, profileMap, itMembers, onOpen, onAssign, onStatus,
}: {
  tickets: Ticket[];
  profileMap: Map<string, { id: string; full_name: string | null }>;
  itMembers: { id: string; full_name: string | null }[];
  onOpen: (t: Ticket) => void;
  onAssign: (t: Ticket, userId: string | null) => void;
  onStatus: (t: Ticket, status: TicketStatus) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
      {KANBAN_COLS.map(({ key, label, Icon }) => {
        const items = tickets.filter(t => t.status === key);
        return (
          <div key={key} className="rounded-lg border border-border bg-muted/20 p-2 flex flex-col min-h-[200px]">
            <div className="flex items-center gap-2 px-1.5 py-1.5 mb-1">
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
              <Badge variant="secondary" className="ml-auto h-5 text-[10px]">{items.length}</Badge>
            </div>
            <div className="space-y-2">
              {items.length === 0 && (
                <p className="text-[11px] text-muted-foreground px-2 py-3 text-center">Vazio</p>
              )}
              {items.map(t => {
                const Icon2 = categoryIcon(t.category);
                const assignee = t.assigned_to ? profileMap.get(t.assigned_to) : null;
                const author = profileMap.get(t.created_by);
                return (
                  <Card
                    key={t.id}
                    className="p-2.5 cursor-pointer hover:border-primary/40 transition-colors bg-background"
                    onClick={() => onOpen(t)}
                  >
                    <div className="flex items-start gap-2">
                      <Icon2 className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        {t.code && (
                          <div className="text-[9px] font-mono font-semibold text-muted-foreground mb-0.5">{t.code}</div>
                        )}
                        <h4 className="text-sm font-medium leading-snug">{t.title}</h4>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge
                          variant="outline"
                          className={cn('text-[9px] px-1.5 py-0 h-4', priorityColors[t.priority])}
                        >
                          {priorityLabels[t.priority]}
                        </Badge>
                        <SlaBadge ticket={t} compact />
                      </div>
                    </div>
                    <div className="mt-1.5"><TicketLabelChips ticketId={t.id} max={3} /></div>
                    <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] text-muted-foreground truncate flex-1 min-w-0">
                        {author?.full_name || 'Usuário'} • {formatDistanceToNow(new Date(t.created_at), { addSuffix: true, locale: ptBR })}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={t.assigned_to || 'none'}
                        onValueChange={(v) => onAssign(t, v === 'none' ? null : v)}
                      >
                        <SelectTrigger className="h-7 text-xs flex-1">
                          <SelectValue placeholder="Ninguém" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Ninguém</SelectItem>
                          {itMembers.map(m => (
                            <SelectItem key={m.id} value={m.id}>{m.full_name || 'Sem nome'}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={t.status} onValueChange={(v) => onStatus(t, v as TicketStatus)}>
                        <SelectTrigger className="h-7 text-xs w-[120px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(statusLabels) as TicketStatus[]).map(k => (
                            <SelectItem key={k} value={k}>{statusLabels[k]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {assignee && (
                      <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <Avatar className="h-4 w-4">
                          <AvatarFallback className="text-[8px] bg-primary/15 text-primary">
                            {getInitials(assignee.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate">{assignee.full_name}</span>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}


// ============================================================
// Timeline de atividade
// ============================================================

function actionLabel(a: TicketActivity, lookupName: (id: string | null) => string): { title: string; subtitle?: string } {
  switch (a.action) {
    case 'created':
      return { title: 'criou o ticket', subtitle: a.to_value || undefined };
    case 'status':
      return { title: `mudou status para "${statusLabels[(a.to_value || 'open') as TicketStatus] ?? a.to_value}"`, subtitle: a.from_value ? `de "${statusLabels[a.from_value as TicketStatus] ?? a.from_value}"` : undefined };
    case 'priority':
      return { title: `mudou prioridade para "${priorityLabels[(a.to_value || 'medium') as TicketPriority] ?? a.to_value}"`, subtitle: a.from_value ? `de "${priorityLabels[a.from_value as TicketPriority] ?? a.from_value}"` : undefined };
    case 'category':
      return { title: `mudou categoria para "${categoryLabels[(a.to_value || 'outro') as TicketCategory] ?? a.to_value}"` };
    case 'assigned': {
      const to = a.to_value ? lookupName(a.to_value) : null;
      if (!to) return { title: 'removeu o responsável' };
      return { title: `atribuiu para ${to}` };
    }
    case 'title':
      return { title: 'renomeou o ticket', subtitle: a.to_value || undefined };
    case 'description':
      return { title: 'atualizou a descrição' };
    default:
      return { title: a.action };
  }
}

function ActivityTimeline({
  ticketId, itMembers, authorName, authorId,
}: {
  ticketId: string;
  itMembers: { id: string; full_name: string | null }[];
  authorName: string;
  authorId: string;
}) {
  const { data: activity = [], isLoading } = useTicketActivity(ticketId);

  const userIds = useMemo(() => {
    const ids = new Set<string>();
    activity.forEach((a) => {
      if (a.user_id) ids.add(a.user_id);
      if (a.action === 'assigned') {
        if (a.from_value) ids.add(a.from_value);
        if (a.to_value) ids.add(a.to_value);
      }
    });
    return [...ids];
  }, [activity]);

  const { data: profiles = [] } = useQuery({
    queryKey: ['activity-profiles', userIds.sort().join(',')],
    queryFn: async () => {
      if (userIds.length === 0) return [];
      const { data } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
      return data || [];
    },
    enabled: userIds.length > 0,
  });

  const nameMap = useMemo(() => {
    const m = new Map<string, string>();
    (profiles as any[]).forEach((p) => m.set(p.id, p.full_name || 'Usuário'));
    itMembers.forEach((m2) => { if (m2.full_name) m.set(m2.id, m2.full_name); });
    m.set(authorId, authorName);
    return m;
  }, [profiles, itMembers, authorId, authorName]);

  const lookup = (id: string | null) => (id && nameMap.get(id)) || 'Usuário';

  if (isLoading) return <p className="text-xs text-muted-foreground">Carregando…</p>;
  if (activity.length === 0) return <p className="text-xs text-muted-foreground">Sem atividade ainda.</p>;

  return (
    <div className="relative pl-4 space-y-3 before:absolute before:left-[7px] before:top-1 before:bottom-1 before:w-px before:bg-border">
      {activity.map((a) => {
        const { title, subtitle } = actionLabel(a, lookup);
        const who = lookup(a.user_id);
        return (
          <div key={a.id} className="relative">
            <span className="absolute -left-4 top-1.5 h-2 w-2 rounded-full bg-primary" />
            <p className="text-xs">
              <span className="font-medium">{who}</span>{' '}
              <span className="text-muted-foreground">{title}</span>
            </p>
            {subtitle && (
              <p className="text-[11px] text-muted-foreground italic mt-0.5">{subtitle}</p>
            )}
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: ptBR })}
            </p>
          </div>
        );
      })}
    </div>
  );
}
