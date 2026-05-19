import { useState } from 'react';
import { Tag, Plus, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useTicketLabels, useTicketLabelAssignments, useToggleTicketLabel, type TicketLabel } from '@/hooks/useTicketLabels';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const PALETTE = ['#D6336C', '#F08C00', '#E03131', '#7048E8', '#1971C2', '#0CA678', '#5C940D', '#495057'];

export function TicketLabelChips({ ticketId, max }: { ticketId: string; max?: number }) {
  const { labels } = useTicketLabels();
  const { data: assignments = [] } = useTicketLabelAssignments();
  const ticketLabelIds = assignments.filter(a => a.ticket_id === ticketId).map(a => a.label_id);
  const ticketLabels = labels.filter(l => ticketLabelIds.includes(l.id));
  if (ticketLabels.length === 0) return null;
  const shown = max ? ticketLabels.slice(0, max) : ticketLabels;
  const more = max ? ticketLabels.length - shown.length : 0;
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map(l => (
        <Badge
          key={l.id} variant="outline"
          className="text-[9px] px-1.5 py-0 h-4 border-0"
          style={{ backgroundColor: l.color + '22', color: l.color }}
        >
          {l.name}
        </Badge>
      ))}
      {more > 0 && <span className="text-[10px] text-muted-foreground">+{more}</span>}
    </div>
  );
}

export function TicketLabelPicker({ ticketId }: { ticketId: string }) {
  const { labels, create } = useTicketLabels();
  const { data: assignments = [] } = useTicketLabelAssignments();
  const toggle = useToggleTicketLabel();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PALETTE[0]);

  const selected = new Set(assignments.filter(a => a.ticket_id === ticketId).map(a => a.label_id));

  const handleToggle = (l: TicketLabel) => {
    toggle.mutate({ ticketId, labelId: l.id, attach: !selected.has(l.id) });
  };

  const handleCreate = () => {
    if (!newName.trim()) return;
    create.mutate({ name: newName.trim(), color: newColor }, {
      onSuccess: () => { setNewName(''); toast.success('Label criada'); },
      onError: (e: any) => toast.error(e?.message || 'Erro'),
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5">
          <Tag className="h-3.5 w-3.5" /> Labels
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2">
        <div className="space-y-0.5 max-h-48 overflow-y-auto">
          {labels.length === 0 && (
            <p className="text-xs text-muted-foreground px-2 py-1">Nenhuma label ainda</p>
          )}
          {labels.map(l => {
            const isSel = selected.has(l.id);
            return (
              <button
                key={l.id} type="button"
                onClick={() => handleToggle(l)}
                className={cn('w-full flex items-center gap-2 px-2 py-1 rounded text-xs hover:bg-muted', isSel && 'bg-muted/50')}
              >
                <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: l.color }} />
                <span className="flex-1 text-left truncate">{l.name}</span>
                {isSel && <Check className="h-3.5 w-3.5 text-primary" />}
              </button>
            );
          })}
        </div>
        <div className="border-t border-border mt-2 pt-2 space-y-2">
          <div className="flex gap-1">
            <Input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Nova label..."
              className="h-7 text-xs"
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
            />
            <Button size="icon" className="h-7 w-7" onClick={handleCreate} disabled={!newName.trim()}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="flex gap-1 flex-wrap">
            {PALETTE.map(c => (
              <button
                key={c} type="button"
                onClick={() => setNewColor(c)}
                className={cn('h-5 w-5 rounded-sm border-2', newColor === c ? 'border-foreground' : 'border-transparent')}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
