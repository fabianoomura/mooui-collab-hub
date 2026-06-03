import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';

export interface SessaoContract {
  id: string;
  organization_id: string;
  photographer_name: string;
  contract_start: string | null;
  contract_end: string | null;
  monthly_quota_photos: number | null;
  monthly_quota_videos: number | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export function useSessaoContracts() {
  const { currentOrg } = useOrganization();
  return useQuery({
    queryKey: ['sessao-contracts', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return [];
      const { data, error } = await supabase
        .from('sessao_contracts' as any)
        .select('*')
        .eq('organization_id', currentOrg.id)
        .order('contract_start', { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data || []) as unknown as SessaoContract[];
    },
    enabled: !!currentOrg,
  });
}

export function useCreateSessaoContract() {
  const { currentOrg } = useOrganization();
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      photographer_name: string;
      contract_start?: string;
      contract_end?: string;
      monthly_quota_photos?: number;
      monthly_quota_videos?: number;
      notes?: string;
    }) => {
      if (!currentOrg || !user) throw new Error('Sem organizacao');
      const { data, error } = await supabase.from('sessao_contracts' as any).insert({
        organization_id: currentOrg.id,
        created_by: user.id,
        photographer_name: input.photographer_name,
        contract_start: input.contract_start || null,
        contract_end: input.contract_end || null,
        monthly_quota_photos: input.monthly_quota_photos || 0,
        monthly_quota_videos: input.monthly_quota_videos || 0,
        notes: input.notes || null,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessao-contracts'] }),
  });
}

export function useUpdateSessaoContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<SessaoContract> & { id: string }) => {
      const { error } = await supabase.from('sessao_contracts' as any).update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessao-contracts'] }),
  });
}

export function useDeleteSessaoContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('sessao_contracts' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessao-contracts'] }),
  });
}
