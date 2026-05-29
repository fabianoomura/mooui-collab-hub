import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';

export type ModuleLink = {
  id: string;
  organization_id: string;
  source_type: string;
  source_id: string;
  target_type: string;
  target_id: string;
  created_by: string;
  created_at: string;
};

export function useLinksFrom(sourceType: string, sourceId: string | undefined) {
  const { currentOrg } = useOrganization();
  return useQuery({
    queryKey: ['module-links', 'from', sourceType, sourceId],
    queryFn: async () => {
      if (!currentOrg || !sourceId) return [];
      const { data, error } = await supabase
        .from('module_links')
        .select('*')
        .eq('organization_id', currentOrg.id)
        .eq('source_type', sourceType)
        .eq('source_id', sourceId);
      if (error) throw error;
      return (data || []) as ModuleLink[];
    },
    enabled: !!currentOrg && !!sourceId,
  });
}

export function useLinksTo(targetType: string, targetId: string | undefined) {
  const { currentOrg } = useOrganization();
  return useQuery({
    queryKey: ['module-links', 'to', targetType, targetId],
    queryFn: async () => {
      if (!currentOrg || !targetId) return [];
      const { data, error } = await supabase
        .from('module_links')
        .select('*')
        .eq('organization_id', currentOrg.id)
        .eq('target_type', targetType)
        .eq('target_id', targetId);
      if (error) throw error;
      return (data || []) as ModuleLink[];
    },
    enabled: !!currentOrg && !!targetId,
  });
}

export function useCreateLink() {
  const qc = useQueryClient();
  const { currentOrg } = useOrganization();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      source_type: string;
      source_id: string;
      target_type: string;
      target_id: string;
    }) => {
      if (!currentOrg || !user) throw new Error('Sem organização');
      const { data, error } = await supabase
        .from('module_links')
        .insert({
          organization_id: currentOrg.id,
          created_by: user.id,
          ...input,
        })
        .select()
        .single();
      if (error) throw error;
      return data as ModuleLink;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['module-links', 'from', vars.source_type, vars.source_id] });
      qc.invalidateQueries({ queryKey: ['module-links', 'to', vars.target_type, vars.target_id] });
    },
  });
}

export function useDeleteLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('module_links').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['module-links'] });
    },
  });
}
