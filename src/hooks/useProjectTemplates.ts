import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface ProjectTemplate {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
}

export interface ProjectTemplateTask {
  id: string;
  template_id: string;
  title: string;
  status: string;
  priority: string;
  parent_ref: string | null;
  position: number;
}

export function useProjectTemplates() {
  const { currentOrg } = useOrganization();
  return useQuery({
    queryKey: ['project_templates', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return [];
      const { data, error } = await supabase
        .from('project_templates' as any)
        .select('*')
        .eq('organization_id', currentOrg.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ProjectTemplate[];
    },
    enabled: !!currentOrg,
  });
}

export function useProjectTemplateTasks(templateId: string | undefined) {
  return useQuery({
    queryKey: ['project_template_tasks', templateId],
    queryFn: async () => {
      if (!templateId) return [];
      const { data, error } = await supabase
        .from('project_template_tasks' as any)
        .select('*')
        .eq('template_id', templateId)
        .order('position');
      if (error) throw error;
      return (data || []) as unknown as ProjectTemplateTask[];
    },
    enabled: !!templateId,
  });
}

export function useSaveProjectAsTemplate() {
  const { currentOrg } = useOrganization();
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, name, description }: { projectId: string; name: string; description?: string }) => {
      if (!currentOrg || !user) throw new Error('No org/user');

      // Get all tasks from the project
      const { data: tasks, error: taskErr } = await supabase
        .from('tasks')
        .select('id, title, status, priority, parent_task_id, position')
        .eq('project_id', projectId)
        .order('position');
      if (taskErr) throw taskErr;

      // Create template
      const { data: tpl, error: tplErr } = await supabase
        .from('project_templates' as any)
        .insert({
          organization_id: currentOrg.id,
          created_by: user.id,
          name,
          description: description || null,
        } as any)
        .select()
        .single();
      if (tplErr) throw tplErr;

      if (tasks?.length) {
        // Map old task IDs to new template task IDs
        const idMap = new Map<string, string>();
        const templateTasks: any[] = [];

        // First pass: create entries without parent_ref
        for (const t of tasks) {
          const newId = crypto.randomUUID();
          idMap.set(t.id, newId);
          templateTasks.push({
            id: newId,
            template_id: (tpl as any).id,
            title: t.title,
            status: t.status,
            priority: t.priority,
            parent_ref: null, // set in second pass
            position: t.position,
          });
        }

        // Second pass: set parent_ref
        for (let i = 0; i < tasks.length; i++) {
          if (tasks[i].parent_task_id) {
            templateTasks[i].parent_ref = idMap.get(tasks[i].parent_task_id!) || null;
          }
        }

        await supabase.from('project_template_tasks' as any).insert(templateTasks);
      }

      return tpl;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project_templates'] });
      toast.success('Template salvo!');
    },
    onError: () => toast.error('Erro ao salvar template'),
  });
}

export function useCreateProjectFromTemplate() {
  const { currentOrg } = useOrganization();
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ templateId, projectId }: { templateId: string; projectId: string }) => {
      if (!currentOrg || !user) throw new Error('No org/user');

      // Get template tasks
      const { data: tplTasks, error } = await supabase
        .from('project_template_tasks' as any)
        .select('*')
        .eq('template_id', templateId)
        .order('position');
      if (error) throw error;
      if (!tplTasks?.length) return;

      // Map template task IDs to new real task IDs
      const idMap = new Map<string, string>();
      const newTasks: any[] = [];

      for (const t of tplTasks as unknown as ProjectTemplateTask[]) {
        const newId = crypto.randomUUID();
        idMap.set(t.id, newId);
        newTasks.push({
          id: newId,
          project_id: projectId,
          title: t.title,
          status: t.status,
          priority: t.priority,
          parent_task_id: null,
          position: t.position,
          created_by: user.id,
        });
      }

      // Set parent references
      for (let i = 0; i < (tplTasks as any[]).length; i++) {
        const t = (tplTasks as unknown as ProjectTemplateTask[])[i];
        if (t.parent_ref) {
          newTasks[i].parent_task_id = idMap.get(t.parent_ref) || null;
        }
      }

      const { error: insertErr } = await supabase.from('tasks').insert(newTasks);
      if (insertErr) throw insertErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Tarefas criadas a partir do template!');
    },
    onError: () => toast.error('Erro ao aplicar template'),
  });
}

export function useDeleteProjectTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase.from('project_templates' as any).delete().eq('id', templateId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project_templates'] });
      toast.success('Template excluído!');
    },
  });
}
