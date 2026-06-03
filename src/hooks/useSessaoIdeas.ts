import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';

export type SessaoIdeaStatus = 'nova' | 'selecionada' | 'em_producao' | 'usada' | 'arquivada';

export interface SessaoIdea {
  id: string;
  organization_id: string;
  title: string;
  category: string | null;
  status: SessaoIdeaStatus;
  notes: string | null;
  created_by: string;
  created_at: string;
}

export function useSessaoIdeas() {
  const { currentOrg } = useOrganization();
  return useQuery({
    queryKey: ['sessao-ideas', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return [];
      const { data, error } = await supabase
        .from('sessao_ideas' as any)
        .select('*')
        .eq('organization_id', currentOrg.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as SessaoIdea[];
    },
    enabled: !!currentOrg,
  });
}

export function useCreateSessaoIdea() {
  const { currentOrg } = useOrganization();
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { title: string; category?: string; notes?: string }) => {
      if (!currentOrg || !user) throw new Error('Sem organizacao');
      const { data, error } = await supabase.from('sessao_ideas' as any).insert({
        organization_id: currentOrg.id,
        created_by: user.id,
        title: input.title,
        category: input.category || null,
        status: 'nova',
        notes: input.notes || null,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessao-ideas'] }),
  });
}

export function useUpdateSessaoIdea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<SessaoIdea> & { id: string }) => {
      const { error } = await supabase.from('sessao_ideas' as any).update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessao-ideas'] }),
  });
}

export function useDeleteSessaoIdea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('sessao_ideas' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessao-ideas'] }),
  });
}
