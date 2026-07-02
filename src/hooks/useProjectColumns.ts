import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type ColumnType =
  | 'status' | 'texto' | 'pessoas' | 'cronograma' | 'data'
  | 'tags' | 'numeros' | 'checkbox' | 'link' | 'rating' | 'select';

export interface ProjectColumn {
  id: string;
  project_id: string;
  name: string;
  column_type: ColumnType;
  position: number;
  width: number | null;
  config: Record<string, unknown>;
  created_at: string;
}

export interface TaskCustomValue {
  id: string;
  task_id: string;
  column_id: string;
  value: string | null;
}

export function useProjectColumns(projectId: string | undefined) {
  const queryClient = useQueryClient();

  const columnsQuery = useQuery({
    queryKey: ['project-columns', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('project_columns')
        .select('*')
        .eq('project_id', projectId)
        .order('position');
      if (error) throw error;
      return (data || []) as unknown as ProjectColumn[];
    },
    enabled: !!projectId,
  });

  const customValuesQuery = useQuery({
    queryKey: ['task-custom-values', projectId],
    queryFn: async () => {
      if (!projectId) return new Map<string, Map<string, string>>();
      // Get all task ids for this project
      const { data: tasks, error: tasksErr } = await supabase
        .from('tasks')
        .select('id')
        .eq('project_id', projectId);
      if (tasksErr) throw tasksErr;
      
      const taskIds = (tasks || []).map(t => t.id);
      if (taskIds.length === 0) return new Map<string, Map<string, string>>();

      const { data, error } = await supabase
        .from('task_custom_values')
        .select('task_id, column_id, value')
        .in('task_id', taskIds);
      if (error) throw error;

      // Map: taskId -> Map<columnId, value>
      const valuesMap = new Map<string, Map<string, string>>();
      (data || []).forEach(v => {
        if (!valuesMap.has(v.task_id)) valuesMap.set(v.task_id, new Map());
        valuesMap.get(v.task_id)!.set(v.column_id, v.value || '');
      });
      return valuesMap;
    },
    enabled: !!projectId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['project-columns', projectId] });
    queryClient.invalidateQueries({ queryKey: ['task-custom-values', projectId] });
  };

  const addColumn = useMutation({
    mutationFn: async ({ name, columnType, config }: { name: string; columnType: ColumnType; config?: Record<string, unknown> }) => {
      if (!projectId) throw new Error('No project');
      const maxPos = (columnsQuery.data || []).reduce((max, c) => Math.max(max, c.position), -1);
      const { data, error } = await supabase
        .from('project_columns')
        .insert({ project_id: projectId, name, column_type: columnType, position: maxPos + 1, config: config || {} })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ProjectColumn;
    },
    onSuccess: invalidate,
  });

  const updateColumn = useMutation({
    mutationFn: async ({ columnId, updates }: { columnId: string; updates: { name?: string; position?: number; width?: number; column_type?: string; config?: Record<string, unknown> } }) => {
      const { error } = await supabase
        .from('project_columns')
        .update(updates as any)
        .eq('id', columnId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteColumn = useMutation({
    mutationFn: async (columnId: string) => {
      const { error } = await supabase
        .from('project_columns')
        .delete()
        .eq('id', columnId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const setCustomValue = useMutation({
    mutationFn: async ({ taskId, columnId, value }: { taskId: string; columnId: string; value: string }) => {
      const { error } = await supabase
        .from('task_custom_values')
        .upsert({ task_id: taskId, column_id: columnId, value }, { onConflict: 'task_id,column_id' });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    columns: columnsQuery.data || [],
    customValues: customValuesQuery.data || new Map<string, Map<string, string>>(),
    isLoading: columnsQuery.isLoading,
    addColumn,
    updateColumn,
    deleteColumn,
    setCustomValue,
  };
}
