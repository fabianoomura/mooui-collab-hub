import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Channel {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  is_private: boolean;
  is_dm: boolean;
  created_by: string;
  created_at: string;
}

export interface DmChannel extends Channel {
  partner: { id: string; full_name: string | null; avatar_url: string | null } | null;
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
        .eq('is_dm', false)
        .order('name');
      if (error) throw error;
      return (data || []) as Channel[];
    },
    enabled: !!user && !!orgId,
  });
}

export function useDmChannels(orgId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['dm-channels', orgId, user?.id],
    queryFn: async () => {
      if (!orgId || !user) return [];
      // Get DM channels where I'm a member
      const { data: myMemberships, error: memErr } = await supabase
        .from('channel_members')
        .select('channel_id')
        .eq('user_id', user.id);
      if (memErr) throw memErr;
      const channelIds = (myMemberships || []).map(m => m.channel_id);
      if (channelIds.length === 0) return [];

      const { data: dms, error: dmErr } = await supabase
        .from('channels')
        .select('*')
        .eq('organization_id', orgId)
        .eq('is_dm', true)
        .in('id', channelIds);
      if (dmErr) throw dmErr;
      if (!dms || dms.length === 0) return [];

      // Find the OTHER member in each DM
      const { data: allMembers, error: allErr } = await supabase
        .from('channel_members')
        .select('channel_id, user_id')
        .in('channel_id', dms.map(d => d.id));
      if (allErr) throw allErr;

      const partnerIds = new Set<string>();
      const partnerByChannel = new Map<string, string>();
      (allMembers || []).forEach(m => {
        if (m.user_id !== user.id) {
          partnerByChannel.set(m.channel_id, m.user_id);
          partnerIds.add(m.user_id);
        }
      });

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', [...partnerIds]);
      const profMap = new Map((profiles || []).map(p => [p.id, p]));

      return dms.map(d => ({
        ...d,
        partner: profMap.get(partnerByChannel.get(d.id) || '') || null,
      })) as DmChannel[];
    },
    enabled: !!user && !!orgId,
  });
}

export function useOrgMembers(orgId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['org-members-profiles', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data: members, error } = await supabase
        .from('organization_members')
        .select('user_id')
        .eq('organization_id', orgId);
      if (error) throw error;
      const ids = (members || []).map(m => m.user_id).filter(id => id !== user?.id);
      if (ids.length === 0) return [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', ids);
      return (profiles || []) as Array<{ id: string; full_name: string | null; avatar_url: string | null }>;
    },
    enabled: !!user && !!orgId,
  });
}

// Todos os colegas alcançáveis (qualquer org que eu participo), com label da org
export function useReachableMembers() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['reachable-members', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data: mine } = await supabase
        .from('organization_members').select('organization_id').eq('user_id', user.id);
      const orgIds = (mine || []).map((m: any) => m.organization_id);
      if (orgIds.length === 0) return [];
      const { data: peers } = await supabase
        .from('organization_members').select('user_id, organization_id').in('organization_id', orgIds);
      const { data: orgs } = await supabase
        .from('organizations').select('id, name').in('id', orgIds);
      const orgName = new Map((orgs || []).map((o: any) => [o.id, o.name]));
      const byUser = new Map<string, Set<string>>();
      (peers || []).forEach((p: any) => {
        if (p.user_id === user.id) return;
        if (!byUser.has(p.user_id)) byUser.set(p.user_id, new Set());
        byUser.get(p.user_id)!.add(orgName.get(p.organization_id) || '');
      });
      const ids = [...byUser.keys()];
      if (ids.length === 0) return [];
      const { data: profiles } = await supabase
        .from('profiles').select('id, full_name, avatar_url').in('id', ids);
      return (profiles || []).map((p: any) => ({
        ...p,
        orgs: [...(byUser.get(p.id) || [])].filter(Boolean),
      })) as Array<{ id: string; full_name: string | null; avatar_url: string | null; orgs: string[] }>;
    },
    enabled: !!user,
  });
}

export function useOpenDm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ otherUserId, orgId }: { otherUserId: string; orgId: string }) => {
      const { data, error } = await supabase.rpc('get_or_create_dm', {
        _other_user_id: otherUserId,
        _org_id: orgId,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ['dm-channels', vars.orgId] });
    },
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
      queryClient.invalidateQueries({ queryKey: ['dm-channels'] });
    },
  });
}

export function useChannelMembersList(channelId: string | null) {
  return useQuery({
    queryKey: ['channel-members', channelId],
    enabled: !!channelId,
    queryFn: async () => {
      if (!channelId) return [];
      const { data: rows, error } = await supabase
        .from('channel_members')
        .select('user_id')
        .eq('channel_id', channelId);
      if (error) throw error;
      const ids = (rows || []).map(r => r.user_id);
      if (ids.length === 0) return [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', ids);
      return (profiles || []) as Array<{ id: string; full_name: string | null; avatar_url: string | null }>;
    },
  });
}

export function useAddChannelMembers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ channelId, userIds }: { channelId: string; userIds: string[] }) => {
      if (userIds.length === 0) return;
      const rows = userIds.map(uid => ({ channel_id: channelId, user_id: uid }));
      const { error } = await supabase.from('channel_members').insert(rows);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['channel-members', vars.channelId] });
      qc.invalidateQueries({ queryKey: ['channels'] });
    },
  });
}

export function useRemoveChannelMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ channelId, userId }: { channelId: string; userId: string }) => {
      const { error } = await supabase
        .from('channel_members')
        .delete()
        .eq('channel_id', channelId)
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['channel-members', vars.channelId] });
    },
  });
}

export function useMarkChannelRead() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (channelId: string) => {
      if (!user) return;
      await supabase
        .from('channel_members')
        .update({ last_read_at: new Date().toISOString() })
        .eq('channel_id', channelId)
        .eq('user_id', user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unread-counts'] });
    },
  });
}

export function useUnreadCounts(channelIds: string[]) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['unread-counts', user?.id, channelIds.sort().join(',')],
    queryFn: async () => {
      if (!user || channelIds.length === 0) return {} as Record<string, number>;
      const result: Record<string, number> = {};
      await Promise.all(
        channelIds.map(async (cid) => {
          const { data } = await supabase.rpc('unread_count', {
            _channel_id: cid,
            _user_id: user.id,
          });
          result[cid] = (data as number) || 0;
        })
      );
      return result;
    },
    enabled: !!user && channelIds.length > 0,
    refetchInterval: 15000,
  });
}
