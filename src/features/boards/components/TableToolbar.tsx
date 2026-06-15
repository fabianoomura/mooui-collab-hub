import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { SlidersHorizontal, ArrowUpDown, Eye, X, MoreHorizontal, Pencil, Trash2, Plus, ChevronLeft, ChevronRight, ListFilter } from 'lucide-react';
import { type TaskStatus, type TaskPriority } from '@/hooks/useProjectData';
import { type ColumnType, type ProjectColumn } from '@/hooks/useProjectColumns';
import {
  statusLabels, priorityLabels, columnTypeLabels, columnTypeIcons,
  FIXED_COLUMNS, fixedColumnLabels, type FixedColumnKey,
  type SortField, type SortDir, type GroupBy,
} from '../constants';
import { getInitials } from '../constants';

export function ColumnHeaderMenu({ column, onRename, onDelete, onToggleCardVisibility, onMoveLeft, onMoveRight, onEditOptions, isFirst, isLast }: {
  column: ProjectColumn; onRename: () => void; onDelete: () => void;
  onToggleCardVisibility: () => void; onMoveLeft?: () => void; onMoveRight?: () => void;
  onEditOptions?: () => void; isFirst?: boolean; isLast?: boolean;
}) {
  const showOnCard = !!column.config?.show_on_card;
  const hasOptions = column.column_type === 'select' || column.column_type === 'status' || column.column_type === 'tags';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-accent rounded" onClick={e => e.stopPropagation()}>
          <MoreHorizontal className="h-3 w-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuItem onClick={onRename}>
          <Pencil className="h-3.5 w-3.5 mr-2" /> Renomear
        </DropdownMenuItem>
        {hasOptions && onEditOptions && (
          <DropdownMenuItem onClick={onEditOptions}>
            <ListFilter className="h-3.5 w-3.5 mr-2" /> Editar opções
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={onToggleCardVisibility}>
          {showOnCard ? <Eye className="h-3.5 w-3.5 mr-2" /> : <Eye className="h-3.5 w-3.5 mr-2 opacity-40" />}
          {showOnCard ? 'Ocultar do card' : 'Mostrar no card'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {!isFirst && onMoveLeft && (
          <DropdownMenuItem onClick={onMoveLeft}>
            <ChevronLeft className="h-3.5 w-3.5 mr-2" /> Mover à esquerda
          </DropdownMenuItem>
        )}
        {!isLast && onMoveRight && (
          <DropdownMenuItem onClick={onMoveRight}>
            <ChevronRight className="h-3.5 w-3.5 mr-2" /> Mover à direita
          </DropdownMenuItem>
        )}
        {(!isFirst || !isLast) && <DropdownMenuSeparator />}
        <DropdownMenuItem onClick={onDelete} className="text-destructive">
          <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir coluna
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AddColumnButton({ onAdd }: { onAdd: (name: string, type: ColumnType) => void }) {
  const [open, setOpen] = useState(false);
  const [pickedType, setPickedType] = useState<ColumnType | null>(null);
  const [name, setName] = useState('');
  const types: ColumnType[] = ['status', 'texto', 'pessoas', 'cronograma', 'data', 'tags', 'numeros', 'checkbox', 'link', 'rating', 'select'];

  const reset = () => { setPickedType(null); setName(''); };
  const submit = () => {
    const n = name.trim();
    if (!n || !pickedType) return;
    onAdd(n, pickedType);
    reset();
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <PopoverTrigger asChild>
        <button className="px-2 py-2 text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors flex items-center justify-center" title="Adicionar Coluna">
          <Plus className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start" onClick={(e) => e.stopPropagation()}>
        {!pickedType ? (
          <>
            <p className="text-xs font-semibold text-muted-foreground mb-2 px-2">Adicionar Coluna</p>
            {types.map(type => {
              const Icon = columnTypeIcons[type];
              return (
                <button key={type} className="w-full text-left px-3 py-1.5 text-xs rounded-sm hover:bg-accent flex items-center gap-2" onClick={() => setPickedType(type)}>
                  <Icon className="h-3.5 w-3.5" /> {columnTypeLabels[type]}
                </button>
              );
            })}
          </>
        ) : (
          <div className="space-y-2 p-1">
            <p className="text-xs font-semibold text-muted-foreground">Nome ({columnTypeLabels[pickedType]})</p>
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } if (e.key === 'Escape') reset(); }}
              placeholder="Nome da coluna…" className="h-8 text-xs" />
            <div className="flex items-center gap-1">
              <Button size="sm" className="h-7 px-2 text-xs" onClick={submit} disabled={!name.trim()}>Adicionar</Button>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={reset}>Voltar</Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function FilterPopover({ filterStatus, setFilterStatus, filterPriority, setFilterPriority, filterAssignee, setFilterAssignee, members, profilesMap }: {
  filterStatus: Set<TaskStatus>; setFilterStatus: (s: Set<TaskStatus>) => void;
  filterPriority: Set<TaskPriority>; setFilterPriority: (s: Set<TaskPriority>) => void;
  filterAssignee: Set<string>; setFilterAssignee: (s: Set<string>) => void;
  members: { user_id: string; profile: { full_name: string | null } | null }[];
  profilesMap: Map<string, { full_name: string | null; avatar_url: string | null }>;
}) {
  const [open, setOpen] = useState(false);
  const activeCount = filterStatus.size + filterPriority.size + filterAssignee.size;
  const toggleSet = <T,>(set: Set<T>, val: T, setter: (s: Set<T>) => void) => {
    const next = new Set(set);
    if (next.has(val)) next.delete(val); else next.add(val);
    setter(next);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className={`gap-1.5 text-xs h-8 ${activeCount > 0 ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
          <SlidersHorizontal className="h-3.5 w-3.5" /> Filtrar{activeCount > 0 && ` (${activeCount})`}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1.5 px-1">Status</p>
        {(['backlog', 'todo', 'in_progress', 'in_review', 'done'] as TaskStatus[]).map(s => (
          <label key={s} className="flex items-center gap-2 py-1 cursor-pointer px-2">
            <Checkbox checked={filterStatus.has(s)} onCheckedChange={() => toggleSet(filterStatus, s, setFilterStatus)} />
            <span className="text-xs">{statusLabels[s]}</span>
          </label>
        ))}
        <div className="border-t border-border my-1.5" />
        <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1.5 px-1">Prioridade</p>
        {(['critical', 'high', 'medium', 'low'] as TaskPriority[]).map(p => (
          <label key={p} className="flex items-center gap-2 py-1 cursor-pointer px-2">
            <Checkbox checked={filterPriority.has(p)} onCheckedChange={() => toggleSet(filterPriority, p, setFilterPriority)} />
            <span className="text-xs">{priorityLabels[p]}</span>
          </label>
        ))}
        {members.length > 0 && (
          <>
            <div className="border-t border-border my-1.5" />
            <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1.5 px-1">Responsável</p>
            {members.map(m => {
              const name = m.profile?.full_name || profilesMap.get(m.user_id)?.full_name || 'Usuário';
              return (
                <label key={m.user_id} className="flex items-center gap-2 py-1 cursor-pointer px-2">
                  <Checkbox checked={filterAssignee.has(m.user_id)} onCheckedChange={() => toggleSet(filterAssignee, m.user_id, setFilterAssignee)} />
                  <span className="text-xs truncate">{name}</span>
                </label>
              );
            })}
          </>
        )}
        {activeCount > 0 && (
          <Button variant="ghost" size="sm" className="w-full mt-2 text-xs h-7" onClick={() => { setFilterStatus(new Set()); setFilterPriority(new Set()); setFilterAssignee(new Set()); }}>
            Limpar filtros
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function SortPopover({ sortField, sortDir, onSort }: { sortField: SortField | null; sortDir: SortDir; onSort: (field: SortField | null, dir: SortDir) => void }) {
  const [open, setOpen] = useState(false);
  const fields: { field: SortField; label: string }[] = [
    { field: 'title', label: 'Título' }, { field: 'priority', label: 'Prioridade' },
    { field: 'status', label: 'Status' }, { field: 'due_date', label: 'Data' }, { field: 'created_at', label: 'Abertura' },
  ];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className={`gap-1.5 text-xs h-8 ${sortField ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
          <ArrowUpDown className="h-3.5 w-3.5" /> Ordenar
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2" align="start">
        {fields.map(f => (
          <button key={f.field} className={`w-full text-left px-3 py-1.5 text-xs rounded-sm hover:bg-accent ${sortField === f.field ? 'bg-accent font-medium' : ''}`}
            onClick={() => {
              if (sortField === f.field) onSort(f.field, sortDir === 'asc' ? 'desc' : 'asc');
              else onSort(f.field, 'asc');
            }}>
            {f.label} {sortField === f.field && (sortDir === 'asc' ? '↑' : '↓')}
          </button>
        ))}
        {sortField && (
          <Button variant="ghost" size="sm" className="w-full mt-1 text-xs h-7" onClick={() => onSort(null, 'asc')}>Limpar</Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function GroupByPopover({ groupBy, onGroupBy }: { groupBy: GroupBy; onGroupBy: (g: GroupBy) => void }) {
  const [open, setOpen] = useState(false);
  const options: { value: GroupBy; label: string }[] = [
    { value: 'month', label: 'Mês' }, { value: 'status', label: 'Status' },
    { value: 'priority', label: 'Prioridade' }, { value: 'none', label: 'Sem agrupamento' },
  ];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-1.5 text-xs h-8">
          <SlidersHorizontal className="h-3.5 w-3.5" /> Agrupar
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-44 p-2" align="start">
        {options.map(opt => (
          <button key={opt.value} className={`w-full text-left px-3 py-1.5 text-xs rounded-sm hover:bg-accent ${groupBy === opt.value ? 'bg-accent font-medium' : ''}`}
            onClick={() => { onGroupBy(opt.value); setOpen(false); }}>
            {opt.label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

export function HideColumnsPopover({ visible, onToggle }: { visible: Set<FixedColumnKey>; onToggle: (col: FixedColumnKey) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-1.5 text-xs">
          <Eye className="h-3.5 w-3.5" /> Ocultar
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2" align="start">
        {FIXED_COLUMNS.map(col => (
          <label key={col} className="flex items-center gap-2 py-1 cursor-pointer px-2">
            <Checkbox checked={visible.has(col)} onCheckedChange={() => onToggle(col)} />
            <span className="text-xs">{fixedColumnLabels[col]}</span>
          </label>
        ))}
      </PopoverContent>
    </Popover>
  );
}

export function FixedColHeader({ label, colKey, onHide, onDragStart, onDrop }: {
  label: string; colKey: string; onHide: () => void;
  onDragStart?: (key: string) => void; onDrop?: (key: string) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  return (
    <span
      className={`px-2 py-2 text-center flex items-center justify-center gap-1 group cursor-grab active:cursor-grabbing select-none transition-colors ${dragOver ? 'bg-primary/10' : ''}`}
      draggable
      onDragStart={(e) => { e.stopPropagation(); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('application/col-key', colKey); onDragStart?.(colKey); }}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('application/col-key')) return;
        e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move';
        if (!dragOver) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        if (!e.dataTransfer.types.includes('application/col-key')) return;
        e.preventDefault(); e.stopPropagation(); setDragOver(false); onDrop?.(colKey);
      }}
      onDragEnd={() => setDragOver(false)}
    >
      {label}
      <button onClick={onHide} title="Ocultar coluna" className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
