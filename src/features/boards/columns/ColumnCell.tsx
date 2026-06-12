import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Star, ExternalLink, Plus, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ColumnType, ProjectColumn } from '@/hooks/useProjectColumns';

interface ColumnCellProps {
  value: string;
  column: ProjectColumn;
  onChange: (value: string) => void;
  compact?: boolean;
}

/**
 * Unified cell renderer/editor for all column types.
 * Renders inline display + click-to-edit behavior per type.
 */
export function ColumnCell({ value, column, onChange, compact }: ColumnCellProps) {
  const colType = column.column_type;

  switch (colType) {
    case 'checkbox':
      return <CheckboxCell value={value} onChange={onChange} />;
    case 'rating':
      return <RatingCell value={value} onChange={onChange} config={column.config} />;
    case 'link':
      return <LinkCell value={value} onChange={onChange} />;
    case 'select':
      return <SelectCell value={value} onChange={onChange} config={column.config} columnId={column.id} />;
    case 'tags':
      return <TagsCell value={value} onChange={onChange} config={column.config} columnId={column.id} />;
    case 'numeros':
      return <EditableCell value={value} onChange={onChange} inputType="number" compact={compact} />;
    case 'data':
      return <EditableCell value={value} onChange={onChange} inputType="date" compact={compact} />;
    case 'status':
      return <SelectCell value={value} onChange={onChange} config={column.config} columnId={column.id} colored />;
    default:
      return <EditableCell value={value} onChange={onChange} inputType="text" compact={compact} />;
  }
}

/* ─── Checkbox ─── */
function CheckboxCell({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const checked = value === 'true' || value === '1';
  return (
    <div className="flex items-center justify-center h-full min-h-[30px]" onClick={e => e.stopPropagation()}>
      <Checkbox
        checked={checked}
        onCheckedChange={(c) => onChange(c ? 'true' : 'false')}
        className="h-4 w-4"
      />
    </div>
  );
}

/* ─── Rating (1-5 stars, configurable max via config.max) ─── */
function RatingCell({ value, onChange, config }: { value: string; onChange: (v: string) => void; config: Record<string, unknown> }) {
  const max = typeof config?.max === 'number' ? config.max : 5;
  const current = parseInt(value) || 0;

  return (
    <div className="flex items-center gap-0.5 px-1 min-h-[30px]" onClick={e => e.stopPropagation()}>
      {Array.from({ length: max }, (_, i) => (
        <button
          key={i}
          onClick={() => onChange(current === i + 1 ? '0' : String(i + 1))}
          className="p-0 hover:scale-110 transition-transform"
        >
          <Star
            className={cn('h-3.5 w-3.5', i < current ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40')}
          />
        </button>
      ))}
    </div>
  );
}

/* ─── Link ─── */
function LinkCell({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [temp, setTemp] = useState(value);

  if (editing) {
    return (
      <Input
        value={temp}
        onChange={e => setTemp(e.target.value)}
        onBlur={() => { onChange(temp); setEditing(false); }}
        onKeyDown={e => {
          if (e.key === 'Enter') { onChange(temp); setEditing(false); }
          if (e.key === 'Escape') { setTemp(value); setEditing(false); }
        }}
        className="h-7 text-xs px-2 border-primary"
        autoFocus
        placeholder="https://..."
        onClick={e => e.stopPropagation()}
      />
    );
  }

  if (!value) {
    return (
      <button
        className="w-full h-full px-2 py-1.5 text-[11px] text-muted-foreground text-left truncate hover:bg-accent/40 rounded-sm min-h-[30px]"
        onClick={e => { e.stopPropagation(); setTemp(''); setEditing(true); }}
      >
        —
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1 px-2 min-h-[30px]" onClick={e => e.stopPropagation()}>
      <button
        className="text-[11px] text-primary underline truncate flex-1 text-left"
        onClick={() => { setTemp(value); setEditing(true); }}
      >
        {value.replace(/^https?:\/\//, '').slice(0, 30)}
      </button>
      <a href={value.startsWith('http') ? value : `https://${value}`} target="_blank" rel="noopener noreferrer" className="shrink-0 text-muted-foreground hover:text-foreground">
        <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}

/* ─── Select (single) ─── config.options: { value: string; label: string; color?: string }[] */
type SelectOption = { value: string; label: string; color?: string };

function SelectCell({ value, onChange, config, columnId, colored }: {
  value: string; onChange: (v: string) => void; config: Record<string, unknown>; columnId: string; colored?: boolean;
}) {
  const options = (Array.isArray(config?.options) ? config.options : []) as SelectOption[];
  const selected = options.find(o => o.value === value);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'w-full h-full px-2 py-1 text-[11px] text-left truncate rounded-sm min-h-[30px] transition-colors',
            selected?.color && colored
              ? 'text-white font-medium'
              : 'hover:bg-accent/40',
          )}
          style={selected?.color && colored ? { backgroundColor: selected.color } : undefined}
          onClick={e => e.stopPropagation()}
        >
          {selected?.label || value || <span className="text-muted-foreground">—</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-44 p-1" align="start" onClick={e => e.stopPropagation()}>
        {options.length === 0 && (
          <p className="text-xs text-muted-foreground px-2 py-1.5">Nenhuma opção configurada</p>
        )}
        {options.map(opt => (
          <button
            key={opt.value}
            className={cn(
              'w-full text-left px-2 py-1.5 text-xs rounded-sm flex items-center gap-2 hover:bg-accent',
              value === opt.value && 'font-medium',
            )}
            onClick={() => onChange(opt.value)}
          >
            {opt.color && <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: opt.color }} />}
            {opt.label}
            {value === opt.value && <Check className="h-3 w-3 ml-auto" />}
          </button>
        ))}
        {value && (
          <button
            className="w-full text-left px-2 py-1.5 text-xs rounded-sm text-muted-foreground hover:bg-accent"
            onClick={() => onChange('')}
          >
            Limpar
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

/* ─── Tags (multi-select) ─── config.options: string[] */
function TagsCell({ value, onChange, config, columnId }: {
  value: string; onChange: (v: string) => void; config: Record<string, unknown>; columnId: string;
}) {
  const availableTags = (Array.isArray(config?.options) ? config.options : []) as string[];
  const selected = value ? value.split(',').map(s => s.trim()).filter(Boolean) : [];
  const [newTag, setNewTag] = useState('');

  const toggle = (tag: string) => {
    const next = selected.includes(tag)
      ? selected.filter(t => t !== tag)
      : [...selected, tag];
    onChange(next.join(','));
  };

  const addNew = () => {
    const t = newTag.trim();
    if (!t) return;
    if (!selected.includes(t)) {
      onChange([...selected, t].join(','));
    }
    setNewTag('');
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="w-full h-full px-1.5 py-1 text-left flex items-center gap-1 flex-wrap min-h-[30px] hover:bg-accent/40 rounded-sm"
          onClick={e => e.stopPropagation()}
        >
          {selected.length === 0 && <span className="text-[11px] text-muted-foreground px-0.5">—</span>}
          {selected.map(tag => (
            <Badge key={tag} variant="secondary" className="h-5 px-1.5 text-[10px] font-normal">{tag}</Badge>
          ))}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2" align="start" onClick={e => e.stopPropagation()}>
        <div className="space-y-1.5">
          {availableTags.map(tag => (
            <label key={tag} className="flex items-center gap-2 px-1 py-0.5 text-xs hover:bg-accent rounded cursor-pointer">
              <Checkbox checked={selected.includes(tag)} onCheckedChange={() => toggle(tag)} className="h-3.5 w-3.5" />
              {tag}
            </label>
          ))}
          {/* Inline add */}
          <div className="flex items-center gap-1 pt-1 border-t">
            <Input
              value={newTag}
              onChange={e => setNewTag(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addNew(); } }}
              placeholder="Nova tag..."
              className="h-6 text-xs flex-1"
            />
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={addNew} disabled={!newTag.trim()}>
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ─── Generic editable text/number/date cell ─── */
function EditableCell({ value, onChange, inputType, compact }: {
  value: string; onChange: (v: string) => void; inputType: string; compact?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [temp, setTemp] = useState(value);

  if (editing) {
    return (
      <Input
        value={temp}
        onChange={e => setTemp(e.target.value)}
        onBlur={() => { onChange(temp); setEditing(false); }}
        onKeyDown={e => {
          if (e.key === 'Enter') { onChange(temp); setEditing(false); }
          if (e.key === 'Escape') { setTemp(value); setEditing(false); }
        }}
        className="h-7 text-xs px-2 border-primary"
        autoFocus
        onClick={e => e.stopPropagation()}
        type={inputType}
      />
    );
  }

  let displayValue = value;
  if (inputType === 'date' && value) {
    try {
      const d = new Date(value + 'T00:00:00');
      displayValue = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    } catch {}
  }

  return (
    <button
      className="w-full h-full px-2 py-1.5 text-[11px] text-foreground text-left truncate hover:bg-accent/40 rounded-sm min-h-[30px]"
      onClick={e => { e.stopPropagation(); setTemp(value); setEditing(true); }}
    >
      {displayValue || <span className="text-muted-foreground">—</span>}
    </button>
  );
}

export default ColumnCell;
