import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { notifyUser } from '@/hooks/useNotifications';

export type ConteudoChannel = 'mooui_kids' | 'mooui_home' | 'amo_mooui' | 'barcelona' | 'outras_redes' | 'pinterest';
export type ConteudoStatus = 'nao_iniciado' | 'em_andamento' | 'em_revisao' | 'aprovado' | 'publicado';
export type ConteudoType = 'foto' | 'video' | 'carrossel' | 'reels' | 'stories';

export interface ConteudoItem {
  id: string;
  organization_id: string;
  code: string | null;
  title: string;
  channel: ConteudoChannel;
  scheduled_date: string | null;
  time_slot: string | null;
  status: ConteudoStatus;
  content_type: ConteudoType;
  is_repost: boolean;
  content_category: string | null;
  photo_url: string | null;
  notes: string | null;
  assigned_to: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ConteudoActivity {
  id: string;
  conteudo_item_id: string;
  user_id: string | null;
  action: string;
  from_value: string | null;
  to_value: string | null;
  created_at: string;
}

export function useConteudoItems() {
  const { currentOrg } = useOrganization();
  return useQuery({
    queryKey: ['conteudo-items', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return [];
      const { data, error } = await supabase
        .from('conteudo_items' as any)
        .select('*')
        .eq('organization_id', currentOrg.id)
        .order('scheduled_date', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data || []) as unknown as ConteudoItem[];
    },
    enabled: !!currentOrg,
  });
}

export function useConteudoActivity(itemId: string | null) {
  return useQuery({
    queryKey: ['conteudo-activity', itemId],
    queryFn: async () => {
      if (!itemId) return [];
      const { data, error } = await supabase
        .from('conteudo_activity' as any)
        .select('*')
        .eq('conteudo_item_id', itemId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as ConteudoActivity[];
    },
    enabled: !!itemId,
  });
}

export function useCreateConteudo() {
  const { currentOrg } = useOrganization();
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      channel: ConteudoChannel;
      scheduled_date?: string;
      time_slot?: string;
      content_type?: ConteudoType;
      is_repost?: boolean;
      content_category?: string;
      notes?: string;
      assigned_to?: string;
    }) => {
      if (!currentOrg || !user) throw new Error('Sem organização');
      const { data, error } = await supabase.from('conteudo_items' as any).insert({
        organization_id: currentOrg.id,
        created_by: user.id,
        title: input.title,
        channel: input.channel,
        scheduled_date: input.scheduled_date || null,
        time_slot: input.time_slot || null,
        status: 'nao_iniciado',
        content_type: input.content_type || 'foto',
        is_repost: input.is_repost || false,
        content_category: input.content_category || null,
        notes: input.notes || null,
        assigned_to: input.assigned_to || null,
      }).select().single();
      if (error) throw error;

      try {
        if (input.assigned_to && input.assigned_to !== user.id) {
          await notifyUser({
            userId: input.assigned_to,
            type: 'conteudo_assigned',
            title: `Novo conteúdo atribuído: ${input.title}`,
            message: `Canal: ${input.channel}`,
            link: '/conteudo',
          });
        }
      } catch (e) { console.warn('conteudo notify failed', e); }

      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conteudo-items'] }),
  });
}

export function useUpdateConteudo() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<ConteudoItem> & { id: string }) => {
      const { data: before } = await supabase.from('conteudo_items' as any)
        .select('title, created_by, assigned_to, status').eq('id', id).single();
      const { error } = await supabase.from('conteudo_items' as any).update(patch).eq('id', id);
      if (error) throw error;

      try {
        if (patch.assigned_to && before && patch.assigned_to !== (before as any).assigned_to && patch.assigned_to !== user?.id) {
          await notifyUser({
            userId: patch.assigned_to,
            type: 'conteudo_assigned',
            title: `Conteúdo atribuído a você: ${(before as any).title}`,
            link: '/conteudo',
          });
        }
        if (patch.status && before && patch.status !== (before as any).status && (before as any).created_by !== user?.id) {
          await notifyUser({
            userId: (before as any).created_by,
            type: 'conteudo_status',
            title: `Conteúdo mudou para "${patch.status}"`,
            message: (before as any).title,
            link: '/conteudo',
          });
        }
      } catch (e) { console.warn('conteudo update notify failed', e); }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['conteudo-items'] });
      qc.invalidateQueries({ queryKey: ['conteudo-activity', vars.id] });
    },
  });
}

export function useDeleteConteudo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('conteudo_items' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conteudo-items'] }),
  });
}
