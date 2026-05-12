import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type AppRole = 'admin' | 'manager' | 'member';

export interface DocPage {
  id: string;
  organization_id: string;
  parent_id: string | null;
  department_id: string | null;
  title: string;
  content: string | null;
  icon: string | null;
  position: number;
  can_edit_roles: AppRole[];
  can_delete_roles: AppRole[];
  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useDocPages(orgId?: string) {
  return useQuery({
    queryKey: ['doc-pages', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('doc_pages')
        .select('*')
        .eq('organization_id', orgId!)
        .order('title', { ascending: true });
      if (error) throw error;
      return data as DocPage[];
    },
  });
}

export function useCreateDocPage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      organization_id: string;
      parent_id?: string | null;
      department_id?: string | null;
      title?: string;
      icon?: string;
      can_edit_roles?: AppRole[];
      can_delete_roles?: AppRole[];
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error('Não autenticado');
      const { data, error } = await supabase
        .from('doc_pages')
        .insert({
          organization_id: input.organization_id,
          parent_id: input.parent_id ?? null,
          department_id: input.department_id ?? null,
          title: input.title ?? 'Sem título',
          icon: input.icon ?? '📄',
          created_by: uid,
          can_edit_roles: input.can_edit_roles ?? ['admin', 'manager', 'member'],
          can_delete_roles: input.can_delete_roles ?? ['admin'],
        })
        .select()
        .single();
      if (error) throw error;
      return data as DocPage;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['doc-pages', vars.organization_id] }),
  });
}

export function useUpdateDocPage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<DocPage> & { id: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('doc_pages')
        .update({ ...patch, updated_by: userData.user?.id })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as DocPage;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['doc-pages', data.organization_id] });
    },
  });
}

export function useDeleteDocPage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('doc_pages').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['doc-pages'] }),
  });
}
