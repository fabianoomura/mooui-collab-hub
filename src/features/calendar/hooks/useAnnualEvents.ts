import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';

function mapAnnualCategory(cat: string): string {
  if (cat === 'lancamento') return 'lancamento';
  if (cat === 'data') return 'feira';
  return 'campanha';
}

async function syncAnnualToCalendar(event: any) {
  await supabase.from('calendar_events' as any).upsert({
    organization_id: event.organization_id,
    source_type: 'annual_event',
    source_id: event.id,
    title: event.title,
    description: event.description ?? null,
    starts_at: event.start_date,
    ends_at: event.end_date ?? null,
    sector: null,
    category: mapAnnualCategory(event.category),
    scope: 'master',
  }, { onConflict: 'organization_id,source_type,source_id' });
}

async function deleteAnnualFromCalendar(id: string, orgId: string) {
  await supabase.from('calendar_events' as any).delete()
    .eq('source_type', 'annual_event').eq('source_id', id).eq('organization_id', orgId);
}

export type AnnualEvent = {
  id: string;
  organization_id: string;
  title: string;
  description: string | null;
  category: string;
  color: string;
  start_date: string;
  end_date: string | null;
  project_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export function useAnnualEvents(year?: number, instanceId?: string) {
  const { currentOrg } = useOrganization();
  return useQuery({
    queryKey: ['annual-events', currentOrg?.id, year, instanceId ?? null],
    queryFn: async () => {
      if (!currentOrg) return [];
      const y = year ?? new Date().getFullYear();
      let q = supabase
        .from('annual_events')
        .select('*')
        .eq('organization_id', currentOrg.id)
        .gte('start_date', `${y}-01-01`)
        .lte('start_date', `${y}-12-31`);
      if (instanceId) q = q.eq('instance_id', instanceId);
      const { data, error } = await q.order('start_date');
      if (error) throw error;
      return (data || []) as AnnualEvent[];
    },
    enabled: !!currentOrg,
  });
}

export function useCreateAnnualEvent() {
  const qc = useQueryClient();
  const { currentOrg } = useOrganization();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: Omit<AnnualEvent, 'id' | 'organization_id' | 'created_by' | 'created_at' | 'updated_at'> & { instance_id?: string | null }) => {
      if (!currentOrg || !user) throw new Error('Sem organização');
      const { data, error } = await supabase.from('annual_events').insert({
        ...input,
        organization_id: currentOrg.id,
        created_by: user.id,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['annual-events'] });
      if (data) syncAnnualToCalendar(data).then(() => qc.invalidateQueries({ queryKey: ['calendar-events'] }));
    },
  });
}

export function useUpdateAnnualEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<AnnualEvent> & { id: string }) => {
      const { data, error } = await supabase.from('annual_events').update(patch).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['annual-events'] });
      if (data) syncAnnualToCalendar(data).then(() => qc.invalidateQueries({ queryKey: ['calendar-events'] }));
    },
  });
}

export function useDeleteAnnualEvent() {
  const qc = useQueryClient();
  const { currentOrg } = useOrganization();
  return useMutation({
    mutationFn: async (id: string) => {
      if (currentOrg) await deleteAnnualFromCalendar(id, currentOrg.id);
      const { error } = await supabase.from('annual_events').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['annual-events'] });
      qc.invalidateQueries({ queryKey: ['calendar-events'] });
    },
  });
}
