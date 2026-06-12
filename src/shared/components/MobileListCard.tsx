import { type ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface MobileListCardProps {
  /** Left icon/avatar area */
  icon?: ReactNode;
  /** Primary text line */
  title: ReactNode;
  /** Secondary text (status, date, assignee) */
  subtitle?: ReactNode;
  /** Badges/chips row */
  badges?: ReactNode;
  /** Right side content (arrow, action button) */
  trailing?: ReactNode;
  onClick?: () => void;
  className?: string;
}

/**
 * Standard card for mobile list views — replaces table rows on small screens.
 * Consistent layout: icon | title+subtitle+badges | trailing.
 * Min touch height of 44px.
 */
export function MobileListCard({
  icon, title, subtitle, badges, trailing, onClick, className,
}: MobileListCardProps) {
  return (
    <Card
      onClick={onClick}
      className={cn(
        'p-3 min-h-[44px]',
        onClick && 'cursor-pointer hover:border-primary/40 active:bg-accent/50 transition-colors',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        {icon && (
          <div className="shrink-0 flex items-center justify-center">{icon}</div>
        )}
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{title}</div>
          {subtitle && (
            <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div>
          )}
          {badges && (
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">{badges}</div>
          )}
        </div>
        {trailing && (
          <div className="shrink-0 flex items-center">{trailing}</div>
        )}
      </div>
    </Card>
  );
}
