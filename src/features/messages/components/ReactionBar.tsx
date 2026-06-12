import { useState } from 'react';
import { SmilePlus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { ReactionGroup } from '../hooks/useMessageReactions';

const QUICK = ['👍', '❤️', '😂', '🎉', '👀', '✅', '🔥', '🙏'];

interface Props {
  groups: ReactionGroup[];
  onToggle: (emoji: string, mine: boolean) => void;
  compact?: boolean;
}

export function ReactionBar({ groups, onToggle, compact }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-1 mt-1">
      {groups.map((g) => (
        <button
          key={g.emoji}
          onClick={() => onToggle(g.emoji, g.mine)}
          className={cn(
            'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors',
            g.mine
              ? 'bg-primary/15 border-primary/40 text-primary'
              : 'bg-muted/40 border-border hover:bg-muted'
          )}
          title={`${g.count} ${g.count === 1 ? 'pessoa' : 'pessoas'}`}
        >
          <span>{g.emoji}</span>
          <span className="tabular-nums">{g.count}</span>
        </button>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className={cn(
              'inline-flex items-center justify-center rounded-full border border-border bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors',
              compact ? 'h-5 w-5' : 'h-6 w-6',
              groups.length === 0 && 'opacity-0 group-hover:opacity-100'
            )}
            aria-label="Adicionar reação"
          >
            <SmilePlus className="h-3 w-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-1.5">
          <div className="flex gap-1">
            {QUICK.map((e) => {
              const existing = groups.find((g) => g.emoji === e);
              return (
                <button
                  key={e}
                  onClick={() => { onToggle(e, !!existing?.mine); setOpen(false); }}
                  className="h-8 w-8 rounded hover:bg-accent text-lg leading-none flex items-center justify-center"
                >
                  {e}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
