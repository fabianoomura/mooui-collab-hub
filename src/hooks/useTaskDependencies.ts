import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TaskDependency {
  id: string;
  task_id: string;
  depends_on_id: string;
  task_title: string;
  task_status: string;
  created_at: string;
}

export function useTaskDependencies(taskId: string | undefined) {
  return useQuery({
    queryKey: ['task-dependencies', taskId],
    queryFn: async () => {
      if (!taskId) return [];

      const { data, error } = await (supabase
        .from('task_dependencies' as any)
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true }) as any);
      if (error) throw error;
      if (!data || data.length === 0) return [] as TaskDependency[];

      const dependsOnIds = data.map((d: any) => d.depends_on_id);

      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('id, title, status')
        .in('id', dependsOnIds);
      if (tasksError) throw tasksError;

      const taskMap = new Map((tasks || []).map((t) => [t.id, t]));

      return data.map((d: any) => {
        const task = taskMap.get(d.depends_on_id);
        return {
          id: d.id,
          task_id: d.task_id,
          depends_on_id: d.depends_on_id,
          task_title: task?.title ?? '',
          task_status: task?.status ?? '',
          created_at: d.created_at,
        } as TaskDependency;
      });
    },
    enabled: !!taskId,
  });
}

export function useAddDependency() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ task_id, depends_on_id }: { task_id: string; depends_on_id: string }) => {
      const { error } = await (supabase
        .from('task_dependencies' as any)
        .insert({ task_id, depends_on_id } as any) as any);
      if (error) throw error;
      return { task_id };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['task-dependencies', result.task_id] });
    },
  });
}

export function useRemoveDependency() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, taskId }: { id: string; taskId: string }) => {
      const { error } = await (supabase
        .from('task_dependencies' as any)
        .delete()
        .eq('id', id) as any);
      if (error) throw error;
      return { taskId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['task-dependencies', result.taskId] });
    },
  });
}

export function useBlockedBy(taskId: string | undefined) {
  const dependenciesQuery = useTaskDependencies(taskId);

  const blockers = (dependenciesQuery.data || [])
    .filter((dep) => dep.task_status !== 'done')
    .map((dep) => ({
      id: dep.depends_on_id,
      title: dep.task_title,
      status: dep.task_status,
    }));

  return {
    isBlocked: blockers.length > 0,
    blockers,
    isLoading: dependenciesQuery.isLoading,
  };
}
