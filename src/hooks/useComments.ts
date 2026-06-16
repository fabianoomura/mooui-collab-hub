import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';

export type Comment = {
  id: string;
  organization_id: string;
  entity_type: string;
  entity_id: string;
  author_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  author?: { full_name: string | null; email: string | null };
};

export function useComments(entityType: string, entityId: string | undefined) {
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id;

  return useQuery({
    queryKey: ['comments', entityType, entityId],
    queryFn: async () => {
      if (!orgId || !entityId) return [];
      const { data, error } = await supabase
        .from('comments' as any)
        .select('*, author:profiles!author_id(full_name, email)')
        .eq('organization_id', orgId)
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as Comment[];
    },
    enabled: !!orgId && !!entityId,
  });
}

export function useAddComment() {
  const qc = useQueryClient();
  const { currentOrg } = useOrganization();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: { entityType: string; entityId: string; body: string }) => {
      if (!currentOrg || !user) throw new Error('Sem organização ou usuário');
      const { data, error } = await supabase
        .from('comments' as any)
        .insert({
          organization_id: currentOrg.id,
          entity_type: input.entityType,
          entity_id: input.entityId,
          author_id: user.id,
          body: input.body,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['comments', vars.entityType, vars.entityId] });
    },
  });
}

export function useDeleteComment() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, entityType, entityId }: { id: string; entityType: string; entityId: string }) => {
      const { error } = await supabase.from('comments' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['comments', vars.entityType, vars.entityId] });
    },
  });
}
