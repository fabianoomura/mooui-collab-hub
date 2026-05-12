import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';

export type Template = { id: string; organization_id: string; name: string; description: string | null; created_by: string };
export type TemplateItem = { id: string; template_id: string; position: number; category: string; label: string; hint: string | null };
export type Checklist = {
  id: string; organization_id: string; launch_id: string | null; template_id: string | null;
  name: string; expected_arrival_date: string | null; created_by: string;
};
export type ChecklistItem = {
  id: string; checklist_id: string; position: number; category: string; label: string;
  status: string; assignee_id: string | null; due_date: string | null; notes: string | null;
  completed_at: string | null; completed_by: string | null;
};

export function useTemplates() {
  const { currentOrg } = useOrganization();
  return useQuery({
    queryKey: ['checklist_templates', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return [];
      const { data, error } = await supabase.from('checklist_templates').select('*')
        .eq('organization_id', currentOrg.id).order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Template[];
    },
    enabled: !!currentOrg,
  });
}

export function useTemplateItems(templateId: string | undefined) {
  return useQuery({
    queryKey: ['checklist_template_items', templateId],
    queryFn: async () => {
      if (!templateId) return [];
      const { data, error } = await supabase.from('checklist_template_items').select('*')
        .eq('template_id', templateId).order('position');
      if (error) throw error;
      return (data || []) as TemplateItem[];
    },
    enabled: !!templateId,
  });
}

export function useChecklists() {
  const { currentOrg } = useOrganization();
  return useQuery({
    queryKey: ['launch_checklists', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return [];
      const { data, error } = await supabase.from('launch_checklists').select('*')
        .eq('organization_id', currentOrg.id).order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Checklist[];
    },
    enabled: !!currentOrg,
  });
}

export function useChecklistItems(checklistId: string | undefined) {
  return useQuery({
    queryKey: ['launch_checklist_items', checklistId],
    queryFn: async () => {
      if (!checklistId) return [];
      const { data, error } = await supabase.from('launch_checklist_items').select('*')
        .eq('checklist_id', checklistId).order('position');
      if (error) throw error;
      return (data || []) as ChecklistItem[];
    },
    enabled: !!checklistId,
  });
}

export function useCreateChecklistFromTemplate() {
  const { currentOrg } = useOrganization();
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { name: string; templateId?: string; launchId?: string; expected_arrival_date?: string }) => {
      if (!currentOrg || !user) throw new Error('No org/user');
      const { data: cl, error } = await supabase.from('launch_checklists').insert({
        organization_id: currentOrg.id,
        created_by: user.id,
        name: p.name,
        template_id: p.templateId ?? null,
        launch_id: p.launchId ?? null,
        expected_arrival_date: p.expected_arrival_date ?? null,
      } as any).select().single();
      if (error) throw error;

      if (p.templateId) {
        const { data: items } = await supabase.from('checklist_template_items').select('*')
          .eq('template_id', p.templateId).order('position');
        if (items?.length) {
          await supabase.from('launch_checklist_items').insert(
            items.map((i: any) => ({
              checklist_id: cl.id, position: i.position, category: i.category, label: i.label, status: 'pending',
            }))
          );
        }
      }
      return cl;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['launch_checklists'] });
      qc.invalidateQueries({ queryKey: ['launch_checklist_items'] });
    },
  });
}

export function useUpdateChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<ChecklistItem> & { id: string }) => {
      const { error } = await supabase.from('launch_checklist_items').update(patch as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['launch_checklist_items'] }),
  });
}

export function useCreateTemplate() {
  const { currentOrg } = useOrganization();
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { name: string; description?: string; items: Array<{ category: string; label: string; hint?: string }> }) => {
      if (!currentOrg || !user) throw new Error('No org/user');
      const { data: tpl, error } = await supabase.from('checklist_templates').insert({
        organization_id: currentOrg.id, created_by: user.id, name: p.name, description: p.description ?? null,
      } as any).select().single();
      if (error) throw error;
      if (p.items.length) {
        await supabase.from('checklist_template_items').insert(
          p.items.map((i, idx) => ({ template_id: tpl.id, position: idx, category: i.category, label: i.label, hint: i.hint ?? null }))
        );
      }
      return tpl;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checklist_templates'] }),
  });
}

export function useSaveAsTemplate() {
  const { currentOrg } = useOrganization();
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ checklistId, name }: { checklistId: string; name: string }) => {
      if (!currentOrg || !user) throw new Error('No org/user');
      const { data: items } = await supabase.from('launch_checklist_items').select('*')
        .eq('checklist_id', checklistId).order('position');
      const { data: tpl, error } = await supabase.from('checklist_templates').insert({
        organization_id: currentOrg.id, created_by: user.id, name,
      } as any).select().single();
      if (error) throw error;
      if (items?.length) {
        await supabase.from('checklist_template_items').insert(
          items.map((i: any) => ({ template_id: tpl.id, position: i.position, category: i.category, label: i.label }))
        );
      }
      return tpl;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checklist_templates'] }),
  });
}
