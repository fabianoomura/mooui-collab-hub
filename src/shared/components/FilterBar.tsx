import { useState, type ReactNode } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface FilterBarProps {
  /** Search input value (controlled) */
  search?: string;
  /** Callback when search value changes */
  onSearchChange?: (value: string) => void;
  /** Placeholder for the search input */
  searchPlaceholder?: string;
  /** Filter controls (Selects, etc.) — rendered inline on desktop, inside Sheet on mobile */
  children?: ReactNode;
  /** Number of active filters (shows badge on mobile toggle) */
  activeCount?: number;
  /** Called when "clear all" is clicked */
  onClear?: () => void;
  className?: string;
}

/**
 * Responsive filter bar: search + filter controls.
 * Desktop: search + inline filters in a row.
 * Mobile (<640px): search visible, filters collapse into a bottom Sheet with a toggle button.
 */
export function FilterBar({
  search, onSearchChange, searchPlaceholder = 'Buscar…',
  children, activeCount = 0, onClear, className,
}: FilterBarProps) {
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-2">
        {onSearchChange != null && (
          <div className="relative flex-1 min-w-0">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              className="pl-8 h-10"
              value={search ?? ''}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
        )}
        {/* Mobile: toggle button for filters */}
        {children && (
          <Button
            variant="outline"
            size="sm"
            className="h-10 sm:hidden relative"
            onClick={() => setSheetOpen(true)}
          >
            <SlidersHorizontal className="h-4 w-4" />
            {activeCount > 0 && (
              <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                {activeCount}
              </span>
            )}
          </Button>
        )}
      </div>

      {/* Desktop: inline filters */}
      {children && (
        <div className="hidden sm:flex sm:items-center gap-2 flex-wrap">
          {children}
          {activeCount > 0 && onClear && (
            <Button
              variant="ghost" size="sm" className="h-10 text-xs text-muted-foreground"
              onClick={onClear}
            >
              <X className="h-3.5 w-3.5 mr-1" />Limpar filtros
            </Button>
          )}
        </div>
      )}

      {/* Mobile: Sheet with filters */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="max-h-[70dvh]">
          <SheetHeader>
            <SheetTitle>Filtros</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-3 py-4">
            {children}
          </div>
          <div className="flex gap-2 pt-2 border-t">
            {activeCount > 0 && onClear && (
              <Button
                variant="outline" className="flex-1 h-10"
                onClick={() => { onClear(); setSheetOpen(false); }}
              >
                Limpar filtros
              </Button>
            )}
            <Button className="flex-1 h-10" onClick={() => setSheetOpen(false)}>
              Aplicar
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
