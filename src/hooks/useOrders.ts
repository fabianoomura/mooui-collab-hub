import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { notifyUser } from '@/hooks/useNotifications';

export type OrderStatus = 'open' | 'in_progress' | 'waiting' | 'sent' | 'done' | 'cancelled';
export type OrderPriority = 'low' | 'medium' | 'high' | 'urgent';
export type OrderProblem =
  | 'furo_estoque' | 'aguardando_itens' | 'aguardar_envio'
  | 'presente' | 'troca' | 'devolucao' | 'endereco' | 'outro';
export type OrderSource = string;

export interface Order {
  id: string;
  organization_id: string;
  code: string | null;
  shopify_order: string | null;
  totvs_order: string | null;
  customer_name: string | null;
  problem_type: OrderProblem;
  source: OrderSource;
  status: OrderStatus;
  priority: OrderPriority;
  title: string;
  description: string | null;
  notes: string | null;
  assigned_to: string | null;
  created_by: string;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export const FINAL_STATUSES: OrderStatus[] = ['sent', 'done', 'cancelled'];

export function useOrders() {
  const { currentOrg } = useOrganization();
  return useQuery({
    queryKey: ['orders', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return [] as Order[];
      const { data, error } = await supabase
        .from('orders' as any)
        .select('*')
        .eq('organization_id', currentOrg.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Order[];
    },
    enabled: !!currentOrg,
  });
}

export function useCreateOrder() {
  const qc = useQueryClient();
  const { currentOrg } = useOrganization();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (payload: Partial<Order>) => {
      if (!currentOrg || !user) throw new Error('Sem organização');
      const { data, error } = await supabase
        .from('orders' as any)
        .insert({
          organization_id: currentOrg.id,
          created_by: user.id,
          title: payload.title || 'Sem título',
          shopify_order: payload.shopify_order || null,
          totvs_order: payload.totvs_order || null,
          customer_name: payload.customer_name || null,
          problem_type: payload.problem_type || 'outro',
          source: payload.source || 'expedicao',
          priority: payload.priority || 'medium',
          description: payload.description || null,
          notes: payload.notes || null,
        } as any)
        .select()
        .single();
      if (error) throw error;

      // Notify assignee
      const order = data as unknown as Order;
      if (order.assigned_to && order.assigned_to !== user.id) {
        notifyUser({
          userId: order.assigned_to,
          type: 'order_assigned',
          title: `Pedido atribuído: ${order.title}`,
          message: order.code ? `Pedido #${order.code}` : undefined,
          link: '/pedidos',
          metadata: { module: 'orders', entity_id: order.id, entity_code: order.code ?? undefined },
        });
      }

      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders', currentOrg?.id] }),
  });
}

export function useUpdateOrder() {
  const qc = useQueryClient();
  const { currentOrg } = useOrganization();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Order> & { id: string }) => {
      // Fetch original for change detection
      const { data: original } = await supabase
        .from('orders' as any)
        .select('created_by, assigned_to, status, title, code')
        .eq('id', id)
        .single();

      const { data, error } = await supabase
        .from('orders' as any)
        .update(patch as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;

      // Notifications (fire-and-forget)
      const prev = original as Record<string, any> | null;
      if (prev && user) {
        // Status changed → notify creator
        if (patch.status && patch.status !== prev.status && prev.created_by !== user.id) {
          notifyUser({
            userId: prev.created_by,
            type: 'order_status',
            title: `Pedido atualizado: ${prev.title}`,
            message: `Status alterado para "${patch.status}"`,
            link: '/pedidos',
            metadata: { module: 'orders', entity_id: id, entity_code: prev.code ?? undefined },
          });
        }
        // Assignee changed → notify new assignee
        if (patch.assigned_to && patch.assigned_to !== prev.assigned_to && patch.assigned_to !== user.id) {
          notifyUser({
            userId: patch.assigned_to,
            type: 'order_assigned',
            title: `Pedido atribuído: ${prev.title}`,
            message: prev.code ? `Pedido #${prev.code}` : undefined,
            link: '/pedidos',
            metadata: { module: 'orders', entity_id: id, entity_code: prev.code ?? undefined },
          });
        }
      }

      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders', currentOrg?.id] }),
  });
}

export function useDeleteOrder() {
  const qc = useQueryClient();
  const { currentOrg } = useOrganization();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('orders' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders', currentOrg?.id] }),
  });
}

export interface OrderComment {
  id: string; order_id: string; user_id: string; content: string; created_at: string;
}

export function useOrderComments(orderId?: string) {
  return useQuery({
    queryKey: ['order-comments', orderId],
    queryFn: async () => {
      if (!orderId) return [] as OrderComment[];
      const { data, error } = await supabase
        .from('order_comments' as any)
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as OrderComment[];
    },
    enabled: !!orderId,
  });
}

export function useAddOrderComment() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ orderId, content }: { orderId: string; content: string }) => {
      if (!user) throw new Error('Sem usuário');
      const { error } = await supabase.from('order_comments' as any).insert({
        order_id: orderId, user_id: user.id, content,
      } as any);
      if (error) throw error;

      // Notify order creator + assignee (skip self)
      const { data: order } = await supabase
        .from('orders' as any)
        .select('created_by, assigned_to, title, code')
        .eq('id', orderId)
        .single();

      if (order) {
        const o = order as Record<string, any>;
        const targets = new Set<string>();
        if (o.created_by && o.created_by !== user.id) targets.add(o.created_by);
        if (o.assigned_to && o.assigned_to !== user.id) targets.add(o.assigned_to);

        for (const uid of targets) {
          notifyUser({
            userId: uid,
            type: 'order_comment',
            title: `Novo comentário: ${o.title}`,
            message: content.length > 100 ? content.slice(0, 100) + '…' : content,
            link: '/pedidos',
            metadata: { module: 'orders', entity_id: orderId, entity_code: o.code ?? undefined },
          });
        }
      }
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['order-comments', v.orderId] }),
  });
}

export interface OrderActivity {
  id: string;
  order_id: string;
  user_id: string | null;
  action: string;
  from_value: string | null;
  to_value: string | null;
  created_at: string;
}

export function useOrderActivity(orderId?: string) {
  return useQuery({
    queryKey: ['order-activity', orderId],
    queryFn: async () => {
      if (!orderId) return [] as OrderActivity[];
      const { data, error } = await supabase
        .from('order_activity' as any)
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as OrderActivity[];
    },
    enabled: !!orderId,
  });
}
