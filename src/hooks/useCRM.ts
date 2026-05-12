import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';

export type Pipeline = { id: string; name: string; kind: string; position: number; organization_id: string };
export type Stage = { id: string; pipeline_id: string; name: string; position: number; color: string; is_won: boolean; is_lost: boolean };
export type Contact = {
  id: string; organization_id: string; kind: string; name: string;
  company: string | null; email: string | null; phone: string | null;
  document: string | null; address: string | null; notes: string | null;
};
export type Deal = {
  id: string; organization_id: string; pipeline_id: string; stage_id: string;
  contact_id: string | null; title: string; value_cents: number; currency: string;
  expected_close_date: string | null; owner_id: string | null;
  shopify_draft_order_id: string | null; shopify_draft_order_name: string | null;
  shopify_draft_order_url: string | null; shopify_order_number: string | null;
  notes: string | null; position: number; status: string; created_by: string;
};

export function usePipelines() {
  const { currentOrg } = useOrganization();
  return useQuery({
    queryKey: ['crm_pipelines', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return [];
      const { data, error } = await supabase.from('crm_pipelines').select('*')
        .eq('organization_id', currentOrg.id).order('position');
      if (error) throw error;
      return (data || []) as Pipeline[];
    },
    enabled: !!currentOrg,
  });
}

export function useStages(pipelineId: string | undefined) {
  return useQuery({
    queryKey: ['crm_stages', pipelineId],
    queryFn: async () => {
      if (!pipelineId) return [];
      const { data, error } = await supabase.from('crm_stages').select('*')
        .eq('pipeline_id', pipelineId).order('position');
      if (error) throw error;
      return (data || []) as Stage[];
    },
    enabled: !!pipelineId,
  });
}

export function useContacts() {
  const { currentOrg } = useOrganization();
  return useQuery({
    queryKey: ['crm_contacts', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return [];
      const { data, error } = await supabase.from('crm_contacts').select('*')
        .eq('organization_id', currentOrg.id).order('name');
      if (error) throw error;
      return (data || []) as Contact[];
    },
    enabled: !!currentOrg,
  });
}

export function useDeals(pipelineId: string | undefined) {
  return useQuery({
    queryKey: ['crm_deals', pipelineId],
    queryFn: async () => {
      if (!pipelineId) return [];
      const { data, error } = await supabase.from('crm_deals').select('*')
        .eq('pipeline_id', pipelineId).order('position');
      if (error) throw error;
      return (data || []) as Deal[];
    },
    enabled: !!pipelineId,
  });
}

export function useCreateContact() {
  const { currentOrg } = useOrganization();
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (c: Partial<Contact> & { name: string; kind: string }) => {
      if (!currentOrg || !user) throw new Error('No org/user');
      const { data, error } = await supabase.from('crm_contacts').insert({
        organization_id: currentOrg.id,
        created_by: user.id,
        ...c,
      } as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm_contacts'] }),
  });
}

export function useCreateDeal() {
  const { currentOrg } = useOrganization();
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (d: Partial<Deal> & { title: string; pipeline_id: string; stage_id: string }) => {
      if (!currentOrg || !user) throw new Error('No org/user');
      const { data, error } = await supabase.from('crm_deals').insert({
        organization_id: currentOrg.id,
        created_by: user.id,
        ...d,
      } as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm_deals'] }),
  });
}

export function useUpdateDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Deal> & { id: string }) => {
      const { error } = await supabase.from('crm_deals').update(patch as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm_deals'] }),
  });
}

export function useDeleteDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('crm_deals').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm_deals'] }),
  });
}
