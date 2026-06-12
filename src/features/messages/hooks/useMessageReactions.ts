import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Reaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
}

export type ReactionGroup = {
  emoji: string;
  count: number;
  mine: boolean;
  users: string[];
};

export function groupReactions(rows: Reaction[], myId?: string): Map<string, ReactionGroup[]> {
  const byMsg = new Map<string, Map<string, ReactionGroup>>();
  for (const r of rows) {
    if (!byMsg.has(r.message_id)) byMsg.set(r.message_id, new Map());
    const map = byMsg.get(r.message_id)!;
    const g = map.get(r.emoji) || { emoji: r.emoji, count: 0, mine: false, users: [] };
    g.count += 1;
    g.users.push(r.user_id);
    if (r.user_id === myId) g.mine = true;
    map.set(r.emoji, g);
  }
  const out = new Map<string, ReactionGroup[]>();
  byMsg.forEach((m, k) => out.set(k, Array.from(m.values())));
  return out;
}

export function useChannelReactions(channelId: string | undefined, messageIds: string[]) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const key = ['message-reactions', channelId, messageIds.length];

  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      if (!messageIds.length) return new Map<string, ReactionGroup[]>();
      const { data, error } = await supabase
        .from('message_reactions')
        .select('id, message_id, user_id, emoji')
        .in('message_id', messageIds);
      if (error) throw error;
      return groupReactions((data || []) as Reaction[], user?.id);
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!channelId) return;
    const ch = supabase
      .channel(`reactions:${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, () => {
        qc.invalidateQueries({ queryKey: ['message-reactions'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [channelId, qc]);

  return query;
}

export function useToggleReaction() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ messageId, emoji, mine }: { messageId: string; emoji: string; mine: boolean }) => {
      if (!user) throw new Error('Não autenticado');
      if (mine) {
        const { error } = await supabase
          .from('message_reactions')
          .delete()
          .eq('message_id', messageId)
          .eq('user_id', user.id)
          .eq('emoji', emoji);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('message_reactions')
          .insert({ message_id: messageId, user_id: user.id, emoji });
        if (error) throw error;
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['message-reactions'] }),
  });
}

export function useUpdateMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ messageId, content }: { messageId: string; content: string }) => {
      const { error } = await supabase
        .from('messages')
        .update({ content, edited_at: new Date().toISOString() })
        .eq('id', messageId);
      if (error) throw error;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['messages'] });
      qc.invalidateQueries({ queryKey: ['thread-messages'] });
    },
  });
}
