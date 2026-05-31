import { useState } from 'react';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDesktopNotifications } from '@/hooks/useDesktopNotifications';

const DISMISSED_KEY = 'notifications_banner_dismissed';

export function NotificationPermissionBanner() {
  const { permission, requestPermission, supported } = useDesktopNotifications();
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISSED_KEY) === 'true'
  );

  if (!supported || permission !== 'default' || dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, 'true');
    setDismissed(true);
  };

  return (
    <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm">
      <Bell className="h-4 w-4 text-primary shrink-0" />
      <span className="flex-1 text-foreground/80">
        Ative notificações para não perder nada importante
      </span>
      <Button size="sm" variant="default" className="h-7 text-xs" onClick={requestPermission}>
        Ativar
      </Button>
      <button
        onClick={handleDismiss}
        className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
        aria-label="Fechar"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
