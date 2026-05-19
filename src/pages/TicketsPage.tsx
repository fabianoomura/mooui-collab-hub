import { useEffect, useMemo, useState } from 'react';
import { Plus, Bug, HelpCircle, Wrench, MoreHorizontal, Trash2, Send, ArrowLeft, Search, X, Inbox, Headset, UserCheck, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  useTickets, useCreateTicket, useUpdateTicket, useDeleteTicket,
  useTicketComments, useAddTicketComment, useIsITSupport,
  type Ticket, type TicketStatus, type TicketPriority, type TicketCategory,
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useConfirm } from '@/components/ConfirmDialog';
import { cn } from '@/lib/utils';

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

  const [view, setView] = useState<'mine' | 'manage'>('mine');
  const [filter, setFilter] = useState<'all' | TicketStatus>('all');
  const [showNew, setShowNew] = useState(false);
  const [openTicket, setOpenTicket] = useState<Ticket | null>(null);
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'all' | TicketPriority>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | TicketCategory>('all');
  const [scope, setScope] = useState<'all' | 'mine' | 'assigned'>('all');

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
  const baseFiltered = tickets.filter(t => {
    if (scope === 'mine' && t.created_by !== user?.id) return false;
    if (scope === 'assigned' && t.assigned_to !== user?.id) return false;
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
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
  const activeChips = (priorityFilter !== 'all' ? 1 : 0) + (categoryFilter !== 'all' ? 1 : 0) + (scope !== 'all' ? 1 : 0) + (q ? 1 : 0);

  const handleCreate = () => {
    if (!nTitle.trim()) return;
    createMut.mutate(
      { title: nTitle.trim(), description: nDesc.trim(), priority: nPriority, category: nCategory },
      {
        onSuccess: () => {
          toast.success('Ticket aberto!');
          setShowNew(false);
          setNTitle(''); setNDesc(''); setNPriority('medium'); setNCategory('bug');
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
            {isIT ? 'Você é da equipe de TI.' : 'Reporte bugs e solicite suporte.'}
          </p>
        </div>
        <Button onClick={() => setShowNew(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Novo ticket
        </Button>
      </div>

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
          <Select value={scope} onValueChange={(v) => setScope(v as any)}>
            <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="mine">Meus tickets</SelectItem>
              <SelectItem value="assigned">Atribuídos a mim</SelectItem>
            </SelectContent>
          </Select>
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
          {activeChips > 0 && (
            <Button
              variant="ghost" size="sm" className="h-9 text-xs text-muted-foreground"
              onClick={() => { setSearch(''); setPriorityFilter('all'); setCategoryFilter('all'); setScope('all'); }}
            >
              <X className="h-3.5 w-3.5 mr-1" />Limpar
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Tickets de TI</h1>
          <p className="text-sm text-muted-foreground">
            {view === 'manage'
              ? 'Gestão: atribua responsáveis e acompanhe o andamento interno.'
              : 'Abra um chamado e acompanhe o status dele.'}
          </p>
        </div>
        <Button onClick={() => setShowNew(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Abrir ticket
        </Button>
      </div>

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
          {activeChips > 0 && (
            <Button
              variant="ghost" size="sm" className="h-9 text-xs text-muted-foreground"
              onClick={() => { setSearch(''); setPriorityFilter('all'); setCategoryFilter('all'); setScope(view === 'mine' ? 'mine' : 'all'); }}
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
                      <h3 className="font-medium truncate flex-1 min-w-0">{t.title}</h3>
                      <Badge className={cn('text-[10px]', priorityColors[t.priority])} variant="outline">
                        {priorityLabels[t.priority]}
                      </Badge>
                      <Badge className={cn('text-[10px]', statusColors[t.status])} variant="outline">
                        {statusLabels[t.status]}
                      </Badge>
                    </div>
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
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={onClose} className="md:hidden -ml-2">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <DialogTitle className="flex-1 text-left">{ticket.title}</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Meta */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className={cn('text-[10px]', statusColors[ticket.status])}>
              {statusLabels[ticket.status]}
            </Badge>
            <Badge variant="outline" className={cn('text-[10px]', priorityColors[ticket.priority])}>
              Prioridade: {priorityLabels[ticket.priority]}
            </Badge>
            <Badge variant="outline" className="text-[10px]">{categoryLabels[ticket.category]}</Badge>
          </div>

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

          {/* Comments */}
          <div>
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
              Comentários ({comments.length})
            </h3>
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
          </div>
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
