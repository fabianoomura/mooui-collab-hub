import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type NotificationMetadata = {
  module?: string;
  entity_id?: string;
  entity_code?: string;
  [key: string]: unknown;
};

export type Notification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string | null;
  link: string | null;
  metadata: NotificationMetadata;
  is_read: boolean;
  created_at: string;
};

/** Build a deep link URL from notification metadata */
export function buildNotificationLink(n: Pick<Notification, 'link' | 'metadata'>): string | null {
  if (!n.link) return null;
  if (n.metadata?.entity_id) {
    const sep = n.link.includes('?') ? '&' : '?';
    return `${n.link}${sep}id=${n.metadata.entity_id}`;
  }
  return n.link;
}

export function useNotifications() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []).map((n: any) => ({
        ...n,
        metadata: n.metadata ?? {},
      })) as Notification[];
    },
    enabled: !!user,
    refetchInterval: 20000,
    refetchOnWindowFocus: true,
    staleTime: 15000,
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`notif:${user.id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          qc.invalidateQueries({ queryKey: ['notifications', user.id] });
          const n = payload.new as Notification;
          const deepLink = buildNotificationLink(n);
          toast(n.title, {
            description: n.message ?? undefined,
            action: deepLink
              ? { label: 'Abrir', onClick: () => { window.dispatchEvent(new CustomEvent('mooui:navigate', { detail: deepLink })); } }
              : undefined,
          });
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ['notifications', user.id] })
      )
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ['notifications', user.id] })
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  return query;
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function useMarkAllNotificationsRead() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function useDeleteNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('notifications').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export async function notifyUser(params: {
  userId: string;
  type: string;
  title: string;
  message?: string;
  link?: string;
  metadata?: NotificationMetadata;
}) {
  const { error } = await supabase.rpc('notify_user', {
    _user_id: params.userId,
    _type: params.type,
    _title: params.title,
    _message: params.message ?? null,
    _link: params.link ?? null,
    _metadata: params.metadata ? JSON.stringify(params.metadata) : '{}',
  });
  if (error) console.error('notify_user failed', error);
}
