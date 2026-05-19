import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { notifyUser } from '@/hooks/useNotifications';

async function getITMemberIds(orgId: string): Promise<string[]> {
  const { data } = await supabase.rpc('get_dept_member_ids', { _org_id: orgId, _dept_name: 'TI' });
  return (data || []).map((r: any) => r.user_id);
}

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketCategory = 'bug' | 'duvida' | 'solicitacao' | 'outro';

export interface Ticket {
  id: string;
  organization_id: string;
  code: string | null;
  title: string;
  description: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  created_by: string;
  assigned_to: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TicketComment {
  id: string;
  ticket_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

export interface TicketActivity {
  id: string;
  ticket_id: string;
  user_id: string | null;
  action: 'created' | 'status' | 'priority' | 'category' | 'assigned' | 'title' | 'description';
  from_value: string | null;
  to_value: string | null;
  created_at: string;
}

export function useTicketActivity(ticketId: string | null) {
  return useQuery({
    queryKey: ['ticket-activity', ticketId],
    queryFn: async () => {
      if (!ticketId) return [];
      const { data, error } = await supabase
        .from('ticket_activity' as any)
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as TicketActivity[];
    },
    enabled: !!ticketId,
  });
}

export function useIsITSupport() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  return useQuery({
    queryKey: ['is-it-support', user?.id, currentOrg?.id],
    queryFn: async () => {
      if (!user || !currentOrg) return false;
      // Admin/diretor sempre é considerado TI; senão verifica se é membro do dept TI
      const { data: roles } = await supabase
        .from('user_roles').select('role').eq('user_id', user.id)
        .in('role', ['admin', 'director', 'it_support']);
      if ((roles?.length ?? 0) > 0) return true;
      const ids = await getITMemberIds(currentOrg.id);
      return ids.includes(user.id);
    },
    enabled: !!user && !!currentOrg,
  });
}

export function useTickets() {
  const { currentOrg } = useOrganization();
  return useQuery({
    queryKey: ['tickets', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return [];
      const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .eq('organization_id', currentOrg.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Ticket[];
    },
    enabled: !!currentOrg,
  });
}

export function useTicketComments(ticketId: string | null) {
  return useQuery({
    queryKey: ['ticket-comments', ticketId],
    queryFn: async () => {
      if (!ticketId) return [];
      const { data, error } = await supabase
        .from('ticket_comments')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at');
      if (error) throw error;
      return (data || []) as TicketComment[];
    },
    enabled: !!ticketId,
  });
}

export function useCreateTicket() {
  const { currentOrg } = useOrganization();
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      description?: string;
      priority: TicketPriority;
      category: TicketCategory;
    }) => {
      if (!currentOrg || !user) throw new Error('Sem organização');
      const { data, error } = await supabase.from('tickets').insert({
        organization_id: currentOrg.id,
        created_by: user.id,
        title: input.title,
        description: input.description || null,
        priority: input.priority,
        category: input.category,
        status: 'open',
      }).select().single();
      if (error) throw error;
      // Notifica equipe de TI (exceto o próprio autor)
      try {
        const itIds = await getITMemberIds(currentOrg.id);
        await Promise.all(
          itIds.filter(id => id !== user.id).map(id =>
            notifyUser({
              userId: id,
              type: 'ticket_new',
              title: `Novo ticket: ${input.title}`,
              message: `Prioridade ${input.priority} • categoria ${input.category}`,
              link: '/tickets',
            })
          )
        );
      } catch (e) { console.warn('ticket notify failed', e); }
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tickets'] }),
  });
}

export function useUpdateTicket() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Ticket> & { id: string }) => {
      const update: any = { ...patch };
      if (patch.status === 'resolved' && !patch.resolved_at) {
        update.resolved_at = new Date().toISOString();
      }
      // Buscar estado anterior para detectar mudanças
      const { data: before } = await supabase.from('tickets')
        .select('title, created_by, assigned_to, status').eq('id', id).single();
      const { error } = await supabase.from('tickets').update(update).eq('id', id);
      if (error) throw error;
      try {
        // Notifica novo responsável
        if (patch.assigned_to && before && patch.assigned_to !== before.assigned_to && patch.assigned_to !== user?.id) {
          await notifyUser({
            userId: patch.assigned_to,
            type: 'ticket_assigned',
            title: `Ticket atribuído a você: ${before.title}`,
            link: '/tickets',
          });
        }
        // Notifica autor sobre mudança de status
        if (patch.status && before && patch.status !== before.status && before.created_by !== user?.id) {
          await notifyUser({
            userId: before.created_by,
            type: 'ticket_status',
            title: `Seu ticket mudou para "${patch.status}"`,
            message: before.title,
            link: '/tickets',
          });
        }
      } catch (e) { console.warn('ticket update notify failed', e); }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tickets'] }),
  });
}

export function useDeleteTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tickets').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tickets'] }),
  });
}

export function useAddTicketComment() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ticketId, content }: { ticketId: string; content: string }) => {
      if (!user) throw new Error('Sem usuário');
      const { error } = await supabase.from('ticket_comments').insert({
        ticket_id: ticketId,
        user_id: user.id,
        content,
      });
      if (error) throw error;
      // Notifica o autor e o responsável (exceto o próprio comentarista)
      try {
        const { data: t } = await supabase.from('tickets')
          .select('title, created_by, assigned_to').eq('id', ticketId).single();
        if (t) {
          const targets = new Set<string>();
          if (t.created_by !== user.id) targets.add(t.created_by);
          if (t.assigned_to && t.assigned_to !== user.id) targets.add(t.assigned_to);
          await Promise.all([...targets].map(id => notifyUser({
            userId: id,
            type: 'ticket_comment',
            title: `Novo comentário em "${t.title}"`,
            message: content.slice(0, 80),
            link: '/tickets',
          })));
        }
      } catch (e) { console.warn('comment notify failed', e); }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['ticket-comments', vars.ticketId] });
    },
  });
}
