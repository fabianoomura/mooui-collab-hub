import { useNavigate } from 'react-router-dom';
import {
  Bell, Check, Trash2, Package, Bug, Rocket, ClipboardCheck,
  ListTodo, MessageSquare, Calendar,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  useNotifications,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useDeleteNotification,
  buildNotificationLink,
  type Notification,
} from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';

/* ── icon / colour map keyed by type prefix ── */
const TYPE_STYLE: Record<string, { icon: typeof Bell; color: string }> = {
  order:     { icon: Package,        color: 'text-orange-500' },
  ticket:    { icon: Bug,            color: 'text-red-500' },
  launch:    { icon: Rocket,         color: 'text-purple-500' },
  checklist: { icon: ClipboardCheck, color: 'text-green-500' },
  task:      { icon: ListTodo,       color: 'text-blue-500' },
  message:   { icon: MessageSquare,  color: 'text-sky-500' },
  calendar:  { icon: Calendar,       color: 'text-amber-500' },
};

function typeStyle(type: string) {
  const prefix = type.split('_')[0];
  return TYPE_STYLE[prefix] ?? { icon: Bell, color: 'text-muted-foreground' };
}

export function NotificationsBell() {
  const navigate = useNavigate();
  const { data: notifications = [] } = useNotifications();
  const markAll = useMarkAllNotificationsRead();
  const markOne = useMarkNotificationRead();
  const deleteOne = useDeleteNotification();

  const unread = notifications.filter(n => !n.is_read).length;

  const handleClick = (n: Notification) => {
    if (!n.is_read) markOne.mutate(n.id);
    const link = buildNotificationLink(n);
    if (link) navigate(link);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notificações" className="relative">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute top-1.5 right-1.5 h-4 min-w-4 px-1 rounded-full bg-primary text-[10px] text-primary-foreground font-semibold flex items-center justify-center">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-96 p-0">
        {/* header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="text-sm font-semibold">Notificações</span>
          {unread > 0 && (
            <button
              onClick={() => markAll.mutate()}
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              <Check className="h-3 w-3" /> Marcar todas
            </button>
          )}
        </div>

        {/* list */}
        <ScrollArea className="max-h-[28rem]">
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sem notificações</p>
          ) : (
            <ul className="divide-y divide-border">
              {notifications.map(n => {
                const { icon: Icon, color } = typeStyle(n.type);
                return (
                  <li key={n.id} className="group">
                    <div
                      className={cn(
                        'flex items-start gap-2.5 px-3 py-2.5 hover:bg-accent/50 transition-colors',
                        !n.is_read && 'bg-primary/5',
                      )}
                    >
                      {/* clickable area */}
                      <button
                        onClick={() => handleClick(n)}
                        className="flex items-start gap-2.5 flex-1 min-w-0 text-left"
                      >
                        <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', color)} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            {!n.is_read && (
                              <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                            )}
                            <p className="text-sm font-medium truncate">{n.title}</p>
                          </div>
                          {n.message && (
                            <p className="text-xs text-muted-foreground line-clamp-2">{n.message}</p>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                          </p>
                        </div>
                      </button>

                      {/* delete */}
                      <button
                        onClick={() => deleteOne.mutate(n.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/10 rounded"
                        aria-label="Excluir notificação"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
