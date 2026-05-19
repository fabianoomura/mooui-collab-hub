import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import type { TicketPriority } from './useTickets';

export interface TicketSlaConfig {
  id: string;
  organization_id: string;
  priority: TicketPriority;
  response_hours: number;
  resolve_hours: number;
}

const DEFAULT_SLA: Record<TicketPriority, { response_hours: number; resolve_hours: number }> = {
  urgent: { response_hours: 1, resolve_hours: 4 },
  high: { response_hours: 4, resolve_hours: 24 },
  medium: { response_hours: 8, resolve_hours: 72 },
  low: { response_hours: 24, resolve_hours: 168 },
};

export function useSlaConfig() {
  const { currentOrg } = useOrganization();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['ticket-sla-config', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return [];
      const { data, error } = await supabase
        .from('ticket_sla_config')
        .select('*')
        .eq('organization_id', currentOrg.id);
      if (error) throw error;
      return (data || []) as TicketSlaConfig[];
    },
    enabled: !!currentOrg,
  });

  const map: Record<TicketPriority, { response_hours: number; resolve_hours: number }> = {
    ...DEFAULT_SLA,
  };
  (query.data || []).forEach(c => {
    map[c.priority] = { response_hours: c.response_hours, resolve_hours: c.resolve_hours };
  });

  const upsert = useMutation({
    mutationFn: async (input: { priority: TicketPriority; response_hours: number; resolve_hours: number }) => {
      if (!currentOrg) throw new Error('Sem org');
      const { error } = await supabase.from('ticket_sla_config').upsert({
        organization_id: currentOrg.id,
        ...input,
      }, { onConflict: 'organization_id,priority' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ticket-sla-config'] }),
  });

  return { configs: query.data || [], map, upsert };
}

export interface SlaStatus {
  due: Date;
  hoursLeft: number;
  state: 'ok' | 'warn' | 'breached' | 'done';
}

export function computeSla(
  createdAt: string,
  resolvedAt: string | null,
  status: string,
  priority: TicketPriority,
  slaMap: Record<TicketPriority, { response_hours: number; resolve_hours: number }>,
): SlaStatus {
  const cfg = slaMap[priority] ?? DEFAULT_SLA[priority] ?? DEFAULT_SLA.high;
  const due = new Date(new Date(createdAt).getTime() + cfg.resolve_hours * 3600 * 1000);
  if (status === 'resolved' || status === 'closed' || resolvedAt) {
    return { due, hoursLeft: 0, state: 'done' };
  }
  const ms = due.getTime() - Date.now();
  const hoursLeft = ms / 3600 / 1000;
  let state: SlaStatus['state'] = 'ok';
  if (ms < 0) state = 'breached';
  else if (hoursLeft <= Math.max(2, cfg.resolve_hours * 0.2)) state = 'warn';
  return { due, hoursLeft, state };
}
