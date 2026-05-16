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

export function useIsITSupport() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['is-it-support', user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .in('role', ['it_support', 'admin']);
      return (data?.length ?? 0) > 0;
    },
    enabled: !!user,
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
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tickets'] }),
  });
}

export function useUpdateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Ticket> & { id: string }) => {
      const update: any = { ...patch };
      if (patch.status === 'resolved' && !patch.resolved_at) {
        update.resolved_at = new Date().toISOString();
      }
      const { error } = await supabase.from('tickets').update(update).eq('id', id);
      if (error) throw error;
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
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['ticket-comments', vars.ticketId] });
    },
  });
}
