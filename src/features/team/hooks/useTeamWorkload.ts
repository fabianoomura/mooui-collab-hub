import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';

export interface MemberWorkload {
  userId: string;
  openTasks: number;
  overdueTasks: number;
  openStages: number;
  openChecklistItems: number;
  total: number;
}

export function useTeamWorkload(memberIds: string[]) {
  const { currentOrg } = useOrganization();
  const today = new Date().toISOString().split('T')[0];

  return useQuery({
    queryKey: ['team-workload', currentOrg?.id, memberIds.sort().join(',')],
    queryFn: async (): Promise<MemberWorkload[]> => {
      if (!currentOrg || memberIds.length === 0) return [];

      // 1) Task assignees → open tasks
      const { data: assigns } = await supabase
        .from('task_assignees')
        .select('user_id, task_id, tasks(id, status, due_date)')
        .in('user_id', memberIds);

      // 2) Launch stages assigned
      const { data: stages } = await supabase
        .from('launch_stages')
        .select('id, assignee_id, status, planned_end')
        .in('assignee_id', memberIds)
        .neq('status', 'done');

      // 3) Checklist items assigned
      const { data: checkItems } = await supabase
        .from('launch_checklist_items')
        .select('id, assignee_id, status, due_date')
        .in('assignee_id', memberIds)
        .neq('status', 'done')
        .neq('status', 'na');

      // Build workload map
      const map = new Map<string, MemberWorkload>();
      const getOrInit = (uid: string): MemberWorkload => {
        if (!map.has(uid)) {
          map.set(uid, { userId: uid, openTasks: 0, overdueTasks: 0, openStages: 0, openChecklistItems: 0, total: 0 });
        }
        return map.get(uid)!;
      };

      // Process tasks
      (assigns || []).forEach((a: any) => {
        const task = a.tasks;
        if (!task || task.status === 'done') return;
        const w = getOrInit(a.user_id);
        w.openTasks++;
        if (task.due_date && task.due_date < today) w.overdueTasks++;
      });

      // Process stages
      (stages || []).forEach((s: any) => {
        const w = getOrInit(s.assignee_id);
        w.openStages++;
      });

      // Process checklist items
      (checkItems || []).forEach((i: any) => {
        const w = getOrInit(i.assignee_id);
        w.openChecklistItems++;
      });

      // Calculate totals
      for (const w of map.values()) {
        w.total = w.openTasks + w.openStages + w.openChecklistItems;
      }

      // Include members with zero workload
      memberIds.forEach(uid => getOrInit(uid));

      return Array.from(map.values()).sort((a, b) => b.total - a.total);
    },
    enabled: !!currentOrg && memberIds.length > 0,
    staleTime: 60_000,
  });
}
