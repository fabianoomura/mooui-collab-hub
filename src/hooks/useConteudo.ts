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

export type ConteudoChecklistStatus = 'pendente' | 'em_andamento' | 'concluido';

export type ConteudoChecklistPriority = 'low' | 'medium' | 'high' | 'critical';

export interface ConteudoChecklistItem {
  id: string;
  conteudo_item_id: string;
  title: string;
  status: ConteudoChecklistStatus;
  priority: ConteudoChecklistPriority;
  assigned_to: string | null;
  due_date: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface ConteudoAttachment {
  id: string;
  conteudo_item_id: string;
  user_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
  signed_url?: string;
  profile?: { full_name: string | null } | null;
}

const CONTEUDO_ATTACHMENTS_BUCKET = 'conteudo-attachments';

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

export interface ConteudoComment {
  id: string;
  conteudo_item_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

export function useConteudoComments(itemId: string | null) {
  return useQuery({
    queryKey: ['conteudo-comments', itemId],
    queryFn: async () => {
      if (!itemId) return [];
      const { data, error } = await supabase
        .from('conteudo_comments' as any)
        .select('*')
        .eq('conteudo_item_id', itemId)
        .order('created_at');
      if (error) throw error;
      return (data || []) as unknown as ConteudoComment[];
    },
    enabled: !!itemId,
  });
}

export function useAddConteudoComment() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ conteudoItemId, content }: { conteudoItemId: string; content: string }) => {
      if (!user) throw new Error('Sem usuario');
      const { error } = await supabase.from('conteudo_comments' as any).insert({
        conteudo_item_id: conteudoItemId,
        user_id: user.id,
        content,
      });
      if (error) throw error;
      try {
        const { data: c } = await supabase.from('conteudo_items' as any)
          .select('title, created_by, assigned_to').eq('id', conteudoItemId).single();
        if (c) {
          const targets = new Set<string>();
          if ((c as any).created_by !== user.id) targets.add((c as any).created_by);
          if ((c as any).assigned_to && (c as any).assigned_to !== user.id) targets.add((c as any).assigned_to);
          await Promise.all([...targets].map(id => notifyUser({
            userId: id,
            type: 'conteudo_comment',
            title: `Novo comentario em "${(c as any).title}"`,
            message: content.slice(0, 80),
            link: '/conteudo',
          })));
        }
      } catch (e) { console.warn('conteudo comment notify failed', e); }
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['conteudo-comments', vars.conteudoItemId] }),
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

export function useConteudoChecklist(itemId: string | null) {
  return useQuery({
    queryKey: ['conteudo-checklist', itemId],
    queryFn: async () => {
      if (!itemId) return [];
      const { data, error } = await supabase
        .from('conteudo_checklist_items' as any)
        .select('*')
        .eq('conteudo_item_id', itemId)
        .order('position', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as ConteudoChecklistItem[];
    },
    enabled: !!itemId,
  });
}

export function useCreateConteudoChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      conteudo_item_id: string;
      title: string;
      assigned_to?: string | null;
      due_date?: string | null;
      position?: number;
    }) => {
      const { error } = await supabase.from('conteudo_checklist_items' as any).insert({
        conteudo_item_id: input.conteudo_item_id,
        title: input.title,
        assigned_to: input.assigned_to || null,
        due_date: input.due_date || null,
        position: input.position || 0,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['conteudo-checklist', vars.conteudo_item_id] }),
  });
}

export function useUpdateConteudoChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, conteudo_item_id, ...patch }: Partial<ConteudoChecklistItem> & { id: string; conteudo_item_id: string }) => {
      const { error } = await supabase.from('conteudo_checklist_items' as any).update(patch).eq('id', id);
      if (error) throw error;
      return { conteudo_item_id };
    },
    onSuccess: (result) => qc.invalidateQueries({ queryKey: ['conteudo-checklist', result.conteudo_item_id] }),
  });
}

export function useDeleteConteudoChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, conteudo_item_id }: { id: string; conteudo_item_id: string }) => {
      const { error } = await supabase.from('conteudo_checklist_items' as any).delete().eq('id', id);
      if (error) throw error;
      return { conteudo_item_id };
    },
    onSuccess: (result) => qc.invalidateQueries({ queryKey: ['conteudo-checklist', result.conteudo_item_id] }),
  });
}

export function useConteudoAttachments(itemId: string | null) {
  const qc = useQueryClient();
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['conteudo-attachments', itemId],
    queryFn: async () => {
      if (!itemId) return [] as ConteudoAttachment[];
      const { data, error } = await supabase
        .from('conteudo_attachments' as any)
        .select('*')
        .eq('conteudo_item_id', itemId)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const rows = (data || []) as unknown as ConteudoAttachment[];
      const userIds = [...new Set(rows.map((row) => row.user_id))];
      const { data: profs } = userIds.length
        ? await supabase.from('profiles').select('id, full_name').in('id', userIds)
        : { data: [] as any[] };
      const profileMap = new Map((profs || []).map((profile: any) => [profile.id, profile]));

      return Promise.all(rows.map(async (row) => {
        const { data: signed } = await supabase.storage.from(CONTEUDO_ATTACHMENTS_BUCKET).createSignedUrl(row.file_url, 3600);
        return { ...row, signed_url: signed?.signedUrl, profile: profileMap.get(row.user_id) || null };
      }));
    },
    enabled: !!itemId,
  });

  const uploadFile = useMutation({
    mutationFn: async ({ conteudoItemId, file }: { conteudoItemId: string; file: File }) => {
      if (!user) throw new Error('Sem usuario');
      const ext = file.name.split('.').pop() || 'bin';
      const path = `${conteudoItemId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from(CONTEUDO_ATTACHMENTS_BUCKET).upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from('conteudo_attachments' as any).insert({
        conteudo_item_id: conteudoItemId,
        user_id: user.id,
        file_url: path,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type || null,
      });
      if (insertError) throw insertError;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conteudo-attachments', itemId] }),
  });

  const deleteAttachment = useMutation({
    mutationFn: async (id: string) => {
      const attachment = query.data?.find((item) => item.id === id);
      if (attachment) await supabase.storage.from(CONTEUDO_ATTACHMENTS_BUCKET).remove([attachment.file_url]);
      const { error } = await supabase.from('conteudo_attachments' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conteudo-attachments', itemId] }),
  });

  return {
    attachments: query.data || [],
    isLoading: query.isLoading,
    uploadFile,
    deleteAttachment,
  };
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
