import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';

export interface TicketLabel {
  id: string;
  organization_id: string;
  name: string;
  color: string;
}

export interface TicketLabelAssignment {
  id: string;
  ticket_id: string;
  label_id: string;
}

export function useTicketLabels() {
  const { currentOrg } = useOrganization();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['ticket-labels', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return [];
      const { data, error } = await supabase
        .from('ticket_labels')
        .select('*')
        .eq('organization_id', currentOrg.id)
        .order('name');
      if (error) throw error;
      return (data || []) as TicketLabel[];
    },
    enabled: !!currentOrg,
  });

  const create = useMutation({
    mutationFn: async ({ name, color }: { name: string; color: string }) => {
      if (!currentOrg) throw new Error('Sem org');
      const { error } = await supabase.from('ticket_labels').insert({
        organization_id: currentOrg.id, name, color,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ticket-labels'] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('ticket_labels').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ticket-labels'] }),
  });

  return { labels: query.data || [], create, remove };
}

export function useTicketLabelAssignments() {
  const { currentOrg } = useOrganization();
  return useQuery({
    queryKey: ['ticket-label-assignments', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return [];
      const { data, error } = await supabase
        .from('ticket_label_assignments')
        .select('id, ticket_id, label_id, tickets!inner(organization_id)')
        .eq('tickets.organization_id', currentOrg.id);
      if (error) throw error;
      return ((data || []) as any[]).map(r => ({
        id: r.id, ticket_id: r.ticket_id, label_id: r.label_id,
      })) as TicketLabelAssignment[];
    },
    enabled: !!currentOrg,
  });
}

export function useToggleTicketLabel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ticketId, labelId, attach }: { ticketId: string; labelId: string; attach: boolean }) => {
      if (attach) {
        const { error } = await supabase.from('ticket_label_assignments').insert({
          ticket_id: ticketId, label_id: labelId,
        });
        if (error && !String(error.message).includes('duplicate')) throw error;
      } else {
        const { error } = await supabase.from('ticket_label_assignments')
          .delete().eq('ticket_id', ticketId).eq('label_id', labelId);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ticket-label-assignments'] }),
  });
}
