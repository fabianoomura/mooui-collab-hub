import { type TaskStatus, type TaskPriority, type TaskWithAssignees } from '@/hooks/useProjectData';
import { type ColumnType } from '@/hooks/useProjectColumns';
import { Type, Hash, Calendar, Tag, Users, BarChart3, CheckSquare, Link2, Star, ListFilter } from 'lucide-react';

// ── Status ────────────────────────────────────────────────────────────────────

export const statusLabels: Record<TaskStatus, string> = {
  backlog: 'Backlog',
  todo: 'Não Iniciado',
  in_progress: 'Em Andamento',
  in_review: 'Em Revisão',
  done: 'Feito',
};

export const statusCellColors: Record<TaskStatus, string> = {
  backlog: 'bg-[hsl(var(--muted))] text-muted-foreground',
  todo: 'bg-[hsl(220,80%,55%)] text-white',
  in_progress: 'bg-[hsl(35,90%,55%)] text-white',
  in_review: 'bg-[hsl(280,60%,55%)] text-white',
  done: 'bg-[hsl(145,60%,42%)] text-white',
};

export const statusOrder: Record<TaskStatus, number> = {
  backlog: 0,
  todo: 1,
  in_progress: 2,
  in_review: 3,
  done: 4,
};

// ── Priority ──────────────────────────────────────────────────────────────────

export const priorityLabels: Record<TaskPriority, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  critical: 'Crítica',
};

export const priorityCellColors: Record<TaskPriority, string> = {
  low: 'bg-[hsl(210,15%,50%)] text-white',
  medium: 'bg-[hsl(35,70%,50%)] text-white',
  high: 'bg-[hsl(10,75%,55%)] text-white',
  critical: 'bg-[hsl(0,85%,45%)] text-white',
};

export const priorityOrder: Record<TaskPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

// ── Column types ──────────────────────────────────────────────────────────────

export const columnTypeLabels: Record<ColumnType, string> = {
  status: 'Status',
  texto: 'Texto',
  pessoas: 'Pessoas',
  cronograma: 'Cronograma',
  data: 'Data',
  tags: 'Tags',
  numeros: 'Números',
  checkbox: 'Checkbox',
  link: 'Link',
  rating: 'Avaliação',
  select: 'Seleção',
};

export const columnTypeIcons: Record<ColumnType, typeof Type> = {
  status: BarChart3,
  texto: Type,
  pessoas: Users,
  cronograma: Calendar,
  data: Calendar,
  tags: Tag,
  numeros: Hash,
  checkbox: CheckSquare,
  link: Link2,
  rating: Star,
  select: ListFilter,
};

// ── Fixed columns ─────────────────────────────────────────────────────────────

export const FIXED_COLUMNS = ['due_date', 'priority', 'status', 'assignee', 'created_at', 'ticket'] as const;
export type FixedColumnKey = typeof FIXED_COLUMNS[number];

export const fixedColumnLabels: Record<FixedColumnKey, string> = {
  due_date: 'Data Ação',
  priority: 'Prioridade',
  status: 'Status',
  assignee: 'Responsável',
  created_at: 'Abertura',
  ticket: 'Nº Ticket',
};

// ── Grouping / sorting ────────────────────────────────────────────────────────

export const groupColors = [
  'hsl(280, 60%, 55%)',
  'hsl(200, 80%, 50%)',
  'hsl(145, 60%, 42%)',
  'hsl(35, 90%, 55%)',
  'hsl(0, 75%, 55%)',
  'hsl(320, 70%, 50%)',
];

export const monthNames = [
  'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
  'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO',
];

// ── View / sort types ─────────────────────────────────────────────────────────

export type SortField = 'title' | 'priority' | 'status' | 'due_date' | 'created_at';
export type SortDir = 'asc' | 'desc';
export type GroupBy = 'month' | 'status' | 'priority' | 'none';
export type ViewMode = 'table' | 'kanban' | 'timeline' | 'calendar';

// ── Utility functions ─────────────────────────────────────────────────────────

export function getInitials(name: string | null): string {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

export function formatDateShort(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

export function getMonthYearKey(dateStr: string | null): string {
  if (!dateStr) return 'sem-data';
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
}

export function getMonthYearLabel(key: string): string {
  if (key === 'sem-data') return 'Sem Data';
  const [year, month] = key.split('-').map(Number);
  return `${monthNames[month]} - ${year}`;
}

export function taskMatchesAssignee(task: TaskWithAssignees, assignees: Set<string>): boolean {
  return task.task_assignees.some(a => assignees.has(a.user_id)) ||
    (task.subtasks?.some(sub => sub.task_assignees.some(a => assignees.has(a.user_id))) ?? false);
}

export function taskMatchesSearch(task: TaskWithAssignees, lower: string): boolean {
  return task.title.toLowerCase().includes(lower) ||
    (task.ticket_number || '').toLowerCase().includes(lower) ||
    (task.subtasks?.some(s => s.title.toLowerCase().includes(lower)) ?? false);
}

export function taskDate(task: TaskWithAssignees): string | null {
  return task.due_date || task.start_date || task.created_at?.slice(0, 10) || null;
}
