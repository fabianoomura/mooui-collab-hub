import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type NotificationPermission = 'default' | 'granted' | 'denied';

export function useDesktopNotifications() {
  const supported = typeof window !== 'undefined' && 'Notification' in window;

  const [permission, setPermission] = useState<NotificationPermission>(
    supported ? (Notification.permission as NotificationPermission) : 'denied'
  );

  const requestPermission = useCallback(async () => {
    if (!supported) return;
    const result = await Notification.requestPermission();
    setPermission(result as NotificationPermission);
  }, [supported]);

  const showNotification = useCallback(
    (title: string, options?: { body?: string; icon?: string; onClick?: () => void }) => {
      if (!supported || Notification.permission !== 'granted') return;
      const n = new Notification(title, {
        body: options?.body,
        icon: options?.icon ?? '/favicon.ico',
      });
      if (options?.onClick) {
        n.onclick = () => {
          window.focus();
          options.onClick!();
          n.close();
        };
      }
    },
    [supported]
  );

  return { permission, requestPermission, showNotification, supported };
}

export function useNotificationListener() {
  const { user } = useAuth();
  const { showNotification } = useDesktopNotifications();

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`desktop-notif:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const record = payload.new as { title?: string; message?: string };
          if (record.title) {
            showNotification(record.title, { body: record.message });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, showNotification]);
}
