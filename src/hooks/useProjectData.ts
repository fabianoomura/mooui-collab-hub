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
  subtasks?: TaskWithAssignees[];
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
        .is('archived_at', null)
        .order('position');
      if (error) throw error;
      
      const allTasks = (data || []) as unknown as TaskWithAssignees[];
      
      // Build parent-child hierarchy
      const parentTasks = allTasks.filter(t => !t.parent_task_id);
      const childMap = new Map<string, TaskWithAssignees[]>();
      allTasks.filter(t => t.parent_task_id).forEach(t => {
        const pid = t.parent_task_id!;
        if (!childMap.has(pid)) childMap.set(pid, []);
        childMap.get(pid)!.push(t);
      });
      
      parentTasks.forEach(t => {
        t.subtasks = childMap.get(t.id) || [];
      });
      
      return parentTasks;
    },
    enabled: !!projectId,
    staleTime: 30_000,
  });

  // Also return flat list of all tasks (parents + children) for counting etc
  const allTasksFlat = useQuery({
    queryKey: ['tasks-flat', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('tasks')
        .select('id, status, priority, parent_task_id')
        .eq('project_id', projectId)
        .is('archived_at', null);
      if (error) throw error;
      return data || [];
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['tasks-flat', projectId] });
    },
  });

  const addTask = useMutation({
    mutationFn: async (task: { title: string; status: TaskStatus; priority: TaskPriority; parent_task_id?: string; group_key?: string | null }) => {
      if (!projectId || !user) throw new Error('Missing project or user');
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          project_id: projectId,
          title: task.title,
          status: task.status,
          priority: task.priority,
          created_by: user.id,
          parent_task_id: task.parent_task_id || null,
          group_key: task.group_key || null,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['tasks-flat', projectId] });
    },
  });

  const updateTask = useMutation({
    mutationFn: async ({ taskId, updates }: { taskId: string; updates: Partial<TaskRow> }) => {
      const { error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['tasks-flat', projectId] });
    },
  });

  const deleteTask = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.from('tasks').delete().eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['tasks-flat', projectId] });
    },
  });

  const archiveTask = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from('tasks')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['tasks-flat', projectId] });
    },
  });

  return { columns, tasks: tasksQuery.data || [], isLoading: tasksQuery.isLoading, moveTask, addTask, updateTask, deleteTask, archiveTask };
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

export function useProjectsByOrg(orgId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['projects', 'org', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('projects')
        .select('*, project_members(user_id)')
        .eq('status', 'active')
        .eq('organization_id', orgId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !!orgId,
    staleTime: 60_000,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ name, description, color, organizationId }: { name: string; description?: string; color?: string; organizationId?: string }) => {
      if (!user) throw new Error('Not authenticated');
      const { data: project, error } = await supabase
        .from('projects')
        .insert({
          name,
          description,
          color: color || '#D6336C',
          created_by: user.id,
          organization_id: organizationId || null,
        })
        .select()
        .single();
      if (error) throw error;

      await supabase.from('project_members').insert({
        project_id: project.id,
        user_id: user.id,
        role: 'owner',
      });

      return project;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, updates }: { projectId: string; updates: { name?: string; description?: string | null; color?: string } }) => {
      const { error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (projectId: string) => {
      const { error } = await supabase
        .from('projects')
        .update({ status: 'archived' as const })
        .eq('id', projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useDestroyProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (projectId: string) => {
      const { error } = await supabase.from('projects').delete().eq('id', projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

// Hook for task comments — reads from polymorphic comments table
// Returns shape compatible with TaskSidePanel: { id, content, user_id, created_at, profile }
export function useTaskComments(taskId: string | undefined) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const commentsQuery = useQuery({
    queryKey: ['task-comments', taskId],
    queryFn: async () => {
      if (!taskId) return [];
      const { data, error } = await supabase
        .from('comments' as any)
        .select('*, author:profiles!author_id(id, full_name, avatar_url)')
        .eq('entity_type', 'task')
        .eq('entity_id', taskId)
        .order('created_at', { ascending: false });
      if (error) throw error;

      // Map to legacy shape for TaskSidePanel compatibility
      return (data || []).map((c: any) => ({
        id: c.id,
        task_id: c.entity_id,
        user_id: c.author_id,
        content: c.body,
        created_at: c.created_at,
        updated_at: c.updated_at,
        profile: c.author || null,
      }));
    },
    enabled: !!taskId,
  });

  const addComment = useMutation({
    mutationFn: async ({ taskId, content }: { taskId: string; content: string }) => {
      if (!user) throw new Error('Not authenticated');
      // Need org_id — get from task's project
      const { data: task } = await supabase
        .from('tasks')
        .select('project_id, projects(organization_id)')
        .eq('id', taskId)
        .single();
      const orgId = (task as any)?.projects?.organization_id;
      if (!orgId) throw new Error('Could not resolve organization');

      const { error } = await supabase.from('comments' as any).insert({
        organization_id: orgId,
        entity_type: 'task',
        entity_id: taskId,
        author_id: user.id,
        body: content,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-comments', taskId] });
    },
  });

  return { comments: commentsQuery.data || [], isLoading: commentsQuery.isLoading, addComment };
}

// Hook for task activity log — reads from polymorphic activity_log table
// Returns shape compatible with TaskSidePanel: { id, field_name, old_value, new_value, created_at, profile }
export function useTaskActivity(taskId: string | undefined) {
  return useQuery({
    queryKey: ['task-activity', taskId],
    queryFn: async () => {
      if (!taskId) return [];
      const { data, error } = await supabase
        .from('activity_log' as any)
        .select('*, actor:profiles!actor_id(id, full_name)')
        .eq('entity_type', 'task')
        .eq('entity_id', taskId)
        .order('created_at', { ascending: false });
      if (error) throw error;

      // Map to legacy shape for TaskSidePanel compatibility
      return (data || []).map((a: any) => ({
        id: a.id,
        task_id: a.entity_id,
        user_id: a.actor_id,
        field_name: a.action,
        old_value: a.payload?.from ?? null,
        new_value: a.payload?.to ?? null,
        created_at: a.created_at,
        profile: a.actor || null,
      }));
    },
    enabled: !!taskId,
  });
}
