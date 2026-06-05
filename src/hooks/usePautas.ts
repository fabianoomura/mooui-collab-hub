import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { notifyUser } from '@/hooks/useNotifications';

export type PautaStatus = 'pendente' | 'em_andamento' | 'concluida';
export type PautaPriority = 'low' | 'medium' | 'high';

export interface Pauta {
  id: string;
  organization_id: string;
  title: string;
  assigned_to: string | null;
  priority: PautaPriority;
  status: PautaStatus;
  scheduled_date: string | null;
  notes: string | null;
  custom_fields: Record<string, unknown> | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface PautaItem {
  id: string;
  pauta_id: string;
  title: string;
  status: string;
  assigned_to: string | null;
  custom_fields: Record<string, unknown> | null;
  position: number;
  created_at: string;
}

export interface PautaComment {
  id: string;
  pauta_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

export interface PautaActivity {
  id: string;
  pauta_id: string;
  user_id: string | null;
  action: string;
  from_value: string | null;
  to_value: string | null;
  created_at: string;
}

export function usePautaComments(itemId: string | null) {
  return useQuery({
    queryKey: ['pauta-comments', itemId],
    queryFn: async () => {
      if (!itemId) return [];
      const { data, error } = await supabase
        .from('pauta_comments' as any)
        .select('*')
        .eq('pauta_id', itemId)
        .order('created_at');
      if (error) throw error;
      return (data || []) as unknown as PautaComment[];
    },
    enabled: !!itemId,
  });
}

export function useAddPautaComment() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ pautaId, content }: { pautaId: string; content: string }) => {
      if (!user) throw new Error('Sem usuario');
      const { error } = await supabase.from('pauta_comments' as any).insert({
        pauta_id: pautaId,
        user_id: user.id,
        content,
      });
      if (error) throw error;
      try {
        const { data: p } = await supabase.from('pautas' as any)
          .select('title, created_by, assigned_to').eq('id', pautaId).single();
        if (p) {
          const targets = new Set<string>();
          if ((p as any).created_by !== user.id) targets.add((p as any).created_by);
          if ((p as any).assigned_to && (p as any).assigned_to !== user.id) targets.add((p as any).assigned_to);
          await Promise.all([...targets].map(id => notifyUser({
            userId: id,
            type: 'pauta_comment',
            title: `Novo comentário em "${(p as any).title}"`,
            message: content.slice(0, 80),
            link: '/demandas-marketing',
          })));
        }
      } catch (e) { console.warn('pauta comment notify failed', e); }
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['pauta-comments', vars.pautaId] }),
  });
}

export function usePautaActivity(itemId: string | null) {
  return useQuery({
    queryKey: ['pauta-activity', itemId],
    queryFn: async () => {
      if (!itemId) return [];
      const { data, error } = await supabase
        .from('pauta_activity' as any)
        .select('*')
        .eq('pauta_id', itemId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as PautaActivity[];
    },
    enabled: !!itemId,
  });
}

export function usePautas() {
  const { currentOrg } = useOrganization();
  return useQuery({
    queryKey: ['pautas', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return [];
      const { data, error } = await supabase
        .from('pautas' as any)
        .select('*')
        .eq('organization_id', currentOrg.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Pauta[];
    },
    enabled: !!currentOrg,
  });
}

export function usePautaItems(pautaId: string | null) {
  return useQuery({
    queryKey: ['pauta-items', pautaId],
    queryFn: async () => {
      if (!pautaId) return [];
      const { data, error } = await supabase
        .from('pauta_items' as any)
        .select('*')
        .eq('pauta_id', pautaId)
        .order('position', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as PautaItem[];
    },
    enabled: !!pautaId,
  });
}

export function useCreatePauta() {
  const { currentOrg } = useOrganization();
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      assigned_to?: string;
      priority?: PautaPriority;
      scheduled_date?: string;
      notes?: string;
    }) => {
      if (!currentOrg || !user) throw new Error('Sem organização');
      const { data, error } = await supabase.from('pautas' as any).insert({
        organization_id: currentOrg.id,
        created_by: user.id,
        title: input.title,
        assigned_to: input.assigned_to || null,
        priority: input.priority || 'medium',
        status: 'pendente',
        scheduled_date: input.scheduled_date || null,
        notes: input.notes || null,
      }).select().single();
      if (error) throw error;

      try {
        if (input.assigned_to && input.assigned_to !== user.id) {
          await notifyUser({
            userId: input.assigned_to,
            type: 'pauta_assigned',
            title: `Nova pauta atribuída: ${input.title}`,
            link: '/demandas-marketing',
          });
        }
      } catch (e) { console.warn('pauta notify failed', e); }

      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pautas'] }),
  });
}

export function useUpdatePauta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Pauta> & { id: string }) => {
      const { error } = await supabase.from('pautas' as any).update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pautas'] }),
  });
}

export function useDeletePauta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('pautas' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pautas'] }),
  });
}

export function useCreatePautaItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { pauta_id: string; title: string; position?: number }) => {
      const { data, error } = await supabase.from('pauta_items' as any).insert({
        pauta_id: input.pauta_id,
        title: input.title,
        status: 'pendente',
        position: input.position ?? 0,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['pauta-items', vars.pauta_id] }),
  });
}

export function useUpdatePautaItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, pauta_id, ...patch }: Partial<PautaItem> & { id: string; pauta_id: string }) => {
      const { error } = await supabase.from('pauta_items' as any).update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['pauta-items', vars.pauta_id] }),
  });
}

export function useDeletePautaItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, pauta_id }: { id: string; pauta_id: string }) => {
      const { error } = await supabase.from('pauta_items' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['pauta-items', vars.pauta_id] }),
  });
}
