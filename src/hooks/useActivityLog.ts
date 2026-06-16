import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';

export type ActivityEntry = {
  id: string;
  organization_id: string;
  entity_type: string;
  entity_id: string;
  actor_id: string;
  action: string;
  payload: Record<string, any>;
  created_at: string;
  actor?: { full_name: string | null };
};

export function useActivityLog(entityType: string, entityId: string | undefined) {
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id;

  return useQuery({
    queryKey: ['activity-log', entityType, entityId],
    queryFn: async () => {
      if (!orgId || !entityId) return [];
      const { data, error } = await supabase
        .from('activity_log' as any)
        .select('*, actor:profiles!actor_id(full_name)')
        .eq('organization_id', orgId)
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ActivityEntry[];
    },
    enabled: !!orgId && !!entityId,
  });
}

export function useLogActivity() {
  const qc = useQueryClient();
  const { currentOrg } = useOrganization();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: {
      entityType: string;
      entityId: string;
      action: string;
      payload?: Record<string, any>;
    }) => {
      if (!currentOrg || !user) throw new Error('Sem organização ou usuário');
      const { data, error } = await supabase
        .from('activity_log' as any)
        .insert({
          organization_id: currentOrg.id,
          entity_type: input.entityType,
          entity_id: input.entityId,
          actor_id: user.id,
          action: input.action,
          payload: input.payload || {},
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['activity-log', vars.entityType, vars.entityId] });
    },
  });
}
