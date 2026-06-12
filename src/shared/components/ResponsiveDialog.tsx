import { type ReactNode } from 'react';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface ResponsiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Content (the scrollable body) */
  children: ReactNode;
  /** Footer actions (buttons) */
  footer?: ReactNode;
  /** Max width on desktop (default: max-w-lg) */
  maxWidth?: string;
  className?: string;
}

/**
 * Dialog on desktop (>=640px), bottom Sheet on mobile (<640px).
 * Always has `max-h-[90dvh]` with internal scroll — no content cutoff.
 */
export function ResponsiveDialog({
  open, onOpenChange, title, children, footer, maxWidth = 'max-w-lg', className,
}: ResponsiveDialogProps) {
  const isMobile = useMediaQuery('(max-width: 639px)');

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className={cn('max-h-[90dvh] flex flex-col', className)}>
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto py-2 -mx-6 px-6">
            {children}
          </div>
          {footer && <SheetFooter className="pt-2 border-t">{footer}</SheetFooter>}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(maxWidth, 'max-h-[90dvh] overflow-hidden flex flex-col', className)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto pr-1">
          {children}
        </div>
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}
