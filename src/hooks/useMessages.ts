import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface MessageAttachment {
  id: string;
  message_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
}

export interface MessageWithProfile {
  id: string;
  channel_id: string;
  user_id: string;
  content: string;
  parent_message_id: string | null;
  edited_at: string | null;
  created_at: string;
  profile: { id: string; full_name: string | null; avatar_url: string | null } | null;
  attachments: MessageAttachment[];
  reply_count?: number;
}

async function attachProfilesAndCounts(rows: any[], includeReplyCounts: boolean): Promise<MessageWithProfile[]> {
  const userIds = [...new Set(rows.map(m => m.user_id))];
  let profMap = new Map<string, any>();
  if (userIds.length) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', userIds);
    profMap = new Map((profiles || []).map(p => [p.id, p]));
  }

  let replyMap = new Map<string, number>();
  if (includeReplyCounts && rows.length) {
    const { data: replies } = await supabase
      .from('messages')
      .select('parent_message_id')
      .in('parent_message_id', rows.map(r => r.id));
    (replies || []).forEach((r: any) => {
      replyMap.set(r.parent_message_id, (replyMap.get(r.parent_message_id) || 0) + 1);
    });
  }

  return rows.map((m: any) => ({
    ...m,
    profile: profMap.get(m.user_id) || null,
    attachments: (m.message_attachments || []) as MessageAttachment[],
    reply_count: replyMap.get(m.id) || 0,
  }));
}

export function useMessages(channelId: string | undefined) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['messages', channelId],
    queryFn: async () => {
      if (!channelId) return [];
      const { data, error } = await supabase
        .from('messages')
        .select('*, message_attachments(*)')
        .eq('channel_id', channelId)
        .is('parent_message_id', null)
        .order('created_at', { ascending: true })
        .limit(200);
      if (error) throw error;
      return attachProfilesAndCounts(data || [], true);
    },
    enabled: !!channelId && !!user,
  });

  useEffect(() => {
    if (!channelId) return;
    const channel = supabase
      .channel(`messages:${channelId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `channel_id=eq.${channelId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['messages', channelId] });
          queryClient.invalidateQueries({ queryKey: ['thread-messages'] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId, queryClient]);

  return query;
}

export function useThreadMessages(parentId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['thread-messages', parentId],
    queryFn: async () => {
      if (!parentId) return [];
      const { data, error } = await supabase
        .from('messages')
        .select('*, message_attachments(*)')
        .eq('parent_message_id', parentId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return attachProfilesAndCounts(data || [], false);
    },
    enabled: !!parentId && !!user,
  });
}

export function useSendMessage() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({
      channelId,
      content,
      files,
      parentMessageId,
    }: {
      channelId: string;
      content: string;
      files?: File[];
      parentMessageId?: string;
    }) => {
      if (!user) throw new Error('Não autenticado');

      const { data: msg, error } = await supabase
        .from('messages')
        .insert({
          channel_id: channelId,
          user_id: user.id,
          content,
          parent_message_id: parentMessageId || null,
        })
        .select()
        .single();
      if (error) throw error;

      if (files && files.length > 0) {
        const uploads = await Promise.all(
          files.map(async (file) => {
            const path = `${user.id}/${msg.id}/${Date.now()}-${file.name}`;
            const { error: upErr } = await supabase.storage
              .from('chat-attachments')
              .upload(path, file, { upsert: false });
            if (upErr) throw upErr;
            const { data: urlData } = supabase.storage
              .from('chat-attachments')
              .getPublicUrl(path);
            return {
              message_id: msg.id,
              file_name: file.name,
              file_url: urlData.publicUrl,
              file_type: file.type || null,
              file_size: file.size,
            };
          })
        );
        const { error: attErr } = await supabase.from('message_attachments').insert(uploads);
        if (attErr) throw attErr;
      }
    },
  });
}

export function useDeleteMessage() {
  return useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await supabase.from('messages').delete().eq('id', messageId);
      if (error) throw error;
    },
  });
}
