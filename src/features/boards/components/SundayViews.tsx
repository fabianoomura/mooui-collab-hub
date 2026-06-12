import { useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Archive, Trash2, GanttChart, CalendarDays } from 'lucide-react';
import { type TaskStatus, type TaskWithAssignees } from '@/hooks/useProjectData';
import { type ProjectColumn } from '@/hooks/useProjectColumns';
import { ColumnCell } from '../columns';
import { AssigneePickerCell } from './TableCells';
import {
  statusLabels, statusCellColors, priorityLabels, priorityCellColors,
  formatDateShort, getMonthYearKey, getMonthYearLabel, taskDate,
} from '../constants';

export function SundayTaskMiniCard({
  task, profilesMap, projectMembers, onOpen, onArchive, onDelete, onStatusChange, onAddAssignee, onRemoveAssignee,
  cardColumns, customValues, onSetCustomValue,
}: {
  task: TaskWithAssignees;
  profilesMap: Map<string, { full_name: string | null; avatar_url: string | null }>;
  projectMembers: { user_id: string; profile: { full_name: string | null } | null }[];
  onOpen: (task: TaskWithAssignees) => void;
  onArchive: (task: TaskWithAssignees) => void;
  onDelete: (task: TaskWithAssignees) => void;
  onStatusChange?: (taskId: string, status: TaskStatus) => void;
  onAddAssignee: (taskId: string, userId: string) => void;
  onRemoveAssignee: (taskId: string, userId: string) => void;
  cardColumns?: ProjectColumn[];
  customValues?: Map<string, Map<string, string>>;
  onSetCustomValue?: (taskId: string, columnId: string, value: string) => void;
}) {
  const taskValues = customValues?.get(task.id);
  return (
    <div className="group rounded-md border bg-card p-3 shadow-sm hover:border-primary/40 transition-colors cursor-pointer" onClick={() => onOpen(task)}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground line-clamp-2">{task.title}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${priorityCellColors[task.priority]}`}>{priorityLabels[task.priority]}</span>
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${statusCellColors[task.status]}`}>{statusLabels[task.status]}</span>
            {task.due_date && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{formatDateShort(task.due_date)}</span>}
            {(task.subtasks?.length || 0) > 0 && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{task.subtasks?.length} sub</span>}
          </div>
        </div>
        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5">
          <button className="text-muted-foreground hover:text-foreground p-1" onClick={(e) => { e.stopPropagation(); onArchive(task); }} title="Arquivar elemento">
            <Archive className="h-3.5 w-3.5" />
          </button>
          <button className="text-muted-foreground hover:text-destructive p-1" onClick={(e) => { e.stopPropagation(); onDelete(task); }} title="Excluir elemento">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {cardColumns && cardColumns.length > 0 && (
        <div className="mt-2 space-y-0.5" onClick={e => e.stopPropagation()}>
          {cardColumns.map(col => (
            <div key={col.id} className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground shrink-0 w-16 truncate">{col.name}</span>
              <div className="flex-1 min-w-0">
                <ColumnCell value={taskValues?.get(col.id) || ''} column={col} onChange={(v) => onSetCustomValue?.(task.id, col.id, v)} compact />
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="w-[112px]" onClick={(e) => e.stopPropagation()}>
          <AssigneePickerCell task={task} profilesMap={profilesMap} projectMembers={projectMembers} onAdd={onAddAssignee} onRemove={onRemoveAssignee} />
        </div>
        {onStatusChange && (
          <Select value={task.status} onValueChange={(value) => onStatusChange(task.id, value as TaskStatus)}>
            <SelectTrigger className="h-7 w-[118px] text-xs" onClick={(e) => e.stopPropagation()}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(['backlog', 'todo', 'in_progress', 'in_review', 'done'] as TaskStatus[]).map(status => (
                <SelectItem key={status} value={status}>{statusLabels[status]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}

export function SundayKanbanView({
  tasks, profilesMap, projectMembers, onOpen, onArchive, onDelete, onStatusChange, onQuickAdd, onAddAssignee, onRemoveAssignee,
  cardColumns, customValues, onSetCustomValue,
}: {
  tasks: TaskWithAssignees[];
  profilesMap: Map<string, { full_name: string | null; avatar_url: string | null }>;
  projectMembers: { user_id: string; profile: { full_name: string | null } | null }[];
  onOpen: (task: TaskWithAssignees) => void;
  onArchive: (task: TaskWithAssignees) => void;
  onDelete: (task: TaskWithAssignees) => void;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onQuickAdd: (status: TaskStatus) => void;
  onAddAssignee: (taskId: string, userId: string) => void;
  onRemoveAssignee: (taskId: string, userId: string) => void;
  cardColumns?: ProjectColumn[];
  customValues?: Map<string, Map<string, string>>;
  onSetCustomValue?: (taskId: string, columnId: string, value: string) => void;
}) {
  const columns = (['backlog', 'todo', 'in_progress', 'in_review', 'done'] as TaskStatus[]).map(status => ({
    status,
    tasks: tasks.filter(task => task.status === status),
  }));

  return (
    <div className="flex gap-3 overflow-x-auto pb-3 snap-x snap-mandatory sm:snap-none">
      {columns.map(({ status, tasks: columnTasks }) => (
        <div key={status} className="w-[85vw] sm:w-72 shrink-0 snap-start">
          <div className="mb-2 flex items-center justify-between rounded-md border bg-card px-3 py-2">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${statusCellColors[status].split(' ')[0]}`} />
              <span className="text-sm font-semibold">{statusLabels[status]}</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{columnTasks.length}</span>
            </div>
            <button className="text-muted-foreground hover:text-foreground" onClick={() => onQuickAdd(status)} title="Adicionar elemento">
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-2 rounded-md bg-muted/25 p-2 min-h-[220px]">
            {columnTasks.map(task => (
              <SundayTaskMiniCard
                key={task.id} task={task} profilesMap={profilesMap} projectMembers={projectMembers}
                onOpen={onOpen} onArchive={onArchive} onDelete={onDelete} onStatusChange={onStatusChange}
                onAddAssignee={onAddAssignee} onRemoveAssignee={onRemoveAssignee}
                cardColumns={cardColumns} customValues={customValues} onSetCustomValue={onSetCustomValue}
              />
            ))}
            {columnTasks.length === 0 && (
              <button onClick={() => onQuickAdd(status)} className="w-full rounded-md border border-dashed py-8 text-xs text-muted-foreground hover:text-foreground hover:bg-background">
                + Adicionar elemento
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function SundayTimelineView({
  tasks, profilesMap, projectMembers, onOpen, onArchive, onDelete, onAddAssignee, onRemoveAssignee,
}: {
  tasks: TaskWithAssignees[];
  profilesMap: Map<string, { full_name: string | null; avatar_url: string | null }>;
  projectMembers: { user_id: string; profile: { full_name: string | null } | null }[];
  onOpen: (task: TaskWithAssignees) => void;
  onArchive: (task: TaskWithAssignees) => void;
  onDelete: (task: TaskWithAssignees) => void;
  onAddAssignee: (taskId: string, userId: string) => void;
  onRemoveAssignee: (taskId: string, userId: string) => void;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, TaskWithAssignees[]>();
    tasks.forEach(task => {
      const key = getMonthYearKey(taskDate(task));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(task);
    });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, items]) => ({
      key,
      label: getMonthYearLabel(key),
      items: items.sort((a, b) => (taskDate(a) || '').localeCompare(taskDate(b) || '')),
    }));
  }, [tasks]);

  return (
    <div className="space-y-4">
      {groups.map(group => (
        <div key={group.key} className="rounded-lg border bg-card/40">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <GanttChart className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">{group.label}</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{group.items.length}</span>
          </div>
          <div className="divide-y">
            {group.items.map(task => (
              <div key={task.id} className="group flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 min-h-[44px] hover:bg-muted/40 cursor-pointer" onClick={() => onOpen(task)}>
                <div className="w-14 sm:w-20 text-xs text-muted-foreground shrink-0">{formatDateShort(taskDate(task))}</div>
                <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${statusCellColors[task.status].split(' ')[0]}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{task.title}</p>
                  <p className="text-xs text-muted-foreground">{statusLabels[task.status]} · {priorityLabels[task.priority]}</p>
                </div>
                <div className="hidden sm:block w-[112px]" onClick={(e) => e.stopPropagation()}>
                  <AssigneePickerCell task={task} profilesMap={profilesMap} projectMembers={projectMembers} onAdd={onAddAssignee} onRemove={onRemoveAssignee} />
                </div>
                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5">
                  <button className="text-muted-foreground hover:text-foreground p-1" onClick={(e) => { e.stopPropagation(); onArchive(task); }} title="Arquivar elemento">
                    <Archive className="h-3.5 w-3.5" />
                  </button>
                  <button className="text-muted-foreground hover:text-destructive p-1" onClick={(e) => { e.stopPropagation(); onDelete(task); }} title="Excluir elemento">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function SundayCalendarView({
  tasks, onOpen,
}: {
  tasks: TaskWithAssignees[];
  onOpen: (task: TaskWithAssignees) => void;
}) {
  const months = useMemo(() => {
    const map = new Map<string, TaskWithAssignees[]>();
    tasks.filter(task => taskDate(task)).forEach(task => {
      const key = getMonthYearKey(taskDate(task));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(task);
    });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(0, 6);
  }, [tasks]);

  if (months.length === 0) {
    return <div className="rounded-lg border py-12 text-center text-sm text-muted-foreground">Nenhum elemento com data para exibir no calendário.</div>;
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {months.map(([key, monthTasks]) => {
        const [year, month] = key.split('-').map(Number);
        const first = new Date(year, month, 1);
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const startWeekday = first.getDay();
        const byDay = new Map<number, TaskWithAssignees[]>();
        monthTasks.forEach(task => {
          const date = new Date(`${taskDate(task)}T00:00:00`);
          const day = date.getDate();
          if (!byDay.has(day)) byDay.set(day, []);
          byDay.get(day)!.push(task);
        });
        const cells = [
          ...Array.from({ length: startWeekday }, () => null),
          ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
        ];
        return (
          <div key={key} className="rounded-lg border bg-card/40 overflow-hidden">
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <CalendarDays className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">{getMonthYearLabel(key)}</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{monthTasks.length}</span>
            </div>
            <div className="grid grid-cols-7 border-b bg-muted/30 text-center text-[10px] font-semibold uppercase text-muted-foreground">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'].map(day => <div key={day} className="py-2">{day}</div>)}
            </div>
            <div className="grid grid-cols-7">
              {cells.map((day, index) => {
                const dayTasks = day ? byDay.get(day) || [] : [];
                return (
                  <div key={`${key}-${index}`} className="min-h-[96px] border-r border-b p-1.5 last:border-r-0">
                    {day && <div className="mb-1 text-xs font-medium text-muted-foreground">{day}</div>}
                    <div className="space-y-1">
                      {dayTasks.slice(0, 3).map(task => (
                        <button key={task.id} className={`block w-full truncate rounded px-1.5 py-1 text-left text-[10px] font-medium ${statusCellColors[task.status]}`} onClick={() => onOpen(task)} title={task.title}>
                          {task.title}
                        </button>
                      ))}
                      {dayTasks.length > 3 && <span className="block text-[10px] text-muted-foreground">+{dayTasks.length - 3}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
