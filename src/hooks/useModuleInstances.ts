import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';

export type ModuleKey = 'calendario' | 'lancamentos' | 'checagens' | 'melhorias' | 'conteudo' | 'sessoes' | 'produtos';

export interface ModuleInstance {
  id: string;
  organization_id: string;
  module_key: ModuleKey;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  position: number;
  archived_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export function useModuleInstances(moduleKey: ModuleKey) {
  const { currentOrg } = useOrganization();
  return useQuery({
    queryKey: ['module-instances', currentOrg?.id, moduleKey],
    enabled: !!currentOrg,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('module_instances')
        .select('*')
        .eq('organization_id', currentOrg!.id)
        .eq('module_key', moduleKey)
        .is('archived_at', null)
        .order('position')
        .order('created_at');
      if (error) throw error;
      return (data || []) as ModuleInstance[];
    },
  });
}

export function useCreateModuleInstance() {
  const qc = useQueryClient();
  const { currentOrg } = useOrganization();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      module_key: ModuleKey;
      name: string;
      description?: string;
      color?: string;
      icon?: string;
    }) => {
      if (!currentOrg || !user) throw new Error('Sem organização');
      const { data, error } = await supabase
        .from('module_instances')
        .insert({
          organization_id: currentOrg.id,
          module_key: input.module_key,
          name: input.name,
          description: input.description ?? null,
          color: input.color ?? '#D6336C',
          icon: input.icon ?? null,
          created_by: user.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data as ModuleInstance;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['module-instances', currentOrg?.id, vars.module_key] });
    },
  });
}

export function useArchiveModuleInstance() {
  const qc = useQueryClient();
  const { currentOrg } = useOrganization();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('module_instances')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['module-instances', currentOrg?.id] }),
  });
}

export function useRenameModuleInstance() {
  const qc = useQueryClient();
  const { currentOrg } = useOrganization();
  return useMutation({
    mutationFn: async ({ id, name, color }: { id: string; name?: string; color?: string }) => {
      const patch: { name?: string; color?: string } = {};
      if (name !== undefined) patch.name = name;
      if (color !== undefined) patch.color = color;
      const { data, error } = await supabase.from('module_instances').update(patch).eq('id', id).select('id').maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Espaco nao foi atualizado. Verifique permissao de administrador.');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['module-instances', currentOrg?.id] }),
  });
}
