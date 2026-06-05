import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ProjectMember {
  id: string;
  user_id: string;
  role: string;
  profile: {
    full_name: string | null;
    avatar_url: string | null;
    department: string | null;
  } | null;
}

export function useProjectMembers(projectId: string | undefined) {
  const queryClient = useQueryClient();

  const membersQuery = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('project_members')
        .select('id, user_id, role')
        .eq('project_id', projectId);
      if (error) throw error;

      // Fetch profiles for all member user_ids
      const userIds = (data || []).map(m => m.user_id);
      if (userIds.length === 0) return [];

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, department')
        .in('id', userIds);
      if (profilesError) throw profilesError;

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));

      return (data || []).map(m => ({
        ...m,
        profile: profileMap.get(m.user_id) || null,
      })) as ProjectMember[];
    },
    enabled: !!projectId,
  });

  const addAssignee = useMutation({
    mutationFn: async ({ taskId, userId }: { taskId: string; userId: string }) => {
      const { error } = await supabase
        .from('task_assignees')
        .upsert({ task_id: taskId, user_id: userId }, { onConflict: 'task_id,user_id', ignoreDuplicates: true });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const removeAssignee = useMutation({
    mutationFn: async ({ taskId, userId }: { taskId: string; userId: string }) => {
      const { error } = await supabase
        .from('task_assignees')
        .delete()
        .eq('task_id', taskId)
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  return {
    members: membersQuery.data || [],
    isLoading: membersQuery.isLoading,
    addAssignee,
    removeAssignee,
  };
}
