import { useProjects, useCreateProject, useProjectTasks, type TaskWithAssignees, type TaskStatus, type TaskPriority } from '@/hooks/useProjectData';
import { useAssigneeProfiles } from '@/hooks/useAssigneeProfiles';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, FolderKanban, Loader2, ChevronDown, ChevronRight, Search, SlidersHorizontal, ArrowUpDown, Eye, LayoutGrid, X } from 'lucide-react';
import { useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { TaskSidePanel } from '@/components/kanban/TaskSidePanel';

const statusLabels: Record<TaskStatus, string> = {
  backlog: 'Backlog',
  todo: 'Não Iniciado',
  in_progress: 'Em Andamento',
  in_review: 'Em Revisão',
  done: 'Feito',
};

const statusCellColors: Record<TaskStatus, string> = {
  backlog: 'bg-[hsl(var(--muted))] text-muted-foreground',
  todo: 'bg-[hsl(220,80%,55%)] text-white',
  in_progress: 'bg-[hsl(35,90%,55%)] text-white',
  in_review: 'bg-[hsl(280,60%,55%)] text-white',
  done: 'bg-[hsl(145,60%,42%)] text-white',
};

const priorityLabels: Record<TaskPriority, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  critical: 'Crítica',
};

const priorityCellColors: Record<TaskPriority, string> = {
  low: 'bg-[hsl(210,15%,50%)] text-white',
  medium: 'bg-[hsl(35,70%,50%)] text-white',
  high: 'bg-[hsl(10,75%,55%)] text-white',
  critical: 'bg-[hsl(0,85%,45%)] text-white',
};

const groupColors = [
  'hsl(280, 60%, 55%)',
  'hsl(200, 80%, 50%)',
  'hsl(145, 60%, 42%)',
  'hsl(35, 90%, 55%)',
  'hsl(0, 75%, 55%)',
  'hsl(320, 70%, 50%)',
];

const monthNames = [
  'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
  'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'
];

type SortField = 'title' | 'priority' | 'status' | 'due_date' | 'created_at';
type SortDir = 'asc' | 'desc';
type GroupBy = 'month' | 'status' | 'priority' | 'none';

const priorityOrder: Record<TaskPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const statusOrder: Record<TaskStatus, number> = { backlog: 0, todo: 1, in_progress: 2, in_review: 3, done: 4 };

function getInitials(name: string | null): string {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

function formatDateShort(dateStr: string | null) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

function getMonthYearKey(dateStr: string | null): string {
  if (!dateStr) return 'sem-data';
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
}

function getMonthYearLabel(key: string): string {
  if (key === 'sem-data') return 'Sem Data';
  const [year, month] = key.split('-').map(Number);
  return `${monthNames[month]} - ${year}`;
}

// Inline editable status cell
function StatusCell({ value, onChange }: { value: TaskStatus; onChange: (v: TaskStatus) => void }) {
  const [open, setOpen] = useState(false);
  const statuses: TaskStatus[] = ['backlog', 'todo', 'in_progress', 'in_review', 'done'];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={`w-full h-full px-2 py-1.5 text-[11px] font-medium text-center rounded-sm transition-colors ${statusCellColors[value]}`}
          onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        >
          {statusLabels[value]}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-40 p-1" onClick={(e) => e.stopPropagation()}>
        {statuses.map((s) => (
          <button
            key={s}
            className={`w-full text-left px-3 py-1.5 text-xs rounded-sm mb-0.5 ${statusCellColors[s]} hover:opacity-90`}
            onClick={(e) => { e.stopPropagation(); onChange(s); setOpen(false); }}
          >
            {statusLabels[s]}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function PriorityCell({ value, onChange }: { value: TaskPriority; onChange: (v: TaskPriority) => void }) {
  const [open, setOpen] = useState(false);
  const priorities: TaskPriority[] = ['low', 'medium', 'high', 'critical'];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={`w-full h-full px-2 py-1.5 text-[11px] font-medium text-center rounded-sm transition-colors ${priorityCellColors[value]}`}
          onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        >
          {priorityLabels[value]}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-36 p-1" onClick={(e) => e.stopPropagation()}>
        {priorities.map((p) => (
          <button
            key={p}
            className={`w-full text-left px-3 py-1.5 text-xs rounded-sm mb-0.5 ${priorityCellColors[p]} hover:opacity-90`}
            onClick={(e) => { e.stopPropagation(); onChange(p); setOpen(false); }}
          >
            {priorityLabels[p]}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function AssigneeAvatars({ assignees, profilesMap }: { assignees: { user_id: string }[]; profilesMap: Map<string, { full_name: string | null; avatar_url: string | null }> }) {
  if (assignees.length === 0) return <span className="text-muted-foreground text-xs flex items-center justify-center h-full">—</span>;

  return (
    <TooltipProvider>
      <div className="flex -space-x-1 justify-center">
        {assignees.slice(0, 3).map((a) => {
          const profile = profilesMap.get(a.user_id);
          const name = profile?.full_name || '?';
          return (
            <Tooltip key={a.user_id}>
              <TooltipTrigger asChild>
                <Avatar className="h-7 w-7 border-2 border-background cursor-default">
                  <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
                    {getInitials(name)}
                  </AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">{name}</TooltipContent>
            </Tooltip>
          );
        })}
        {assignees.length > 3 && (
          <Avatar className="h-7 w-7 border-2 border-background">
            <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">
              +{assignees.length - 3}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    </TooltipProvider>
  );
}

function FilterPopover({
  filterStatus, setFilterStatus,
  filterPriority, setFilterPriority,
}: {
  filterStatus: Set<TaskStatus>; setFilterStatus: (s: Set<TaskStatus>) => void;
  filterPriority: Set<TaskPriority>; setFilterPriority: (s: Set<TaskPriority>) => void;
}) {
  const [open, setOpen] = useState(false);
  const activeCount = filterStatus.size + filterPriority.size;

  const toggleStatus = (s: TaskStatus) => {
    const next = new Set(filterStatus);
    if (next.has(s)) { next.delete(s); } else { next.add(s); }
    setFilterStatus(next);
  };
  const togglePriority = (p: TaskPriority) => {
    const next = new Set(filterPriority);
    if (next.has(p)) { next.delete(p); } else { next.add(p); }
    setFilterPriority(next);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-1.5 text-xs relative">
          <SlidersHorizontal className="h-3.5 w-3.5" /> Filtro
          {activeCount > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[9px] flex items-center justify-center">
              {activeCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="start">
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">Status</p>
            {(['backlog', 'todo', 'in_progress', 'in_review', 'done'] as TaskStatus[]).map(s => (
              <label key={s} className="flex items-center gap-2 py-1 cursor-pointer">
                <Checkbox checked={filterStatus.has(s)} onCheckedChange={() => toggleStatus(s)} />
                <span className={`text-xs px-2 py-0.5 rounded-sm ${statusCellColors[s]}`}>{statusLabels[s]}</span>
              </label>
            ))}
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">Prioridade</p>
            {(['critical', 'high', 'medium', 'low'] as TaskPriority[]).map(p => (
              <label key={p} className="flex items-center gap-2 py-1 cursor-pointer">
                <Checkbox checked={filterPriority.has(p)} onCheckedChange={() => togglePriority(p)} />
                <span className={`text-xs px-2 py-0.5 rounded-sm ${priorityCellColors[p]}`}>{priorityLabels[p]}</span>
              </label>
            ))}
          </div>
          {activeCount > 0 && (
            <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => { setFilterStatus(new Set()); setFilterPriority(new Set()); }}>
              <X className="h-3 w-3 mr-1" /> Limpar filtros
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SortPopover({ sortField, sortDir, onSort }: {
  sortField: SortField | null; sortDir: SortDir;
  onSort: (field: SortField | null, dir: SortDir) => void;
}) {
  const [open, setOpen] = useState(false);
  const fields: { value: SortField; label: string }[] = [
    { value: 'title', label: 'Nome' },
    { value: 'priority', label: 'Prioridade' },
    { value: 'status', label: 'Status' },
    { value: 'due_date', label: 'Data Ação' },
    { value: 'created_at', label: 'Abertura' },
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className={`gap-1.5 text-xs ${sortField ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
          <ArrowUpDown className="h-3.5 w-3.5" /> Ordenar
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2" align="start">
        {fields.map(f => (
          <button
            key={f.value}
            className={`w-full text-left px-3 py-1.5 text-xs rounded-sm hover:bg-accent ${sortField === f.value ? 'bg-accent font-medium' : ''}`}
            onClick={() => {
              if (sortField === f.value) {
                onSort(f.value, sortDir === 'asc' ? 'desc' : 'asc');
              } else {
                onSort(f.value, 'asc');
              }
              setOpen(false);
            }}
          >
            {f.label} {sortField === f.value && (sortDir === 'asc' ? '↑' : '↓')}
          </button>
        ))}
        {sortField && (
          <button
            className="w-full text-left px-3 py-1.5 text-xs rounded-sm hover:bg-accent text-destructive mt-1"
            onClick={() => { onSort(null, 'asc'); setOpen(false); }}
          >
            <X className="h-3 w-3 inline mr-1" /> Remover ordenação
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

function GroupByPopover({ groupBy, onGroupBy }: { groupBy: GroupBy; onGroupBy: (g: GroupBy) => void }) {
  const [open, setOpen] = useState(false);
  const options: { value: GroupBy; label: string }[] = [
    { value: 'month', label: 'Mês' },
    { value: 'status', label: 'Status' },
    { value: 'priority', label: 'Prioridade' },
    { value: 'none', label: 'Sem agrupamento' },
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-1.5 text-xs">
          <LayoutGrid className="h-3.5 w-3.5" /> Agrupar por
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-44 p-2" align="start">
        {options.map(o => (
          <button
            key={o.value}
            className={`w-full text-left px-3 py-1.5 text-xs rounded-sm hover:bg-accent ${groupBy === o.value ? 'bg-accent font-medium' : ''}`}
            onClick={() => { onGroupBy(o.value); setOpen(false); }}
          >
            {o.label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

const ALL_COLUMNS = ['due_date', 'priority', 'status', 'assignee', 'created_at', 'ticket'] as const;
type ColumnKey = typeof ALL_COLUMNS[number];
const columnLabels: Record<ColumnKey, string> = {
  due_date: 'Data Ação',
  priority: 'Prioridade',
  status: 'Status',
  assignee: 'Responsável',
  created_at: 'Abertura',
  ticket: 'Nº Ticket',
};

function HideColumnsPopover({ visible, onToggle }: { visible: Set<ColumnKey>; onToggle: (col: ColumnKey) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-1.5 text-xs">
          <Eye className="h-3.5 w-3.5" /> Ocultar
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2" align="start">
        {ALL_COLUMNS.map(col => (
          <label key={col} className="flex items-center gap-2 py-1 cursor-pointer px-2">
            <Checkbox checked={visible.has(col)} onCheckedChange={() => onToggle(col)} />
            <span className="text-xs">{columnLabels[col]}</span>
          </label>
        ))}
      </PopoverContent>
    </Popover>
  );
}

// Task row component with expandable subtasks
function TaskRow({
  task,
  parentTask,
  groupColor,
  gridCols,
  visibleColumns,
  profilesMap,
  isSubtask,
  expandedTasks,
  onToggleExpand,
  onClickTask,
  onInlineUpdate,
  onAddSubtask,
}: {
  task: TaskWithAssignees;
  parentTask?: TaskWithAssignees;
  groupColor: string;
  gridCols: string;
  visibleColumns: Set<ColumnKey>;
  profilesMap: Map<string, { full_name: string | null; avatar_url: string | null }>;
  isSubtask?: boolean;
  expandedTasks: Set<string>;
  onToggleExpand: (id: string) => void;
  onClickTask: (task: TaskWithAssignees, parent?: TaskWithAssignees) => void;
  onInlineUpdate: (taskId: string, updates: Record<string, unknown>) => void;
  onAddSubtask: (parentId: string) => void;
}) {
  const isExpanded = expandedTasks.has(task.id);
  const subtaskCount = task.subtasks?.length || 0;
  const hasSubtasks = subtaskCount > 0;

  return (
    <>
      <div
        className={`grid items-center border-b border-border hover:bg-accent/30 cursor-pointer transition-colors text-sm ${isSubtask ? 'bg-muted/20' : ''}`}
        style={{ gridTemplateColumns: gridCols }}
        onClick={() => onClickTask(task, parentTask)}
      >
        <div style={{ backgroundColor: isSubtask ? 'transparent' : groupColor }} className="h-full" />
        <div className="px-3 py-2 flex items-center gap-1.5">
          {!isSubtask && (
            <button
              className="text-muted-foreground hover:text-foreground p-0.5 shrink-0"
              onClick={(e) => { e.stopPropagation(); onToggleExpand(task.id); }}
            >
              {hasSubtasks ? (
                isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />
              ) : (
                <span className="w-3.5" />
              )}
            </button>
          )}
          {isSubtask && <span className="w-6 shrink-0" />}
          <span className={`font-medium text-foreground truncate ${isSubtask ? 'text-xs' : ''}`}>
            {task.title}
          </span>
          {!isSubtask && subtaskCount > 0 && (
            <span className="text-[10px] text-muted-foreground bg-muted rounded px-1.5 py-0.5 shrink-0">
              {subtaskCount}
            </span>
          )}
        </div>
        {visibleColumns.has('due_date') && (
          <span className="px-2 py-1 text-center text-xs text-muted-foreground">
            {formatDateShort(task.due_date)}
          </span>
        )}
        {visibleColumns.has('priority') && (
          <div className="px-1 py-1" onClick={e => e.stopPropagation()}>
            <PriorityCell value={task.priority} onChange={(v) => onInlineUpdate(task.id, { priority: v })} />
          </div>
        )}
        {visibleColumns.has('status') && (
          <div className="px-1 py-1" onClick={e => e.stopPropagation()}>
            <StatusCell value={task.status} onChange={(v) => onInlineUpdate(task.id, { status: v })} />
          </div>
        )}
        {visibleColumns.has('assignee') && (
          <div className="px-1 py-1">
            <AssigneeAvatars assignees={task.task_assignees} profilesMap={profilesMap} />
          </div>
        )}
        {visibleColumns.has('created_at') && (
          <span className="px-2 py-1 text-center text-xs text-muted-foreground">
            {formatDateShort(task.created_at)}
          </span>
        )}
        {visibleColumns.has('ticket') && (
          <span className="px-2 py-1 text-center text-xs text-muted-foreground">
            {task.ticket_number || '—'}
          </span>
        )}
      </div>

      {/* Expanded subtasks */}
      {!isSubtask && isExpanded && (
        <>
          {/* Subtask header */}
          {hasSubtasks && (
            <div
              className="grid items-center bg-muted/30 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border"
              style={{ gridTemplateColumns: gridCols }}
            >
              <div />
              <span className="px-3 py-1.5 pl-10">Subelemento</span>
              {visibleColumns.has('due_date') && <span className="px-2 py-1.5 text-center">Data</span>}
              {visibleColumns.has('priority') && <span className="px-2 py-1.5 text-center">Prioridade</span>}
              {visibleColumns.has('status') && <span className="px-2 py-1.5 text-center">Status</span>}
              {visibleColumns.has('assignee') && <span className="px-2 py-1.5 text-center">Responsável</span>}
              {visibleColumns.has('created_at') && <span className="px-2 py-1.5 text-center">Abertura</span>}
              {visibleColumns.has('ticket') && <span className="px-2 py-1.5 text-center">Ticket</span>}
            </div>
          )}
          {task.subtasks?.map(sub => (
            <TaskRow
              key={sub.id}
              task={sub}
              parentTask={task}
              groupColor={groupColor}
              gridCols={gridCols}
              visibleColumns={visibleColumns}
              profilesMap={profilesMap}
              isSubtask
              expandedTasks={expandedTasks}
              onToggleExpand={onToggleExpand}
              onClickTask={onClickTask}
              onInlineUpdate={onInlineUpdate}
              onAddSubtask={onAddSubtask}
            />
          ))}
          {/* Add subelement button */}
          <button
            onClick={() => onAddSubtask(task.id)}
            className="w-full text-left pl-12 pr-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/20 transition-colors flex items-center gap-1 border-b border-border"
          >
            <Plus className="h-3 w-3" /> Adicionar subelemento
          </button>
        </>
      )}
    </>
  );
}

export default function TableViewPage() {
  const { data: projects, isLoading: loadingProjects } = useProjects();
  const createProject = useCreateProject();
  const [searchParams, setSearchParams] = useSearchParams();
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [sidePanelTask, setSidePanelTask] = useState<{ task: TaskWithAssignees; parent?: TaskWithAssignees } | null>(null);
  const [searchText, setSearchText] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<Set<TaskStatus>>(new Set());
  const [filterPriority, setFilterPriority] = useState<Set<TaskPriority>>(new Set());
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [groupBy, setGroupBy] = useState<GroupBy>('month');
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(new Set(ALL_COLUMNS));

  const projectFromUrl = searchParams.get('projeto');
  const activeProjectId = projectFromUrl || projects?.[0]?.id;
  const { tasks, isLoading: loadingTasks, addTask, updateTask } = useProjectTasks(activeProjectId);

  const allAssigneeIds = useMemo(() => {
    const ids = new Set<string>();
    tasks.forEach(t => {
      t.task_assignees.forEach(a => ids.add(a.user_id));
      t.subtasks?.forEach(sub => sub.task_assignees.forEach(a => ids.add(a.user_id)));
    });
    return Array.from(ids);
  }, [tasks]);

  const { data: profilesMap } = useAssigneeProfiles(allAssigneeIds);

  // Apply filters (on parent tasks only, subtasks follow parent)
  const filteredTasks = useMemo(() => {
    let result = tasks;
    if (searchText.trim()) {
      const lower = searchText.toLowerCase();
      result = result.filter(t => t.title.toLowerCase().includes(lower) || t.subtasks?.some(s => s.title.toLowerCase().includes(lower)));
    }
    if (filterStatus.size > 0) {
      result = result.filter(t => filterStatus.has(t.status));
    }
    if (filterPriority.size > 0) {
      result = result.filter(t => filterPriority.has(t.priority));
    }
    return result;
  }, [tasks, searchText, filterStatus, filterPriority]);

  // Apply sorting
  const sortedTasks = useMemo(() => {
    if (!sortField) return filteredTasks;
    return [...filteredTasks].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'title': cmp = a.title.localeCompare(b.title, 'pt-BR'); break;
        case 'priority': cmp = priorityOrder[a.priority] - priorityOrder[b.priority]; break;
        case 'status': cmp = statusOrder[a.status] - statusOrder[b.status]; break;
        case 'due_date': cmp = (a.due_date || '').localeCompare(b.due_date || ''); break;
        case 'created_at': cmp = a.created_at.localeCompare(b.created_at); break;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });
  }, [filteredTasks, sortField, sortDir]);

  // Apply grouping
  const groups = useMemo(() => {
    const grouped = new Map<string, TaskWithAssignees[]>();

    sortedTasks.forEach(task => {
      let key: string;
      switch (groupBy) {
        case 'month': key = getMonthYearKey(task.due_date || task.created_at); break;
        case 'status': key = task.status; break;
        case 'priority': key = task.priority; break;
        case 'none': key = 'all'; break;
      }
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(task);
    });

    const entries = Array.from(grouped.entries()).sort(([a], [b]) => {
      if (groupBy === 'status') return statusOrder[a as TaskStatus] - statusOrder[b as TaskStatus];
      if (groupBy === 'priority') return priorityOrder[a as TaskPriority] - priorityOrder[b as TaskPriority];
      return a.localeCompare(b);
    });

    return entries.map(([key, tsks], i) => {
      let label: string;
      switch (groupBy) {
        case 'month': label = getMonthYearLabel(key); break;
        case 'status': label = statusLabels[key as TaskStatus] || key; break;
        case 'priority': label = priorityLabels[key as TaskPriority] || key; break;
        case 'none': label = 'Todos os elementos'; break;
      }
      return { key, label, tasks: tsks, color: groupColors[i % groupColors.length] };
    });
  }, [sortedTasks, groupBy]);

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      return next;
    });
  };

  const toggleExpand = useCallback((taskId: string) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) { next.delete(taskId); } else { next.add(taskId); }
      return next;
    });
  }, []);

  const toggleColumn = useCallback((col: ColumnKey) => {
    setVisibleColumns(prev => {
      const next = new Set(prev);
      if (next.has(col)) { next.delete(col); } else { next.add(col); }
      return next;
    });
  }, []);

  const setSelectedProject = (id: string) => setSearchParams({ projeto: id });

  const handleCreateProject = () => {
    const name = prompt('Nome do projeto:');
    if (name?.trim()) {
      createProject.mutate(
        { name: name.trim() },
        { onSuccess: (project) => { setSelectedProject(project.id); toast.success('Projeto criado!'); } }
      );
    }
  };

  const handleQuickAdd = (status: TaskStatus = 'todo', parentId?: string) => {
    const title = prompt(parentId ? 'Título do subelemento:' : 'Título da tarefa:');
    if (title?.trim()) {
      addTask.mutate(
        { title: title.trim(), status, priority: 'medium', parent_task_id: parentId },
        { onSuccess: () => toast.success(parentId ? 'Subelemento criado!' : 'Tarefa criada!') }
      );
    }
  };

  const handleInlineUpdate = (taskId: string, updates: Record<string, unknown>) => {
    updateTask.mutate({ taskId, updates });
  };

  const handleClickTask = (task: TaskWithAssignees, parent?: TaskWithAssignees) => {
    setSidePanelTask({ task, parent });
  };

  // Build grid template based on visible columns
  const gridCols = useMemo(() => {
    const cols = ['3px', '1fr'];
    if (visibleColumns.has('due_date')) cols.push('110px');
    if (visibleColumns.has('priority')) cols.push('100px');
    if (visibleColumns.has('status')) cols.push('120px');
    if (visibleColumns.has('assignee')) cols.push('100px');
    if (visibleColumns.has('created_at')) cols.push('100px');
    if (visibleColumns.has('ticket')) cols.push('100px');
    return cols.join(' ');
  }, [visibleColumns]);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-3">
        {projects && projects.length > 0 ? (
          <Select value={activeProjectId} onValueChange={setSelectedProject}>
            <SelectTrigger className="w-auto border-0 bg-transparent text-xl font-bold text-foreground h-auto py-0 gap-2">
              <SelectValue placeholder="Selecione um projeto" />
            </SelectTrigger>
            <SelectContent>
              {[...projects].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true })).map(p => (
                <SelectItem key={p.id} value={p.id}>
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                    {p.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <h1 className="text-xl font-bold text-foreground">Quadro Principal</h1>
        )}
      </div>

      {/* Toolbar */}
      {activeProjectId && (
        <div className="flex items-center gap-1 flex-wrap bg-card/50 rounded-lg px-2 py-1.5 border border-border">
          <Button onClick={() => handleQuickAdd('todo')} size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-md font-medium text-xs h-8">
            <Plus className="h-3.5 w-3.5 mr-1" /> Criar elemento
          </Button>
          <div className="h-5 w-px bg-border mx-1" />
          <Button variant="ghost" size="sm" className={`gap-1.5 text-xs h-8 ${searchOpen ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`} onClick={() => { setSearchOpen(!searchOpen); if (searchOpen) setSearchText(''); }}>
            <Search className="h-3.5 w-3.5" /> Pesquisar
          </Button>
          <FilterPopover filterStatus={filterStatus} setFilterStatus={setFilterStatus} filterPriority={filterPriority} setFilterPriority={setFilterPriority} />
          <SortPopover sortField={sortField} sortDir={sortDir} onSort={(f, d) => { setSortField(f); setSortDir(d); }} />
          <HideColumnsPopover visible={visibleColumns} onToggle={toggleColumn} />
          <GroupByPopover groupBy={groupBy} onGroupBy={setGroupBy} />
        </div>
      )}

      {searchOpen && (
        <div className="flex items-center gap-2 px-1">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar elementos..." value={searchText} onChange={e => setSearchText(e.target.value)} className="max-w-sm h-8 text-sm" autoFocus />
          {searchText && (
            <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => setSearchText('')}>
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}

      {(loadingProjects || loadingTasks) && (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {!loadingProjects && (!projects || projects.length === 0) ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <FolderKanban className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-1">Nenhum projeto ainda</h3>
          <p className="text-muted-foreground text-sm mb-4">Crie seu primeiro projeto para começar</p>
          <Button onClick={handleCreateProject}><Plus className="h-4 w-4 mr-1" /> Criar Projeto</Button>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => {
            const isCollapsed = collapsedGroups.has(group.key);
            return (
              <div key={group.key}>
                <button onClick={() => toggleGroup(group.key)} className="flex items-center gap-2 mb-1">
                  {isCollapsed
                    ? <ChevronRight className="h-4 w-4" style={{ color: group.color }} />
                    : <ChevronDown className="h-4 w-4" style={{ color: group.color }} />}
                  <span className="text-sm font-bold tracking-wide" style={{ color: group.color }}>{group.label}</span>
                  <span className="text-xs text-muted-foreground ml-1">{group.tasks.length} elementos</span>
                </button>

                {!isCollapsed && (
                  <div className="rounded-lg overflow-hidden border border-border">
                    {/* Column headers */}
                    <div className="grid items-center bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border" style={{ gridTemplateColumns: gridCols }}>
                      <div style={{ backgroundColor: group.color }} className="h-full" />
                      <span className="px-3 py-2">Elemento</span>
                      {visibleColumns.has('due_date') && <span className="px-2 py-2 text-center">Data Ação</span>}
                      {visibleColumns.has('priority') && <span className="px-2 py-2 text-center">Prioridade</span>}
                      {visibleColumns.has('status') && <span className="px-2 py-2 text-center">Status</span>}
                      {visibleColumns.has('assignee') && <span className="px-2 py-2 text-center">Responsável</span>}
                      {visibleColumns.has('created_at') && <span className="px-2 py-2 text-center">Abertura</span>}
                      {visibleColumns.has('ticket') && <span className="px-2 py-2 text-center">Nº Ticket</span>}
                    </div>

                    {/* Task rows with expandable subtasks */}
                    {group.tasks.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        groupColor={group.color}
                        gridCols={gridCols}
                        visibleColumns={visibleColumns}
                        profilesMap={profilesMap || new Map()}
                        expandedTasks={expandedTasks}
                        onToggleExpand={toggleExpand}
                        onClickTask={handleClickTask}
                        onInlineUpdate={handleInlineUpdate}
                        onAddSubtask={(parentId) => handleQuickAdd('todo', parentId)}
                      />
                    ))}

                    {/* Add element */}
                    <button
                      onClick={() => handleQuickAdd('todo')}
                      className="w-full text-left px-6 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/20 transition-colors flex items-center gap-1.5 border-b border-border"
                    >
                      <Plus className="h-3.5 w-3.5" /> Adicionar elemento
                    </button>

                    {/* Summary row */}
                    <div className="grid items-center bg-muted/20" style={{ gridTemplateColumns: gridCols }}>
                      <div style={{ backgroundColor: group.color }} className="h-full" />
                      <span className="px-3 py-1.5" />
                      {visibleColumns.has('due_date') && <span className="px-2 py-1.5" />}
                      {visibleColumns.has('priority') && (
                        <div className="px-1 py-1.5 flex gap-0.5">
                          {(['critical', 'high', 'medium', 'low'] as TaskPriority[]).map(p => {
                            const count = group.tasks.filter(t => t.priority === p).length;
                            if (count === 0) return null;
                            return <div key={p} className={`h-5 rounded-sm ${priorityCellColors[p]}`} style={{ flex: count }} title={`${priorityLabels[p]}: ${count}`} />;
                          })}
                        </div>
                      )}
                      {visibleColumns.has('status') && (
                        <div className="px-1 py-1.5 flex gap-0.5">
                          {(['done', 'in_progress', 'in_review', 'todo', 'backlog'] as TaskStatus[]).map(s => {
                            const count = group.tasks.filter(t => t.status === s).length;
                            if (count === 0) return null;
                            return <div key={s} className={`h-5 rounded-sm ${statusCellColors[s]}`} style={{ flex: count }} title={`${statusLabels[s]}: ${count}`} />;
                          })}
                        </div>
                      )}
                      {visibleColumns.has('assignee') && <span className="px-2 py-1.5" />}
                      {visibleColumns.has('created_at') && <span className="px-2 py-1.5" />}
                      {visibleColumns.has('ticket') && <span className="px-2 py-1.5" />}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {sortedTasks.length === 0 && !loadingTasks && activeProjectId && (
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="text-center py-12 text-muted-foreground text-sm">
                {searchText || filterStatus.size || filterPriority.size
                  ? 'Nenhum resultado encontrado com os filtros aplicados.'
                  : 'Nenhuma tarefa ainda. Clique em "Criar elemento" para começar.'}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Side panel instead of modal */}
      {sidePanelTask && activeProjectId && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setSidePanelTask(null)} />
          <TaskSidePanel
            task={sidePanelTask.task}
            parentTask={sidePanelTask.parent}
            projectId={activeProjectId}
            open={!!sidePanelTask}
            onClose={() => setSidePanelTask(null)}
            onUpdate={(updates) => {
              updateTask.mutate({ taskId: sidePanelTask.task.id, updates });
            }}
          />
        </>
      )}
    </div>
  );
}
