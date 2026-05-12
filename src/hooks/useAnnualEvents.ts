import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';

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

export function useAnnualEvents(year?: number) {
  const { currentOrg } = useOrganization();
  return useQuery({
    queryKey: ['annual-events', currentOrg?.id, year],
    queryFn: async () => {
      if (!currentOrg) return [];
      const y = year ?? new Date().getFullYear();
      const { data, error } = await supabase
        .from('annual_events')
        .select('*')
        .eq('organization_id', currentOrg.id)
        .gte('start_date', `${y}-01-01`)
        .lte('start_date', `${y}-12-31`)
        .order('start_date');
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
    mutationFn: async (input: Omit<AnnualEvent, 'id' | 'organization_id' | 'created_by' | 'created_at' | 'updated_at'>) => {
      if (!currentOrg || !user) throw new Error('Sem organização');
      const { data, error } = await supabase.from('annual_events').insert({
        ...input,
        organization_id: currentOrg.id,
        created_by: user.id,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['annual-events'] }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['annual-events'] }),
  });
}

export function useDeleteAnnualEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('annual_events').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['annual-events'] }),
  });
}
