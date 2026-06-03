import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { notifyUser } from '@/hooks/useNotifications';
import { autoPostToChannel } from '@/hooks/useAutoPost';

export type MelhoriaStatus = 'open' | 'in_progress' | 'done' | 'rejected';
export type MelhoriaPriority = 'low' | 'medium' | 'high' | 'critical';
export type MelhoriaArea = 'site_melhorias' | 'shopify' | 'seo_onpage' | 'seo_tecnico';

export interface Melhoria {
  id: string;
  organization_id: string;
  code: string | null;
  title: string;
  description: string | null;
  area: MelhoriaArea;
  status: MelhoriaStatus;
  priority: MelhoriaPriority;
  assigned_to: string | null;
  data_abertura: string;
  data_conclusao: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface MelhoriaComment {
  id: string;
  melhoria_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

export interface MelhoriaActivity {
  id: string;
  melhoria_id: string;
  user_id: string | null;
  action: string;
  from_value: string | null;
  to_value: string | null;
  created_at: string;
}

export function useMelhorias() {
  const { currentOrg } = useOrganization();
  return useQuery({
    queryKey: ['melhorias', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return [];
      const { data, error } = await supabase
        .from('melhorias' as any)
        .select('*')
        .eq('organization_id', currentOrg.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Melhoria[];
    },
    enabled: !!currentOrg,
  });
}

export function useMelhoriaComments(melhoriaId: string | null) {
  return useQuery({
    queryKey: ['melhoria-comments', melhoriaId],
    queryFn: async () => {
      if (!melhoriaId) return [];
      const { data, error } = await supabase
        .from('melhoria_comments' as any)
        .select('*')
        .eq('melhoria_id', melhoriaId)
        .order('created_at');
      if (error) throw error;
      return (data || []) as unknown as MelhoriaComment[];
    },
    enabled: !!melhoriaId,
  });
}

export function useMelhoriaActivity(melhoriaId: string | null) {
  return useQuery({
    queryKey: ['melhoria-activity', melhoriaId],
    queryFn: async () => {
      if (!melhoriaId) return [];
      const { data, error } = await supabase
        .from('melhoria_activity' as any)
        .select('*')
        .eq('melhoria_id', melhoriaId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as MelhoriaActivity[];
    },
    enabled: !!melhoriaId,
  });
}

export function useCreateMelhoria() {
  const { currentOrg } = useOrganization();
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      description?: string;
      area: MelhoriaArea;
      priority: MelhoriaPriority;
      assigned_to?: string;
    }) => {
      if (!currentOrg || !user) throw new Error('Sem organização');
      const { data, error } = await supabase.from('melhorias' as any).insert({
        organization_id: currentOrg.id,
        created_by: user.id,
        title: input.title,
        description: input.description || null,
        area: input.area,
        priority: input.priority,
        status: 'open',
        assigned_to: input.assigned_to || null,
      }).select().single();
      if (error) throw error;

      // Notifica responsavel
      try {
        if (input.assigned_to && input.assigned_to !== user.id) {
          await notifyUser({
            userId: input.assigned_to,
            type: 'melhoria_assigned',
            title: `Nova melhoria atribuída: ${input.title}`,
            message: `Área: ${input.area} • Prioridade: ${input.priority}`,
            link: '/melhorias',
          });
        }
      } catch (e) { console.warn('melhoria notify failed', e); }

      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['melhorias'] }),
  });
}

export function useUpdateMelhoria() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Melhoria> & { id: string }) => {
      const update: any = { ...patch };
      if (patch.status === 'done' && !patch.data_conclusao) {
        update.data_conclusao = new Date().toISOString().split('T')[0];
      }
      const { data: before } = await supabase.from('melhorias' as any)
        .select('title, created_by, assigned_to, status').eq('id', id).single();
      const { error } = await supabase.from('melhorias' as any).update(update).eq('id', id);
      if (error) throw error;

      try {
        // Notifica novo responsavel
        if (patch.assigned_to && before && patch.assigned_to !== (before as any).assigned_to && patch.assigned_to !== user?.id) {
          await notifyUser({
            userId: patch.assigned_to,
            type: 'melhoria_assigned',
            title: `Melhoria atribuída a você: ${(before as any).title}`,
            link: '/melhorias',
          });
        }
        // Notifica autor sobre mudanca de status
        if (patch.status && before && patch.status !== (before as any).status && (before as any).created_by !== user?.id) {
          await notifyUser({
            userId: (before as any).created_by,
            type: 'melhoria_status',
            title: `Sua melhoria mudou para "${patch.status}"`,
            message: (before as any).title,
            link: '/melhorias',
          });
        }
        // Auto-post ao canal #site quando concluida
        if (patch.status === 'done' && currentOrg && user) {
          autoPostToChannel({
            orgId: currentOrg.id,
            channelName: 'site',
            userId: user.id,
            content: `✅ Melhoria concluída: ${(before as any).title}`,
          });
        }
      } catch (e) { console.warn('melhoria update notify failed', e); }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['melhorias'] });
      qc.invalidateQueries({ queryKey: ['melhoria-activity', vars.id] });
    },
  });
}

export function useDeleteMelhoria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('melhorias' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['melhorias'] }),
  });
}

export function useAddMelhoriaComment() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ melhoriaId, content }: { melhoriaId: string; content: string }) => {
      if (!user) throw new Error('Sem usuário');
      const { error } = await supabase.from('melhoria_comments' as any).insert({
        melhoria_id: melhoriaId,
        user_id: user.id,
        content,
      });
      if (error) throw error;
      try {
        const { data: m } = await supabase.from('melhorias' as any)
          .select('title, created_by, assigned_to').eq('id', melhoriaId).single();
        if (m) {
          const targets = new Set<string>();
          if ((m as any).created_by !== user.id) targets.add((m as any).created_by);
          if ((m as any).assigned_to && (m as any).assigned_to !== user.id) targets.add((m as any).assigned_to);
          await Promise.all([...targets].map(id => notifyUser({
            userId: id,
            type: 'melhoria_comment',
            title: `Novo comentário em "${(m as any).title}"`,
            message: content.slice(0, 80),
            link: '/melhorias',
          })));
        }
      } catch (e) { console.warn('comment notify failed', e); }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['melhoria-comments', vars.melhoriaId] });
    },
  });
}
