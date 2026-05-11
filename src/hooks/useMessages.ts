import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface MessageWithProfile {
  id: string;
  channel_id: string;
  user_id: string;
  content: string;
  parent_message_id: string | null;
  edited_at: string | null;
  created_at: string;
  profile: { id: string; full_name: string | null; avatar_url: string | null } | null;
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
        .select('*')
        .eq('channel_id', channelId)
        .is('parent_message_id', null)
        .order('created_at', { ascending: true })
        .limit(200);
      if (error) throw error;

      const userIds = [...new Set((data || []).map(m => m.user_id))];
      if (userIds.length === 0) return [];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds);
      const map = new Map((profiles || []).map(p => [p.id, p]));

      return (data || []).map(m => ({
        ...m,
        profile: map.get(m.user_id) || null,
      })) as MessageWithProfile[];
    },
    enabled: !!channelId && !!user,
  });

  // Realtime subscription
  useEffect(() => {
    if (!channelId) return;
    const channel = supabase
      .channel(`messages:${channelId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `channel_id=eq.${channelId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['messages', channelId] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId, queryClient]);

  return query;
}

export function useSendMessage() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ channelId, content }: { channelId: string; content: string }) => {
      if (!user) throw new Error('Não autenticado');
      const { error } = await supabase.from('messages').insert({
        channel_id: channelId,
        user_id: user.id,
        content,
      });
      if (error) throw error;
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
