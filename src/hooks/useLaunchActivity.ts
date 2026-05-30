import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface LaunchStageActivity {
  id: string;
  stage_id: string;
  launch_id: string;
  user_id: string | null;
  action: string;
  from_value: string | null;
  to_value: string | null;
  created_at: string;
  profile?: { full_name: string | null } | null;
}

export function useLaunchActivity(launchId: string | undefined) {
  return useQuery({
    queryKey: ['launch-activity', launchId],
    queryFn: async () => {
      if (!launchId) return [];
      const { data, error } = await supabase
        .from('launch_stage_activity' as any)
        .select('*')
        .eq('launch_id', launchId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      const rows = (data || []) as unknown as LaunchStageActivity[];
      const userIds = [...new Set(rows.map(r => r.user_id).filter(Boolean))];
      if (userIds.length) {
        const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
        const pMap = new Map((profs || []).map((p: any) => [p.id, p]));
        rows.forEach(r => { r.profile = r.user_id ? pMap.get(r.user_id) || null : null; });
      }
      return rows;
    },
    enabled: !!launchId,
  });
}

export function useLogLaunchActivity() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: { stage_id: string; launch_id: string; action: string; from_value?: string | null; to_value?: string | null }) => {
      if (!user) return;
      const { error } = await supabase.from('launch_stage_activity' as any).insert({
        stage_id: entry.stage_id,
        launch_id: entry.launch_id,
        user_id: user.id,
        action: entry.action,
        from_value: entry.from_value ?? null,
        to_value: entry.to_value ?? null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['launch-activity'] }),
  });
}
