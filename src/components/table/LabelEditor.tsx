import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export interface LabelOption {
  id: string;
  text: string;
  color: string;
}

const PRESET_COLORS = [
  '#22C55E', '#16A34A', '#15803D',
  '#3B82F6', '#2563EB', '#1D4ED8',
  '#8B5CF6', '#7C3AED', '#6D28D9',
  '#F59E0B', '#D97706', '#B45309',
  '#EF4444', '#DC2626', '#B91C1C',
  '#EC4899', '#DB2777', '#BE185D',
  '#06B6D4', '#0891B2', '#0E7490',
  '#6B7280', '#4B5563', '#374151',
  '#F97316', '#EA580C', '#C2410C',
  '#14B8A6', '#0D9488', '#0F766E',
];

function ColorPicker({ color, onChange }: { color: string; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="h-6 w-6 rounded shrink-0 border border-border hover:ring-2 hover:ring-primary/50 transition-all"
          style={{ backgroundColor: color }}
        />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="grid grid-cols-6 gap-1.5">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              className={`h-7 w-7 rounded-sm hover:scale-110 transition-transform ${color === c ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : ''}`}
              style={{ backgroundColor: c }}
              onClick={() => { onChange(c); setOpen(false); }}
            />
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Hex:</span>
          <Input
            value={color}
            onChange={(e) => onChange(e.target.value)}
            className="h-7 text-xs w-24"
            maxLength={7}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface LabelEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  labels: LabelOption[];
  onSave: (labels: LabelOption[]) => void;
  title?: string;
}

export function LabelEditorDialog({ open, onOpenChange, labels, onSave, title = 'Editar etiquetas' }: LabelEditorProps) {
  const [editLabels, setEditLabels] = useState<LabelOption[]>(labels);

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) setEditLabels(labels);
    onOpenChange(isOpen);
  };

  const addLabel = () => {
    const id = crypto.randomUUID();
    setEditLabels([...editLabels, { id, text: '', color: PRESET_COLORS[editLabels.length % PRESET_COLORS.length] }]);
  };

  const updateLabel = (id: string, updates: Partial<LabelOption>) => {
    setEditLabels(editLabels.map(l => l.id === id ? { ...l, ...updates } : l));
  };

  const removeLabel = (id: string) => {
    setEditLabels(editLabels.filter(l => l.id !== id));
  };

  const handleSave = () => {
    onSave(editLabels.filter(l => l.text.trim()));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {editLabels.map((label) => (
            <div key={label.id} className="flex items-center gap-2 group">
              <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
              <ColorPicker color={label.color} onChange={(c) => updateLabel(label.id, { color: c })} />
              <Input
                value={label.text}
                onChange={(e) => updateLabel(label.id, { text: e.target.value })}
                className="h-8 text-sm flex-1"
                placeholder="Nome da etiqueta"
              />
              <button
                onClick={() => removeLabel(label.id)}
                className="text-muted-foreground hover:text-destructive transition-colors p-1 opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={addLabel}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
        >
          <Plus className="h-4 w-4" /> Nova etiqueta
        </button>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button size="sm" onClick={handleSave}>Salvar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Inline label cell for the table - shows current label, click to change
export function LabelCell({
  value,
  labels,
  onChange,
  onEditLabels,
}: {
  value: string;
  labels: LabelOption[];
  onChange: (labelId: string) => void;
  onEditLabels: () => void;
}) {
  const [open, setOpen] = useState(false);
  const currentLabel = labels.find(l => l.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="w-full h-full px-2 py-1.5 text-[11px] font-medium text-center rounded-sm transition-colors"
          style={{
            backgroundColor: currentLabel?.color || 'hsl(var(--muted))',
            color: currentLabel ? '#fff' : 'hsl(var(--muted-foreground))',
          }}
          onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        >
          {currentLabel?.text || '—'}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-2" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-0.5 mb-2">
          {labels.map((label) => (
            <button
              key={label.id}
              className="w-full text-left px-3 py-1.5 text-xs rounded-sm hover:opacity-90 font-medium text-center"
              style={{ backgroundColor: label.color, color: '#fff' }}
              onClick={(e) => { e.stopPropagation(); onChange(label.id); setOpen(false); }}
            >
              {label.text}
            </button>
          ))}
          {labels.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">Nenhuma etiqueta</p>
          )}
        </div>
        <div className="border-t border-border pt-2 space-y-1">
          <button
            className="w-full text-left px-2 py-1 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5"
            onClick={(e) => { e.stopPropagation(); setOpen(false); onEditLabels(); }}
          >
            <span className="text-[10px]">✏️</span> Editar etiquetas
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
