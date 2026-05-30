import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Search, X, Package, Eye, EyeOff, Send, CheckCircle2, Ban, AlertTriangle, Gift, Truck, RotateCcw, MapPin, Clock, MoreHorizontal, ArrowUpDown, History, Paperclip, Download, Trash2, BarChart3 } from 'lucide-react';
import { OrdersReport } from '@/components/orders/OrdersReport';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import {
  useOrders, useCreateOrder, useUpdateOrder, useDeleteOrder,
  useOrderComments, useAddOrderComment, useOrderActivity,
  type Order, type OrderStatus, type OrderPriority, type OrderProblem, type OrderSource,
  FINAL_STATUSES,
} from '@/hooks/useOrders';
import { AssigneePicker } from '@/components/AssigneePicker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useConfirm } from '@/components/ConfirmDialog';
import { usePermissions } from '@/hooks/usePermissions';
import { notifyUser } from '@/hooks/useNotifications';
import { useOrderAttachments } from '@/hooks/useOrderAttachments';
import { useDepartments } from '@/hooks/useOrgSettings';
import { cn } from '@/lib/utils';

const problemLabels: Record<OrderProblem, string> = {
  furo_estoque: 'Furo de estoque',
  aguardando_itens: 'Aguardando itens',
  aguardar_envio: 'Aguardar envio',
  presente: 'Enviar como presente',
  troca: 'Troca',
  devolucao: 'Devolução',
  endereco: 'Endereço',
  outro: 'Outro',
};
const problemIcon: Record<OrderProblem, any> = {
  furo_estoque: AlertTriangle,
  aguardando_itens: Clock,
  aguardar_envio: Truck,
  presente: Gift,
  troca: RotateCcw,
  devolucao: RotateCcw,
  endereco: MapPin,
  outro: MoreHorizontal,
};
/* Static fallback for legacy source values */
const STATIC_SOURCE_LABELS: Record<string, string> = {
  expedicao: 'Expedição',
  atendimento: 'Atendimento',
  marketing: 'Marketing',
  outro: 'Outro',
};
const statusLabels: Record<OrderStatus, string> = {
  open: 'Aberto', in_progress: 'Em andamento', waiting: 'Aguardando',
  sent: 'Enviado', done: 'Finalizado', cancelled: 'Cancelado',
};
const statusColors: Record<OrderStatus, string> = {
  open: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  in_progress: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  waiting: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  sent: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  done: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  cancelled: 'bg-muted text-muted-foreground',
};
const priorityLabels: Record<OrderPriority, string> = {
  low: 'Baixa', medium: 'Média', high: 'Alta', urgent: 'Urgente',
};
const priorityColors: Record<OrderPriority, string> = {
  low: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
  medium: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  high: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
  urgent: 'bg-destructive/15 text-destructive',
};

function initials(name?: string | null) {
  return name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
}

/** SLA badge for orders — visual timer since creation */
function OrderSlaBadge({ order }: { order: Order }) {
  if (FINAL_STATUSES.includes(order.status)) return null;
  const elapsed = Date.now() - new Date(order.created_at).getTime();
  const hours = elapsed / 3_600_000;
  const label = hours < 1
    ? `${Math.round(hours * 60)}min`
    : hours < 24
    ? `${Math.round(hours)}h`
    : `${Math.round(hours / 24)}d`;
  const cls = hours > 48
    ? 'bg-destructive/15 text-destructive border-destructive/30'
    : hours > 24
    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
    : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
  const Icon = hours > 48 ? AlertTriangle : Clock;
  return (
    <Badge variant="outline" className={cn('text-[10px] gap-1', cls)}>
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}

function describeActivity(a: { action: string; from_value: string | null; to_value: string | null }): string {
  switch (a.action) {
    case 'created': return `abriu o pedido${a.to_value ? `: "${a.to_value}"` : ''}`;
    case 'status': {
      const to = (statusLabels as any)[a.to_value || ''] || a.to_value;
      const from = (statusLabels as any)[a.from_value || ''] || a.from_value;
      return `mudou status de ${from} para ${to}`;
    }
    case 'priority': {
      const to = (priorityLabels as any)[a.to_value || ''] || a.to_value;
      const from = (priorityLabels as any)[a.from_value || ''] || a.from_value;
      return `mudou prioridade de ${from} para ${to}`;
    }
    case 'problem_type': {
      const to = (problemLabels as any)[a.to_value || ''] || a.to_value;
      const from = (problemLabels as any)[a.from_value || ''] || a.from_value;
      return `mudou o problema de ${from} para ${to}`;
    }
    case 'assigned': {
      if (!a.to_value) return 'removeu o responsável';
      if (!a.from_value) return 'atribuiu um responsável';
      return 'mudou o responsável';
    }
    default: return a.action;
  }
}

export default function OrdersPage() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const { data: orders = [], isLoading } = useOrders();
  const createMut = useCreateOrder();
  const updateMut = useUpdateOrder();
  const deleteMut = useDeleteOrder();
  const confirm = useConfirm();
  const { canDo } = usePermissions();
  const { data: departments = [] } = useDepartments(currentOrg?.id);

  // Escalation: notify managers for orders stale > 48h (once per session)
  const escalatedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!orders.length || !canDo('view_reports') || !currentOrg) return;
    const STALE_MS = 48 * 3600_000;
    const stale = orders.filter(o =>
      !FINAL_STATUSES.includes(o.status) &&
      (Date.now() - new Date(o.updated_at).getTime()) > STALE_MS &&
      !escalatedRef.current.has(o.id)
    );
    if (!stale.length) return;
    // Fetch managers/directors to notify
    (async () => {
      const { data: managers } = await supabase
        .from('organization_members')
        .select('user_id, role')
        .eq('organization_id', currentOrg.id)
        .in('role', ['admin', 'director', 'manager']);
      if (!managers?.length) return;
      for (const o of stale) {
        escalatedRef.current.add(o.id);
        for (const m of managers) {
          if (m.user_id === user?.id) continue;
          notifyUser({
            userId: m.user_id,
            type: 'order_escalation',
            title: `Pedido sem atualização > 48h`,
            message: `${o.title || o.code || 'Pedido'} (${statusLabels[o.status]})`,
            link: '/pedidos',
            metadata: { module: 'orders', entity_id: o.id },
          });
        }
      }
    })();
  }, [orders, canDo, currentOrg, user]);

  // Merge dynamic departments with static fallback for display labels
  const sourceLabels = useMemo(() => {
    const map: Record<string, string> = { ...STATIC_SOURCE_LABELS };
    departments.forEach(d => { map[d.name.toLowerCase()] = d.name; });
    return map;
  }, [departments]);

  // Ordered list of source keys for selects
  const sourceKeys = useMemo(() => {
    const keys = new Set(Object.keys(STATIC_SOURCE_LABELS));
    departments.forEach(d => keys.add(d.name.toLowerCase()));
    return [...keys];
  }, [departments]);

  const [viewMode, setViewMode] = useState<'list' | 'report'>('list');
  const [showFinished, setShowFinished] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [search, setSearch] = useState('');
  const [problemFilter, setProblemFilter] = useState<'all' | OrderProblem>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | OrderSource>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | OrderPriority>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'priority'>('newest');
  const [showNew, setShowNew] = useState(false);
  const [openOrder, setOpenOrder] = useState<Order | null>(null);

  // New order form
  const [nTitle, setNTitle] = useState('');
  const [nShopify, setNShopify] = useState('');
  const [nTotvs, setNTotvs] = useState('');
  const [nCustomer, setNCustomer] = useState('');
  const [nProblem, setNProblem] = useState<OrderProblem>('furo_estoque');
  const [nSource, setNSource] = useState<OrderSource>('');
  const [nPriority, setNPriority] = useState<OrderPriority>('medium');
  const [nDesc, setNDesc] = useState('');

  const userIds = useMemo(() => {
    const ids = new Set<string>();
    orders.forEach(o => { ids.add(o.created_by); if (o.assigned_to) ids.add(o.assigned_to); });
    return [...ids];
  }, [orders]);
  const { data: profiles = [] } = useQuery({
    queryKey: ['order-profiles', userIds.sort().join(',')],
    queryFn: async () => {
      if (!userIds.length) return [];
      const { data } = await supabase.from('profiles').select('id, full_name, department').in('id', userIds);
      return data || [];
    },
    enabled: userIds.length > 0,
  });
  const profileMap = useMemo(() => new Map(profiles.map((p: any) => [p.id, p])), [profiles]);

  // Fetch current user's department for auto-filling source
  const { data: myProfile } = useQuery({
    queryKey: ['my-profile-dept', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from('profiles').select('department').eq('id', user.id).maybeSingle();
      return data as { department: string | null } | null;
    },
    enabled: !!user,
    staleTime: 300_000,
  });
  const defaultSource = myProfile?.department?.toLowerCase() || 'expedicao';

  const q = search.trim().toLowerCase();
  const priorityRank: Record<OrderPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
  const visible = orders
    .filter(o => {
      const isFinal = FINAL_STATUSES.includes(o.status);
      if (!showFinished && isFinal) return false;
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (problemFilter !== 'all' && o.problem_type !== problemFilter) return false;
      if (sourceFilter !== 'all' && o.source !== sourceFilter) return false;
      if (priorityFilter !== 'all' && o.priority !== priorityFilter) return false;
      if (q) {
        const hay = [o.title, o.description, o.shopify_order, o.totvs_order, o.customer_name, o.code]
          .filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'priority') {
        const d = priorityRank[a.priority] - priorityRank[b.priority];
        if (d !== 0) return d;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      const ta = new Date(a.created_at).getTime();
      const tb = new Date(b.created_at).getTime();
      return sortBy === 'oldest' ? ta - tb : tb - ta;
    });

  const baseForCounts = orders.filter(o => {
    const isFinal = FINAL_STATUSES.includes(o.status);
    return showFinished ? true : !isFinal;
  });
  const counts = {
    all: baseForCounts.length,
    open: baseForCounts.filter(o => o.status === 'open').length,
    in_progress: baseForCounts.filter(o => o.status === 'in_progress').length,
    waiting: baseForCounts.filter(o => o.status === 'waiting').length,
    sent: baseForCounts.filter(o => o.status === 'sent').length,
    done: baseForCounts.filter(o => o.status === 'done').length,
    cancelled: baseForCounts.filter(o => o.status === 'cancelled').length,
  };

  const handleCreate = () => {
    if (!nTitle.trim()) { toast.error('Informe um título'); return; }
    if (!nShopify.trim() && !nTotvs.trim()) {
      toast.error('Informe ao menos um código (Shopify ou TOTVS)'); return;
    }
    createMut.mutate(
      {
        title: nTitle.trim(),
        shopify_order: nShopify.trim() || null,
        totvs_order: nTotvs.trim() || null,
        customer_name: nCustomer.trim() || null,
        problem_type: nProblem,
        source: nSource || defaultSource,
        priority: nPriority,
        description: nDesc.trim() || null,
      },
      {
        onSuccess: () => {
          toast.success('Pedido sinalizado!');
          setShowNew(false);
          setNTitle(''); setNShopify(''); setNTotvs(''); setNCustomer('');
          setNProblem('furo_estoque'); setNSource('expedicao'); setNPriority('medium'); setNDesc('');
        },
        onError: (e: any) => toast.error(e?.message || 'Erro ao criar'),
      },
    );
  };

  const handleStatus = (o: Order, status: OrderStatus) => {
    updateMut.mutate({ id: o.id, status }, {
      onSuccess: () => toast.success(`Status: ${statusLabels[status]}`),
      onError: (e: any) => toast.error(e?.message || 'Erro'),
    });
  };

  const handleDelete = async (o: Order) => {
    const ok = await confirm({
      title: `Excluir ${o.code || 'pedido'}?`,
      description: 'Esta ação não pode ser desfeita.',
      destructive: true, confirmText: 'Excluir',
    });
    if (!ok) return;
    deleteMut.mutate(o.id, {
      onSuccess: () => { toast.success('Excluído'); setOpenOrder(null); },
      onError: (e: any) => toast.error(e?.message || 'Erro'),
    });
  };

  const activeChips =
    (problemFilter !== 'all' ? 1 : 0) +
    (sourceFilter !== 'all' ? 1 : 0) +
    (priorityFilter !== 'all' ? 1 : 0) +
    (q ? 1 : 0);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Pedidos</h1>
          <p className="text-sm text-muted-foreground">
            Pedidos com problema ou que precisam de tratativa especial.
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
          <Button
            variant="outline"
            onClick={() => setShowFinished(s => !s)}
            title={showFinished ? 'Ocultar finalizados' : 'Mostrar finalizados'}
          >
            {showFinished ? <EyeOff className="h-4 w-4 mr-1.5" /> : <Eye className="h-4 w-4 mr-1.5" />}
            {showFinished ? 'Em andamento' : 'Ver finalizados'}
          </Button>
          <Button onClick={() => { setNSource(defaultSource); setShowNew(true); }}>
            <Plus className="h-4 w-4 mr-1.5" />
            Sinalizar pedido
          </Button>
        </div>
      </div>

      {viewMode === 'report' ? (
        <OrdersReport />
      ) : (
      <>
      {/* Search + filtros */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por código, cliente, Shopify, TOTVS…"
            className="pl-8 h-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={problemFilter} onValueChange={(v) => setProblemFilter(v as any)}>
            <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="Problema" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Qualquer problema</SelectItem>
              {(Object.keys(problemLabels) as OrderProblem[]).map(k => (
                <SelectItem key={k} value={k}>{problemLabels[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as any)}>
            <SelectTrigger className="h-9 w-[140px]"><SelectValue placeholder="Setor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Qualquer setor</SelectItem>
              {sourceKeys.map(k => (
                <SelectItem key={k} value={k}>{sourceLabels[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as any)}>
            <SelectTrigger className="h-9 w-[130px]"><SelectValue placeholder="Prioridade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Qualquer prioridade</SelectItem>
              {(Object.keys(priorityLabels) as OrderPriority[]).map(k => (
                <SelectItem key={k} value={k}>{priorityLabels[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
            <SelectTrigger className="h-9 w-[170px]">
              <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Mais recentes</SelectItem>
              <SelectItem value="oldest">Mais antigos</SelectItem>
              <SelectItem value="priority">Por urgência</SelectItem>
            </SelectContent>
          </Select>
          {activeChips > 0 && (
            <Button
              variant="ghost" size="sm" className="h-9 text-xs text-muted-foreground"
              onClick={() => {
                setSearch(''); setProblemFilter('all'); setSourceFilter('all'); setPriorityFilter('all');
              }}
            >
              <X className="h-3.5 w-3.5 mr-1" />Limpar
            </Button>
          )}
        </div>
      </div>

      {/* Status tabs */}
      <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="all">Todos <Badge variant="secondary" className="ml-1.5">{counts.all}</Badge></TabsTrigger>
          <TabsTrigger value="open">Abertos <Badge variant="secondary" className="ml-1.5">{counts.open}</Badge></TabsTrigger>
          <TabsTrigger value="in_progress">Em andamento <Badge variant="secondary" className="ml-1.5">{counts.in_progress}</Badge></TabsTrigger>
          <TabsTrigger value="waiting">Aguardando <Badge variant="secondary" className="ml-1.5">{counts.waiting}</Badge></TabsTrigger>
          {showFinished && (
            <>
              <TabsTrigger value="sent">Enviados <Badge variant="secondary" className="ml-1.5">{counts.sent}</Badge></TabsTrigger>
              <TabsTrigger value="done">Finalizados <Badge variant="secondary" className="ml-1.5">{counts.done}</Badge></TabsTrigger>
              <TabsTrigger value="cancelled">Cancelados <Badge variant="secondary" className="ml-1.5">{counts.cancelled}</Badge></TabsTrigger>
            </>
          )}
        </TabsList>
      </Tabs>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : visible.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
          Nenhum pedido {showFinished ? '' : 'em andamento'} encontrado.
        </Card>
      ) : (
        <div className="space-y-2">
          {visible.map(o => {
            const Icon = problemIcon[o.problem_type];
            const author = profileMap.get(o.created_by) as any;
            const assignee = o.assigned_to ? (profileMap.get(o.assigned_to) as any) : null;
            const isFinal = FINAL_STATUSES.includes(o.status);
            return (
              <Card
                key={o.id}
                onClick={() => setOpenOrder(o)}
                className={cn(
                  'p-3 cursor-pointer hover:border-primary/40 transition-colors',
                  isFinal && 'opacity-70',
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      {o.code && (
                        <span className="text-[10px] font-mono font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                          {o.code}
                        </span>
                      )}
                      <h3 className="font-medium truncate flex-1 min-w-0">{o.title}</h3>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <Badge variant="outline" className="text-[10px]">{problemLabels[o.problem_type]}</Badge>
                      <Badge variant="outline" className={cn('text-[10px]', priorityColors[o.priority])}>
                        {priorityLabels[o.priority]}
                      </Badge>
                      <Badge variant="outline" className={cn('text-[10px]', statusColors[o.status])}>
                        {statusLabels[o.status]}
                      </Badge>
                      <OrderSlaBadge order={o} />
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground flex-wrap">
                      {o.shopify_order && <span>Shopify: <span className="font-mono">{o.shopify_order}</span></span>}
                      {o.totvs_order && <span>TOTVS: <span className="font-mono">{o.totvs_order}</span></span>}
                      {o.customer_name && <span>Cliente: {o.customer_name}</span>}
                    </div>
                    {o.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{o.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground">
                      <span>{sourceLabels[o.source] || o.source}</span>
                      <span>•</span>
                      <span>Aberto por {author?.full_name || 'Usuário'}{author?.department ? ` (${author.department})` : ''}</span>
                      <span>•</span>
                      <span title={format(new Date(o.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}>
                        {format(new Date(o.created_at), "dd 'de' MMM, HH:mm", { locale: ptBR })}
                        {' '}({formatDistanceToNow(new Date(o.created_at), { addSuffix: true, locale: ptBR })})
                      </span>
                      {assignee && (<><span>•</span><span>Resp: {assignee.full_name}</span></>)}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* New order dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Sinalizar pedido</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Título / resumo *</Label>
              <Input value={nTitle} onChange={(e) => setNTitle(e.target.value)} placeholder="Ex: Pedido aguardando reposição de SKU X" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Pedido Shopify</Label>
                <Input value={nShopify} onChange={(e) => setNShopify(e.target.value)} placeholder="#1234" />
              </div>
              <div>
                <Label>Pedido TOTVS</Label>
                <Input value={nTotvs} onChange={(e) => setNTotvs(e.target.value)} placeholder="000123" />
              </div>
            </div>
            <div>
              <Label>Cliente</Label>
              <Input value={nCustomer} onChange={(e) => setNCustomer(e.target.value)} placeholder="Nome do cliente" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Problema / motivo</Label>
                <Select value={nProblem} onValueChange={(v) => setNProblem(v as OrderProblem)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(problemLabels) as OrderProblem[]).map(k => (
                      <SelectItem key={k} value={k}>{problemLabels[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Aberto por (setor)</Label>
                <Select value={nSource} onValueChange={(v) => setNSource(v as OrderSource)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {sourceKeys.map(k => (
                      <SelectItem key={k} value={k}>{sourceLabels[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioridade</Label>
                <Select value={nPriority} onValueChange={(v) => setNPriority(v as OrderPriority)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(priorityLabels) as OrderPriority[]).map(k => (
                      <SelectItem key={k} value={k}>{priorityLabels[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Descrição / observações</Label>
              <Textarea value={nDesc} onChange={(e) => setNDesc(e.target.value)} rows={3} placeholder="Detalhes para tratativa…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createMut.isPending}>Sinalizar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </>
      )}

      {/* Detail dialog */}
      {openOrder && (
        <OrderDetail
          order={openOrder}
          onClose={() => setOpenOrder(null)}
          onUpdate={(patch) => updateMut.mutate({ id: openOrder.id, ...patch })}
          onStatus={(s) => handleStatus(openOrder, s)}
          onDelete={() => handleDelete(openOrder)}
          profileMap={profileMap}
          currentUserId={user?.id}
          canDeleteAny={canDo('delete_any_order')}
          sourceLabels={sourceLabels}
          sourceKeys={sourceKeys}
        />
      )}
    </div>
  );
}

function OrderDetail({
  order, onClose, onUpdate, onStatus, onDelete, profileMap, currentUserId, canDeleteAny,
  sourceLabels, sourceKeys,
}: {
  order: Order;
  onClose: () => void;
  onUpdate: (patch: Partial<Order>) => void;
  onStatus: (s: OrderStatus) => void;
  onDelete: () => void;
  profileMap: Map<string, any>;
  currentUserId?: string;
  canDeleteAny?: boolean;
  sourceLabels: Record<string, string>;
  sourceKeys: string[];
}) {
  const { data: comments = [] } = useOrderComments(order.id);
  const { data: activity = [] } = useOrderActivity(order.id);
  const addComment = useAddOrderComment();
  const { attachments, uploadFile, deleteAttachment } = useOrderAttachments(order.id);
  const [newComment, setNewComment] = useState('');
  const [notes, setNotes] = useState(order.notes || '');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      uploadFile.mutate({ orderId: order.id, file }, {
        onSuccess: () => toast.success(`"${file.name}" enviado`),
        onError: (err: any) => toast.error(err?.message || 'Erro ao enviar arquivo'),
      });
    }
    e.target.value = '';
  };

  const author = profileMap.get(order.created_by) as any;
  const assignee = order.assigned_to ? (profileMap.get(order.assigned_to) as any) : null;
  const isFinal = FINAL_STATUSES.includes(order.status);

  const extraUserIds = useMemo(() => {
    const s = new Set<string>();
    comments.forEach(c => s.add(c.user_id));
    activity.forEach(a => { if (a.user_id) s.add(a.user_id); });
    return [...s];
  }, [comments, activity]);
  const { data: commentProfiles = [] } = useQuery({
    queryKey: ['order-extra-profiles', extraUserIds.sort().join(',')],
    queryFn: async () => {
      if (!extraUserIds.length) return [];
      const { data } = await supabase.from('profiles').select('id, full_name').in('id', extraUserIds);
      return data || [];
    },
    enabled: extraUserIds.length > 0,
  });
  const cmtMap = useMemo(() => new Map(commentProfiles.map((p: any) => [p.id, p])), [commentProfiles]);

  const send = () => {
    const v = newComment.trim();
    if (!v) return;
    addComment.mutate({ orderId: order.id, content: v }, {
      onSuccess: () => setNewComment(''),
      onError: (e: any) => toast.error(e?.message || 'Erro'),
    });
  };

  const saveNotes = () => {
    if (notes === (order.notes || '')) return;
    onUpdate({ notes });
    toast.success('Observações salvas');
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex-1 min-w-0 pr-8">
            <div className="flex items-center gap-2 flex-wrap">
              {order.code && (
                <span className="text-[11px] font-mono font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  {order.code}
                </span>
              )}
              <DialogTitle className="text-base truncate">{order.title}</DialogTitle>
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
              <Badge variant="outline" className="text-[10px]">{problemLabels[order.problem_type]}</Badge>
              <Badge variant="outline" className={cn('text-[10px]', statusColors[order.status])}>
                {statusLabels[order.status]}
              </Badge>
              <Badge variant="outline" className={cn('text-[10px]', priorityColors[order.priority])}>
                {priorityLabels[order.priority]}
              </Badge>
              <span>•</span>
              <span>{sourceLabels[order.source] || order.source}</span>
            </div>
          </div>
        </DialogHeader>

        <div className="grid md:grid-cols-3 gap-4 overflow-y-auto pr-1">
          <div className="md:col-span-2 space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <Label className="text-[11px] text-muted-foreground">Shopify</Label>
                <Input
                  value={order.shopify_order || ''}
                  onChange={(e) => onUpdate({ shopify_order: e.target.value || null })}
                  placeholder="—" className="h-8 font-mono text-xs"
                />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">TOTVS</Label>
                <Input
                  value={order.totvs_order || ''}
                  onChange={(e) => onUpdate({ totvs_order: e.target.value || null })}
                  placeholder="—" className="h-8 font-mono text-xs"
                />
              </div>
              <div className="col-span-2">
                <Label className="text-[11px] text-muted-foreground">Cliente</Label>
                <Input
                  value={order.customer_name || ''}
                  onChange={(e) => onUpdate({ customer_name: e.target.value || null })}
                  placeholder="—" className="h-8"
                />
              </div>
            </div>

            {order.description && (
              <div>
                <Label className="text-[11px] text-muted-foreground">Descrição</Label>
                <p className="text-sm mt-1 whitespace-pre-wrap">{order.description}</p>
              </div>
            )}

            <div>
              <Label className="text-[11px] text-muted-foreground">Observações internas</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={saveNotes}
                rows={3}
                placeholder="Tratativa, contato com cliente, etc."
              />
            </div>

            {/* Anexos */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-[11px] text-muted-foreground">Anexos ({attachments.length})</Label>
                <label className="cursor-pointer">
                  <input type="file" multiple className="hidden" onChange={handleFileUpload} />
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1" asChild>
                    <span><Paperclip className="h-3 w-3" /> Anexar</span>
                  </Button>
                </label>
              </div>
              {attachments.length > 0 && (
                <div className="space-y-1">
                  {attachments.map(att => (
                    <div key={att.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 text-xs group">
                      <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="flex-1 truncate">{att.file_name}</span>
                      <span className="text-muted-foreground text-[10px] shrink-0">
                        {att.file_size ? `${(att.file_size / 1024).toFixed(0)}KB` : ''}
                      </span>
                      {att.signed_url && (
                        <a href={att.signed_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                          <Download className="h-3 w-3" />
                        </a>
                      )}
                      {att.user_id === currentUserId && (
                        <button
                          className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => deleteAttachment.mutate(att.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Comentários */}
            <div>
              <Label className="text-[11px] text-muted-foreground">Comentários ({comments.length})</Label>
              <div className="space-y-2 mt-2">
                {comments.map(c => {
                  const cu = cmtMap.get(c.user_id) as any;
                  return (
                    <div key={c.id} className="flex gap-2">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="text-[10px]">{initials(cu?.full_name)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 bg-muted rounded p-2">
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="font-medium text-foreground">{cu?.full_name || 'Usuário'}</span>
                          <span>{formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: ptBR })}</span>
                        </div>
                        <p className="text-sm mt-0.5 whitespace-pre-wrap">{c.content}</p>
                      </div>
                    </div>
                  );
                })}
                <div className="flex gap-2">
                  <Textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Escrever comentário…"
                    rows={2}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); }
                    }}
                  />
                  <Button onClick={send} disabled={addComment.isPending || !newComment.trim()} size="sm">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Passo a passo / histórico */}
            <div>
              <Label className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <History className="h-3 w-3" /> Passo a passo ({activity.length})
              </Label>
              <ol className="mt-2 relative border-l border-border ml-2 space-y-3">
                {activity.length === 0 && (
                  <li className="text-xs text-muted-foreground pl-4">Sem histórico ainda.</li>
                )}
                {activity.map(a => {
                  const au = a.user_id ? (cmtMap.get(a.user_id) || profileMap.get(a.user_id)) as any : null;
                  return (
                    <li key={a.id} className="pl-4 relative">
                      <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary border-2 border-background" />
                      <div className="text-xs">
                        <span className="font-medium">{au?.full_name || 'Sistema'}</span>{' '}
                        <span className="text-muted-foreground">{describeActivity(a)}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {format(new Date(a.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <Label className="text-[11px] text-muted-foreground">Responsável pela tratativa</Label>
              <div className="flex items-center gap-2 mt-1">
                <AssigneePicker
                  value={order.assigned_to}
                  onChange={(id) => onUpdate({ assigned_to: id })}
                  size="md"
                />
                <span className="text-sm truncate">
                  {assignee?.full_name || <span className="text-muted-foreground">Não atribuído</span>}
                </span>
              </div>
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Status</Label>
              <Select value={order.status} onValueChange={(v) => onStatus(v as OrderStatus)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(statusLabels) as OrderStatus[]).map(s => (
                    <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Prioridade</Label>
              <Select value={order.priority} onValueChange={(v) => onUpdate({ priority: v as OrderPriority })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(priorityLabels) as OrderPriority[]).map(p => (
                    <SelectItem key={p} value={p}>{priorityLabels[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Problema</Label>
              <Select value={order.problem_type} onValueChange={(v) => onUpdate({ problem_type: v as OrderProblem })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(problemLabels) as OrderProblem[]).map(p => (
                    <SelectItem key={p} value={p}>{problemLabels[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Setor</Label>
              <Select value={order.source} onValueChange={(v) => onUpdate({ source: v as OrderSource })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {sourceKeys.map(p => (
                    <SelectItem key={p} value={p}>{sourceLabels[p] || p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="pt-2 space-y-1.5 text-[11px] text-muted-foreground">
              <p>Aberto por: <span className="text-foreground">{author?.full_name || 'Usuário'}</span></p>
              <p>
                Data de abertura:{' '}
                <span className="text-foreground">
                  {format(new Date(order.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </span>
                {' '}({formatDistanceToNow(new Date(order.created_at), { addSuffix: true, locale: ptBR })})
              </p>
              <div className="pt-1"><OrderSlaBadge order={order} /></div>
              {order.closed_at && (
                <p>
                  Encerrado em:{' '}
                  <span className="text-foreground">
                    {format(new Date(order.closed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                </p>
              )}
            </div>

            {!isFinal && (
              <div className="space-y-1.5 pt-2 border-t">
                <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => onStatus('sent')}>
                  <Truck className="h-3.5 w-3.5 mr-1.5" /> Marcar como enviado
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => onStatus('done')}>
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Finalizar
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start text-destructive" onClick={() => onStatus('cancelled')}>
                  <Ban className="h-3.5 w-3.5 mr-1.5" /> Cancelar
                </Button>
              </div>
            )}

            {(currentUserId === order.created_by || canDeleteAny) && (
              <Button variant="ghost" size="sm" className="w-full text-destructive" onClick={onDelete}>
                Excluir pedido
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
