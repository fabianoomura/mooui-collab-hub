import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Database } from '@/integrations/supabase/types';

type TaskRow = Database['public']['Tables']['tasks']['Row'];
type TaskInsert = Database['public']['Tables']['tasks']['Insert'];
export type TaskStatus = Database['public']['Enums']['task_status'];
export type TaskPriority = Database['public']['Enums']['task_priority'];

export interface TaskWithAssignees extends TaskRow {
  task_assignees: { user_id: string }[];
  task_label_assignments: { label_id: string; task_labels: { name: string; color: string } | null }[];
}

export interface KanbanColumn {
  id: TaskStatus;
  title: string;
  tasks: TaskWithAssignees[];
}

const COLUMNS_CONFIG: { id: TaskStatus; title: string }[] = [
  { id: 'backlog', title: 'Backlog' },
  { id: 'todo', title: 'A Fazer' },
  { id: 'in_progress', title: 'Em Progresso' },
  { id: 'in_review', title: 'Em Revisão' },
  { id: 'done', title: 'Concluído' },
];

export function useProjectTasks(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const tasksQuery = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          task_assignees(user_id),
          task_label_assignments(label_id, task_labels:label_id(name, color))
        `)
        .eq('project_id', projectId)
        .order('position');
      if (error) throw error;
      return (data || []) as unknown as TaskWithAssignees[];
    },
    enabled: !!projectId,
  });

  const columns: KanbanColumn[] = COLUMNS_CONFIG.map(col => ({
    ...col,
    tasks: (tasksQuery.data || []).filter(t => t.status === col.id),
  }));

  const moveTask = useMutation({
    mutationFn: async ({ taskId, newStatus, newPosition }: { taskId: string; newStatus: TaskStatus; newPosition: number }) => {
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus, position: newPosition })
        .eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', projectId] }),
  });

  const addTask = useMutation({
    mutationFn: async (task: { title: string; status: TaskStatus; priority: TaskPriority }) => {
      if (!projectId || !user) throw new Error('Missing project or user');
      const { error } = await supabase
        .from('tasks')
        .insert({
          project_id: projectId,
          title: task.title,
          status: task.status,
          priority: task.priority,
          created_by: user.id,
        });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', projectId] }),
  });

  const updateTask = useMutation({
    mutationFn: async ({ taskId, updates }: { taskId: string; updates: Partial<TaskRow> }) => {
      const { error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', projectId] }),
  });

  return { columns, tasks: tasksQuery.data || [], isLoading: tasksQuery.isLoading, moveTask, addTask, updateTask };
}

export function useProjects() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*, project_members(user_id)')
        .eq('status', 'active');
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ name, description, color }: { name: string; description?: string; color?: string }) => {
      if (!user) throw new Error('Not authenticated');
      const { data: project, error } = await supabase
        .from('projects')
        .insert({ name, description, color: color || '#D6336C', created_by: user.id })
        .select()
        .single();
      if (error) throw error;

      // Add creator as member
      await supabase.from('project_members').insert({
        project_id: project.id,
        user_id: user.id,
        role: 'owner',
      });

      return project;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  });
}
