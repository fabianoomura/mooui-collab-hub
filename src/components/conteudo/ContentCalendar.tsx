import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, getDay, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ConteudoItem, ConteudoChannel } from '@/hooks/useConteudo';

const channelColors: Record<ConteudoChannel, string> = {
  mooui_kids: 'bg-pink-500/80',
  mooui_home: 'bg-amber-500/80',
  amo_mooui: 'bg-rose-500/80',
  barcelona: 'bg-blue-500/80',
  outras_redes: 'bg-slate-500/80',
  pinterest: 'bg-red-600/80',
};

const channelLabels: Record<ConteudoChannel, string> = {
  mooui_kids: 'Kids',
  mooui_home: 'Home',
  amo_mooui: 'Amo',
  barcelona: 'BCN',
  outras_redes: 'Outras',
  pinterest: 'Pinterest',
};

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

interface ContentCalendarProps {
  items: ConteudoItem[];
  onClickItem: (item: ConteudoItem) => void;
}

export function ContentCalendar({ items, onClickItem }: ContentCalendarProps) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));

  const days = useMemo(() => {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    return eachDayOfInterval({ start, end });
  }, [month]);

  const itemsByDate = useMemo(() => {
    const map = new Map<string, ConteudoItem[]>();
    items.forEach(item => {
      if (!item.scheduled_date) return;
      const key = item.scheduled_date;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    });
    return map;
  }, [items]);

  const firstDayOffset = getDay(startOfMonth(month));
  const today = new Date();

  return (
    <div className="space-y-3">
      {/* Nav */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMonth(m => subMonths(m, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-semibold capitalize">
          {format(month, 'MMMM yyyy', { locale: ptBR })}
        </span>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMonth(m => addMonths(m, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(channelLabels) as ConteudoChannel[]).map(ch => (
          <div key={ch} className="flex items-center gap-1">
            <div className={cn('h-2.5 w-2.5 rounded-full', channelColors[ch])} />
            <span className="text-[10px] text-muted-foreground">{channelLabels[ch]}</span>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-px bg-border rounded-md overflow-hidden">
        {/* Header */}
        {WEEKDAYS.map(d => (
          <div key={d} className="bg-muted px-1 py-1.5 text-center text-[10px] font-medium text-muted-foreground">
            {d}
          </div>
        ))}

        {/* Empty cells before first day */}
        {Array.from({ length: firstDayOffset }).map((_, i) => (
          <div key={`empty-${i}`} className="bg-background min-h-[80px]" />
        ))}

        {/* Day cells */}
        {days.map(day => {
          const key = format(day, 'yyyy-MM-dd');
          const dayItems = itemsByDate.get(key) || [];
          const isToday = isSameDay(day, today);

          return (
            <div
              key={key}
              className={cn(
                'bg-background min-h-[80px] p-1 relative',
                isToday && 'ring-1 ring-inset ring-primary/40'
              )}
            >
              <span className={cn(
                'text-[11px] font-medium',
                isToday ? 'text-primary font-bold' : 'text-muted-foreground'
              )}>
                {format(day, 'd')}
              </span>

              <div className="mt-0.5 space-y-0.5">
                {dayItems.slice(0, 3).map(item => (
                  <button
                    key={item.id}
                    onClick={() => onClickItem(item)}
                    className={cn(
                      'w-full text-left text-[9px] text-white font-medium px-1 py-0.5 rounded truncate block',
                      channelColors[item.channel]
                    )}
                    title={`${item.title} (${channelLabels[item.channel]})`}
                  >
                    {item.time_slot ? `${item.time_slot} ` : ''}{item.title}
                  </button>
                ))}
                {dayItems.length > 3 && (
                  <span className="text-[9px] text-muted-foreground pl-1">+{dayItems.length - 3} mais</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
