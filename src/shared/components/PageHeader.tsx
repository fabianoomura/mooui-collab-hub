import { type ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Action buttons rendered to the right of the title */
  actions?: ReactNode;
  /** Optional icon rendered before the title */
  icon?: ReactNode;
}

/**
 * Standard page header — title + optional description + action buttons.
 * All pages should use this instead of rolling their own header layout.
 */
export function PageHeader({ title, description, actions, icon }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-3 flex-wrap">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
          {icon}
          {title}
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      )}
    </div>
  );
}
