import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Channel {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  is_private: boolean;
  created_by: string;
  created_at: string;
}

export function useChannels(orgId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['channels', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('channels')
        .select('*')
        .eq('organization_id', orgId)
        .order('name');
      if (error) throw error;
      return (data || []) as Channel[];
    },
    enabled: !!user && !!orgId,
  });
}

export function useCreateChannel() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ name, description, isPrivate, organizationId }: {
      name: string;
      description?: string;
      isPrivate?: boolean;
      organizationId: string;
    }) => {
      if (!user) throw new Error('Não autenticado');
      const slug = name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const { data: channel, error } = await supabase
        .from('channels')
        .insert({
          name: slug,
          description: description || null,
          is_private: !!isPrivate,
          organization_id: organizationId,
          created_by: user.id,
        })
        .select()
        .single();
      if (error) throw error;

      // Auto-join creator
      await supabase.from('channel_members').insert({
        channel_id: channel.id,
        user_id: user.id,
      });

      return channel as Channel;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ['channels', vars.organizationId] });
    },
  });
}

export function useDeleteChannel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (channelId: string) => {
      const { error } = await supabase.from('channels').delete().eq('id', channelId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
    },
  });
}

export function useJoinChannel() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (channelId: string) => {
      if (!user) throw new Error('Não autenticado');
      const { error } = await supabase.from('channel_members').insert({
        channel_id: channelId,
        user_id: user.id,
      });
      if (error && error.code !== '23505') throw error; // ignore duplicate
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channel-members'] });
    },
  });
}
