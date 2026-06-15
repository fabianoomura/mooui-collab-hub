import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';

export function useTaskCommentCounts(taskIds: string[]) {
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id;

  return useQuery({
    queryKey: ['task-comment-counts', orgId, taskIds.length],
    queryFn: async () => {
      if (!orgId || taskIds.length === 0) return new Map<string, number>();
      const { data } = await supabase
        .from('comments' as any)
        .select('entity_id')
        .eq('organization_id', orgId)
        .eq('entity_type', 'task')
        .in('entity_id', taskIds);
      const counts = new Map<string, number>();
      (data || []).forEach((c: any) => {
        counts.set(c.entity_id, (counts.get(c.entity_id) || 0) + 1);
      });
      return counts;
    },
    enabled: !!orgId && taskIds.length > 0,
    staleTime: 60_000,
  });
}
