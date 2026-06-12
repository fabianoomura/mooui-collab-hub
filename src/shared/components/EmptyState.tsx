import { type ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: ReactNode;
  title?: string;
  description?: string;
  /** Optional action button */
  action?: ReactNode;
  className?: string;
}

/**
 * Standard empty-state placeholder for lists/tables with no data.
 */
export function EmptyState({
  icon, title = 'Nada por aqui', description, action, className,
}: EmptyStateProps) {
  return (
    <Card className={cn('p-10 text-center', className)}>
      <div className="flex flex-col items-center gap-2">
        {icon ?? <Inbox className="h-8 w-8 opacity-40" />}
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && (
          <p className="text-xs text-muted-foreground max-w-sm">{description}</p>
        )}
        {action && <div className="mt-2">{action}</div>}
      </div>
    </Card>
  );
}
