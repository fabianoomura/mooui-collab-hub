import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { DateRange } from 'react-day-picker';

const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function fmt(d: Date) {
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

function toDate(s: string | null): Date | undefined {
  if (!s) return undefined;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

interface Props {
  startDate: string | null;
  endDate: string | null;
  onChange: (start: string | null, end: string | null) => void;
}

export function DateRangeCell({ startDate, endDate, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const start = toDate(startDate);
  const end = toDate(endDate);

  // Determine color based on proximity to end date
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  let barColor = 'hsl(35, 90%, 55%)'; // default orange
  if (end) {
    const days = Math.ceil((end.getTime() - now.getTime()) / 86400000);
    if (days < 0) barColor = 'hsl(0, 75%, 55%)'; // overdue
    else if (days <= 3) barColor = 'hsl(10, 85%, 55%)'; // urgent
    else if (days <= 14) barColor = 'hsl(35, 90%, 55%)'; // soon orange
    else barColor = 'hsl(48, 95%, 55%)'; // yellow far
  }

  const range: DateRange | undefined =
    start || end ? { from: start, to: end } : undefined;

  const handleSelect = (r: DateRange | undefined) => {
    const s = r?.from ? toISO(r.from) : null;
    const e = r?.to ? toISO(r.to) : null;
    onChange(s, e);
  };

  const hasAny = !!(start || end);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => { e.stopPropagation(); setOpen(true); }}
          className="w-full h-full px-1.5 py-1 flex items-center justify-center hover:bg-accent/40 rounded-sm"
        >
          {hasAny ? (
            <div
              className="relative h-5 w-full rounded-sm flex items-center justify-center px-1.5 text-[10px] font-medium text-white shadow-sm"
              style={{ backgroundColor: barColor }}
            >
              <span className="truncate">
                {start && end
                  ? `${fmt(start)} – ${fmt(end)}`
                  : start
                  ? `Início ${fmt(start)}`
                  : `Até ${fmt(end!)}`}
              </span>
            </div>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start" onClick={(e) => e.stopPropagation()}>
        <Calendar
          mode="range"
          selected={range}
          onSelect={handleSelect}
          numberOfMonths={2}
          initialFocus
          className={cn('p-3 pointer-events-auto')}
        />
        <div className="flex items-center justify-between border-t border-border p-2">
          <Button
            size="sm"
            variant="ghost"
            className="text-xs h-7"
            onClick={() => { onChange(null, null); setOpen(false); }}
          >
            Limpar
          </Button>
          <Button size="sm" className="text-xs h-7" onClick={() => setOpen(false)}>
            Fechar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
