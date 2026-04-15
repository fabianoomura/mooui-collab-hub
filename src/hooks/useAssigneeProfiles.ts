import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ProfileInfo {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

export function useAssigneeProfiles(userIds: string[]) {
  return useQuery({
    queryKey: ['profiles', ...userIds.sort()],
    queryFn: async () => {
      if (userIds.length === 0) return new Map<string, ProfileInfo>();
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds);
      if (error) throw error;
      return new Map((data || []).map(p => [p.id, p]));
    },
    enabled: userIds.length > 0,
  });
}
