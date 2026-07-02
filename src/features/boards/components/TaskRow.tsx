import { useState } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from '@/components/ui/dropdown-menu';
import { ChevronDown, ChevronRight, Plus, MoreHorizontal, Trash2, CornerDownRight, ArrowUp, Archive, Outdent, MessageCircle, Pin } from 'lucide-react';
import { type TaskWithAssignees, type TaskStatus, type TaskPriority } from '@/hooks/useProjectData';
import { type ProjectColumn } from '@/hooks/useProjectColumns';
import { type LabelOption } from '@/components/table/LabelEditor';
import { Checkbox } from '@/components/ui/checkbox';
import { DateRangeCell } from '@/components/table/DateRangeCell';
import { ColumnCell } from '../columns';
import { StatusCell, PriorityCell, AssigneePickerCell } from './TableCells';
import { formatDateShort, fixedColumnLabels, type FixedColumnKey } from '../constants';

function FixedCell({ col, task, onInlineUpdate, profilesMap, projectMembers, onAddAssignee, onRemoveAssignee, statusLabelsConfig, priorityLabelsConfig, onEditStatusLabels, onEditPriorityLabels }: {
  col: FixedColumnKey;
  task: TaskWithAssignees;
  onInlineUpdate: (taskId: string, updates: Record<string, unknown>) => void;
  profilesMap: Map<string, { full_name: string | null; avatar_url: string | null }>;
  projectMembers: { user_id: string; profile: { full_name: string | null } | null }[];
  onAddAssignee: (taskId: string, userId: string) => void;
  onRemoveAssignee: (taskId: string, userId: string) => void;
  statusLabelsConfig?: LabelOption[];
  priorityLabelsConfig?: LabelOption[];
  onEditStatusLabels?: () => void;
  onEditPriorityLabels?: () => void;
}) {
  const subtaskCount = task.subtasks?.length || 0;
  const doneSubtaskCount = task.subtasks?.filter(subtask => subtask.status === 'done').length || 0;
  const completionPercent = subtaskCount > 0 ? Math.round((doneSubtaskCount / subtaskCount) * 100) : null;

  switch (col) {
    case 'due_date':
      return (
        <div className="px-1 py-1" onClick={e => e.stopPropagation()}>
          <DateRangeCell startDate={(task as any).start_date || null} endDate={task.due_date} completionPercent={completionPercent} onChange={(s, e) => onInlineUpdate(task.id, { start_date: s, due_date: e } as any)} />
        </div>
      );
    case 'priority':
      return <div className="px-1 py-1" onClick={e => e.stopPropagation()}><PriorityCell value={task.priority} onChange={(v) => onInlineUpdate(task.id, { priority: v })} customLabels={priorityLabelsConfig} onEditLabels={onEditPriorityLabels} /></div>;
    case 'status':
      return <div className="px-1 py-1" onClick={e => e.stopPropagation()}><StatusCell value={task.status} onChange={(v) => onInlineUpdate(task.id, { status: v })} customLabels={statusLabelsConfig} onEditLabels={onEditStatusLabels} /></div>;
    case 'assignee':
      return <div className="px-1 py-1" onClick={e => e.stopPropagation()}><AssigneePickerCell task={task} profilesMap={profilesMap} projectMembers={projectMembers} onAdd={onAddAssignee} onRemove={onRemoveAssignee} /></div>;
    case 'created_at':
      return <span className="px-2 py-1 text-center text-xs text-muted-foreground">{formatDateShort(task.created_at)}</span>;
    case 'ticket':
      return <span className="px-2 py-1 text-center text-xs text-muted-foreground">{task.ticket_number || '—'}</span>;
  }
}

const subHeaderLabels: Record<FixedColumnKey, string> = {
  due_date: 'Data', priority: 'Prioridade', status: 'Status',
  assignee: 'Responsável', created_at: 'Abertura', ticket: 'Ticket',
};

export function TaskRow({
  task, parentTask, groupColor, gridCols, orderedColumns, profilesMap, isSubtask,
  expandedTasks, onToggleExpand, onClickTask, onInlineUpdate, onAddSubtask,
  dynamicColumns, customValues, onSetCustomValue,
  statusLabelsConfig, priorityLabelsConfig, onEditStatusLabels, onEditPriorityLabels,
  projectMembers, onAddAssignee, onRemoveAssignee,
  allTopLevelTasks, onMoveToParent, onPromoteToTopLevel, onArchiveTask, onDeleteTask,
  draggedTaskId, onDragStartTask, onDragEndTask,
  commentCounts, isPinned, onTogglePin, availableGroups, onMoveToGroup,
}: {
  task: TaskWithAssignees;
  parentTask?: TaskWithAssignees;
  groupColor: string;
  gridCols: string;
  orderedColumns: FixedColumnKey[];
  profilesMap: Map<string, { full_name: string | null; avatar_url: string | null }>;
  isSubtask?: boolean;
  expandedTasks: Set<string>;
  onToggleExpand: (id: string) => void;
  onClickTask: (task: TaskWithAssignees, parent?: TaskWithAssignees) => void;
  onInlineUpdate: (taskId: string, updates: Record<string, unknown>) => void;
  onAddSubtask: (parentId: string) => void;
  dynamicColumns: ProjectColumn[];
  customValues: Map<string, Map<string, string>>;
  onSetCustomValue: (taskId: string, columnId: string, value: string) => void;
  statusLabelsConfig?: LabelOption[];
  priorityLabelsConfig?: LabelOption[];
  onEditStatusLabels?: () => void;
  onEditPriorityLabels?: () => void;
  projectMembers: { user_id: string; profile: { full_name: string | null } | null }[];
  onAddAssignee: (taskId: string, userId: string) => void;
  onRemoveAssignee: (taskId: string, userId: string) => void;
  allTopLevelTasks: TaskWithAssignees[];
  onMoveToParent: (taskId: string, parentId: string) => void;
  onPromoteToTopLevel: (taskId: string) => void;
  onArchiveTask: (task: TaskWithAssignees) => void;
  onDeleteTask: (task: TaskWithAssignees) => void;
  draggedTaskId: string | null;
  onDragStartTask: (id: string) => void;
  onDragEndTask: () => void;
  commentCounts?: Map<string, number>;
  isPinned?: boolean;
  onTogglePin?: (taskId: string) => void;
  availableGroups?: { key: string; label: string }[];
  onMoveToGroup?: (taskId: string, groupKey: string | null) => void;
}) {
  const isExpanded = expandedTasks.has(task.id);
  const subtaskCount = task.subtasks?.length || 0;
  const hasSubtasks = subtaskCount > 0;
  const [isDragOver, setIsDragOver] = useState(false);
  const commentCount = commentCounts?.get(task.id) || 0;

  const taskValues = customValues.get(task.id) || new Map<string, string>();
  const canBeDropTarget = !isSubtask && draggedTaskId !== null && draggedTaskId !== task.id;

  const cellProps = {
    onInlineUpdate, profilesMap, projectMembers, onAddAssignee, onRemoveAssignee,
    statusLabelsConfig, priorityLabelsConfig, onEditStatusLabels, onEditPriorityLabels,
  };

  return (
    <>
      <div
        draggable
        onDragStart={(e) => { e.stopPropagation(); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', task.id); onDragStartTask(task.id); }}
        onDragEnd={(e) => { e.stopPropagation(); setIsDragOver(false); onDragEndTask(); }}
        onDragOver={(e) => { if (!canBeDropTarget || e.dataTransfer.types.includes('application/col-key')) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (!isDragOver) setIsDragOver(true); }}
        onDragLeave={() => { if (isDragOver) setIsDragOver(false); }}
        onDrop={(e) => {
          if (!canBeDropTarget || e.dataTransfer.types.includes('application/col-key')) return;
          e.preventDefault(); e.stopPropagation(); setIsDragOver(false);
          const draggedId = e.dataTransfer.getData('text/plain') || draggedTaskId;
          if (draggedId && draggedId !== task.id) onMoveToParent(draggedId, task.id);
        }}
        className={`group grid items-center border-b border-border hover:bg-accent/30 cursor-pointer transition-colors text-sm ${isSubtask ? 'bg-muted/20' : ''} ${isDragOver ? 'ring-2 ring-primary ring-inset bg-primary/5' : ''} ${draggedTaskId === task.id ? 'opacity-40' : ''}`}
        style={{ gridTemplateColumns: gridCols }}
        onClick={() => onClickTask(task, parentTask)}
      >
        <div style={{ backgroundColor: isSubtask ? 'transparent' : groupColor }} className="h-full" />
        <div className="px-3 py-2 flex items-center gap-1.5">
          {!isSubtask && (
            <button className="text-muted-foreground hover:text-foreground p-0.5 shrink-0" onClick={(e) => { e.stopPropagation(); onToggleExpand(task.id); }}>
              {hasSubtasks ? (isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />) : <span className="w-3.5" />}
            </button>
          )}
          {isSubtask && (
            <>
              <button
                className="w-6 shrink-0 flex items-center justify-center text-muted-foreground/40 hover:text-primary transition-colors"
                title="Promover a elemento principal"
                onClick={(e) => { e.stopPropagation(); onPromoteToTopLevel(task.id); }}
              >
                <Outdent className="h-3.5 w-3.5" />
              </button>
              <Checkbox
                checked={task.status === 'done'}
                aria-label="Marcar subelemento como concluido"
                className="h-4 w-4 shrink-0"
                onClick={(e) => e.stopPropagation()}
                onCheckedChange={(checked) => onInlineUpdate(task.id, { status: checked ? 'done' : 'todo' })}
              />
            </>
          )}
          {!isSubtask && isPinned && (
            <Pin className="h-3 w-3 shrink-0 fill-primary text-primary" />
          )}
          <span className={`font-medium text-foreground truncate ${isSubtask ? 'text-xs' : ''}`}>{task.title}</span>
          {commentCount > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-sky-400 shrink-0" title={`${commentCount} comentário${commentCount > 1 ? 's' : ''}`}>
              <MessageCircle className="h-3 w-3" />
              {commentCount}
            </span>
          )}
          {!isSubtask && subtaskCount > 0 && (
            <span className="text-[10px] text-muted-foreground bg-muted rounded px-1.5 py-0.5 shrink-0">{subtaskCount}</span>
          )}
          {!isSubtask && (
            <button
              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-muted-foreground hover:text-primary hover:bg-accent rounded shrink-0"
              title="Adicionar subelemento"
              onClick={(e) => { e.stopPropagation(); onAddSubtask(task.id); if (!isExpanded) onToggleExpand(task.id); }}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-accent rounded shrink-0 ml-auto" onClick={e => e.stopPropagation()}>
                <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56" onClick={e => e.stopPropagation()}>
              {!isSubtask && onTogglePin && (
                <DropdownMenuItem onClick={() => onTogglePin(task.id)}>
                  <Pin className="h-3.5 w-3.5 mr-2" /> {isPinned ? 'Desafixar elemento' : 'Fixar elemento'}
                </DropdownMenuItem>
              )}
              {!isSubtask && (
                <DropdownMenuItem onClick={() => { onAddSubtask(task.id); if (!isExpanded) onToggleExpand(task.id); }}>
                  <Plus className="h-3.5 w-3.5 mr-2" /> Adicionar subelemento
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => onClickTask(task, parentTask)}>
                <MessageCircle className="h-3.5 w-3.5 mr-2" /> Adicionar atualizacao
              </DropdownMenuItem>
              {!isSubtask && onMoveToGroup && availableGroups && availableGroups.length > 0 && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <CornerDownRight className="h-3.5 w-3.5 mr-2" /> Mover para grupo
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="max-h-64 overflow-y-auto w-56">
                    <DropdownMenuItem onClick={() => onMoveToGroup(task.id, null)}>
                      Grupo automatico
                    </DropdownMenuItem>
                    {availableGroups.map(group => (
                      <DropdownMenuItem key={group.key} onClick={() => onMoveToGroup(task.id, group.key)}>
                        <span className="truncate">{group.label}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
              {!isSubtask && <DropdownMenuSeparator />}
              {isSubtask ? (
                <DropdownMenuItem onClick={() => onPromoteToTopLevel(task.id)}>
                  <ArrowUp className="h-3.5 w-3.5 mr-2" /> Promover a elemento principal
                </DropdownMenuItem>
              ) : (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <CornerDownRight className="h-3.5 w-3.5 mr-2" /> Tornar subelemento de…
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="max-h-64 overflow-y-auto w-56">
                    {allTopLevelTasks.filter(t => t.id !== task.id).map(t => (
                      <DropdownMenuItem key={t.id} onClick={() => onMoveToParent(task.id, t.id)}>
                        <span className="truncate">{t.title}</span>
                      </DropdownMenuItem>
                    ))}
                    {allTopLevelTasks.filter(t => t.id !== task.id).length === 0 && (
                      <p className="text-xs text-muted-foreground px-3 py-2">Nenhum outro elemento</p>
                    )}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onArchiveTask(task)}>
                <Archive className="h-3.5 w-3.5 mr-2" /> Arquivar {isSubtask ? 'subelemento' : 'elemento'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDeleteTask(task)} className="text-destructive">
                <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir {isSubtask ? 'subelemento' : 'elemento'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {orderedColumns.map(col => (
          <FixedCell key={col} col={col} task={task} {...cellProps} />
        ))}
        {dynamicColumns.map(col => (
          <div key={col.id} className="px-1 py-1" onClick={e => e.stopPropagation()}>
            <ColumnCell value={taskValues.get(col.id) || ''} column={col} onChange={(v) => onSetCustomValue(task.id, col.id, v)} />
          </div>
        ))}
        <div />
      </div>

      {!isSubtask && isExpanded && hasSubtasks && (
        <>
          {hasSubtasks && (
            <div className="grid items-center bg-muted/30 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border" style={{ gridTemplateColumns: gridCols }}>
              <div />
              <span className="px-3 py-1.5 pl-10">Subelemento</span>
              {orderedColumns.map(col => (
                <span key={col} className="px-2 py-1.5 text-center">{subHeaderLabels[col]}</span>
              ))}
              {dynamicColumns.map(col => <span key={col.id} className="px-2 py-1.5 text-center">{col.name}</span>)}
              <div />
            </div>
          )}
          {task.subtasks?.map(sub => (
            <TaskRow
              key={sub.id} task={sub} parentTask={task} groupColor={groupColor} gridCols={gridCols}
              orderedColumns={orderedColumns} profilesMap={profilesMap} isSubtask expandedTasks={expandedTasks}
              onToggleExpand={onToggleExpand} onClickTask={onClickTask} onInlineUpdate={onInlineUpdate}
              onAddSubtask={onAddSubtask} dynamicColumns={dynamicColumns} customValues={customValues}
              onSetCustomValue={onSetCustomValue}
              statusLabelsConfig={statusLabelsConfig} priorityLabelsConfig={priorityLabelsConfig}
              onEditStatusLabels={onEditStatusLabels} onEditPriorityLabels={onEditPriorityLabels}
              projectMembers={projectMembers} onAddAssignee={onAddAssignee} onRemoveAssignee={onRemoveAssignee}
              allTopLevelTasks={allTopLevelTasks} onMoveToParent={onMoveToParent} onPromoteToTopLevel={onPromoteToTopLevel}
              onArchiveTask={onArchiveTask} onDeleteTask={onDeleteTask}
              draggedTaskId={draggedTaskId} onDragStartTask={onDragStartTask} onDragEndTask={onDragEndTask}
              commentCounts={commentCounts}
              isPinned={false}
              availableGroups={availableGroups}
              onMoveToGroup={onMoveToGroup}
            />
          ))}
          <button onClick={() => onAddSubtask(task.id)} className="w-full text-left pl-12 pr-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/20 transition-colors flex items-center gap-1 border-b border-border">
            <Plus className="h-3 w-3" /> Adicionar subelemento
          </button>
        </>
      )}
    </>
  );
}
