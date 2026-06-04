import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { notifyUser } from '@/hooks/useNotifications';
import { autoPostToChannel } from '@/hooks/useAutoPost';

export type SessaoStatus = 'planejada' | 'em_producao' | 'em_edicao' | 'entregue' | 'cancelada';
export type SessaoShotTipo = 'foto' | 'video';
export type SessaoShotStatus = 'nao_iniciado' | 'em_andamento' | 'feito' | 'cancelado';

export interface Sessao {
  id: string;
  organization_id: string;
  code: string | null;
  title: string;
  scheduled_date: string | null;
  professional: string | null;
  status: SessaoStatus;
  responsaveis: string[] | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface SessaoShot {
  id: string;
  sessao_id: string;
  title: string;
  tipo: SessaoShotTipo;
  status: SessaoShotStatus;
  local: string | null;
  funil: string | null;
  content_type: string | null;
  modelo: string | null;
  data_entrega: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface SessaoActivity {
  id: string;
  sessao_id: string;
  user_id: string | null;
  action: string;
  from_value: string | null;
  to_value: string | null;
  created_at: string;
}

export interface SessaoComment {
  id: string;
  sessao_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

export function useSessaoComments(sessaoId: string | null) {
  return useQuery({
    queryKey: ['sessao-comments', sessaoId],
    queryFn: async () => {
      if (!sessaoId) return [];
      const { data, error } = await supabase
        .from('sessao_comments' as any)
        .select('*')
        .eq('sessao_id', sessaoId)
        .order('created_at');
      if (error) throw error;
      return (data || []) as unknown as SessaoComment[];
    },
    enabled: !!sessaoId,
  });
}

export function useAddSessaoComment() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessaoId, content }: { sessaoId: string; content: string }) => {
      if (!user) throw new Error('Sem usuario');
      const { error } = await supabase.from('sessao_comments' as any).insert({
        sessao_id: sessaoId,
        user_id: user.id,
        content,
      });
      if (error) throw error;
      try {
        const { data: s } = await supabase.from('sessoes' as any)
          .select('title, created_by, responsaveis').eq('id', sessaoId).single();
        if (s) {
          const targets = new Set<string>();
          if ((s as any).created_by !== user.id) targets.add((s as any).created_by);
          for (const uid of (s as any).responsaveis || []) {
            if (uid !== user.id) targets.add(uid);
          }
          await Promise.all([...targets].map(id => notifyUser({
            userId: id,
            type: 'sessao_comment',
            title: `Novo comentario em "${(s as any).title}"`,
            message: content.slice(0, 80),
            link: '/sessoes',
          })));
        }
      } catch (e) { console.warn('sessao comment notify failed', e); }
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['sessao-comments', vars.sessaoId] }),
  });
}

export function useSessoes() {
  const { currentOrg } = useOrganization();
  return useQuery({
    queryKey: ['sessoes', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return [];
      const { data, error } = await supabase
        .from('sessoes' as any)
        .select('*')
        .eq('organization_id', currentOrg.id)
        .order('scheduled_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Sessao[];
    },
    enabled: !!currentOrg,
  });
}

export function useSessaoShots(sessaoId: string | null) {
  return useQuery({
    queryKey: ['sessao-shots', sessaoId],
    queryFn: async () => {
      if (!sessaoId) return [];
      const { data, error } = await supabase
        .from('sessao_shots' as any)
        .select('*')
        .eq('sessao_id', sessaoId)
        .order('position', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as SessaoShot[];
    },
    enabled: !!sessaoId,
  });
}

export function useSessaoActivity(sessaoId: string | null) {
  return useQuery({
    queryKey: ['sessao-activity', sessaoId],
    queryFn: async () => {
      if (!sessaoId) return [];
      const { data, error } = await supabase
        .from('sessao_activity' as any)
        .select('*')
        .eq('sessao_id', sessaoId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as SessaoActivity[];
    },
    enabled: !!sessaoId,
  });
}

export function useCreateSessao() {
  const { currentOrg } = useOrganization();
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      scheduled_date?: string;
      professional?: string;
      responsaveis?: string[];
      notes?: string;
    }) => {
      if (!currentOrg || !user) throw new Error('Sem organizacao');
      const { data, error } = await supabase.from('sessoes' as any).insert({
        organization_id: currentOrg.id,
        created_by: user.id,
        title: input.title,
        scheduled_date: input.scheduled_date || null,
        professional: input.professional || null,
        status: 'planejada',
        responsaveis: input.responsaveis || [],
        notes: input.notes || null,
      }).select().single();
      if (error) throw error;

      try {
        for (const userId of input.responsaveis || []) {
          if (userId !== user.id) {
            await notifyUser({
              userId,
              type: 'sessao_assigned',
              title: `Nova sessao atribuida: ${input.title}`,
              link: '/sessoes',
            });
          }
        }
      } catch (e) { console.warn('sessao notify failed', e); }

      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessoes'] }),
  });
}

export function useUpdateSessao() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Sessao> & { id: string }) => {
      const { data: before } = await supabase.from('sessoes' as any)
        .select('title, created_by, responsaveis, status')
        .eq('id', id)
        .single();
      const { error } = await supabase.from('sessoes' as any).update(patch).eq('id', id);
      if (error) throw error;

      try {
        const previous = new Set(((before as any)?.responsaveis || []) as string[]);
        for (const userId of patch.responsaveis || []) {
          if (!previous.has(userId) && userId !== user?.id) {
            await notifyUser({
              userId,
              type: 'sessao_assigned',
              title: `Sessao atribuida a voce: ${(before as any)?.title || 'Sessao'}`,
              link: '/sessoes',
            });
          }
        }
        if (patch.status && before && patch.status !== (before as any).status && (before as any).created_by !== user?.id) {
          await notifyUser({
            userId: (before as any).created_by,
            type: 'sessao_status',
            title: `Sessao mudou para "${patch.status}"`,
            message: (before as any).title,
            link: '/sessoes',
          });
        }
        if (patch.status === 'entregue' && currentOrg && user) {
          autoPostToChannel({
            orgId: currentOrg.id,
            channelName: 'producao',
            userId: user.id,
            content: `📸 Sessão entregue: "${(before as any)?.title}"`,
          });
        }
      } catch (e) { console.warn('sessao update notify failed', e); }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['sessoes'] });
      qc.invalidateQueries({ queryKey: ['sessao-activity', vars.id] });
    },
  });
}

export function useDeleteSessao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('sessoes' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessoes'] }),
  });
}

export function useCreateSessaoShot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      sessao_id: string;
      title: string;
      tipo?: SessaoShotTipo;
      local?: string;
      funil?: string;
      content_type?: string;
      modelo?: string;
      data_entrega?: string;
      position?: number;
    }) => {
      const { data, error } = await supabase.from('sessao_shots' as any).insert({
        sessao_id: input.sessao_id,
        title: input.title,
        tipo: input.tipo || 'foto',
        status: 'nao_iniciado',
        local: input.local || null,
        funil: input.funil || null,
        content_type: input.content_type || null,
        modelo: input.modelo || null,
        data_entrega: input.data_entrega || null,
        position: input.position ?? 0,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['sessao-shots', vars.sessao_id] }),
  });
}

export function useUpdateSessaoShot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, sessao_id, ...patch }: Partial<SessaoShot> & { id: string; sessao_id: string }) => {
      const { error } = await supabase.from('sessao_shots' as any).update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['sessao-shots', vars.sessao_id] }),
  });
}

export function useDeleteSessaoShot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, sessao_id }: { id: string; sessao_id: string }) => {
      const { error } = await supabase.from('sessao_shots' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['sessao-shots', vars.sessao_id] }),
  });
}
