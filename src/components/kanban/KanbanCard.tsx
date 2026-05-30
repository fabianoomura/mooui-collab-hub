import type { TaskWithAssignees, TaskPriority } from '@/hooks/useProjectData';
import { useAssigneeProfiles } from '@/hooks/useAssigneeProfiles';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from '@/components/ui/dropdown-menu';
import { Calendar, CheckSquare, MoreHorizontal, CornerDownRight, ArrowUp } from 'lucide-react';
import { useMemo } from 'react';

const priorityConfig: Record<TaskPriority, { label: string; className: string }> = {
  critical: { label: 'Crítica', className: 'bg-priority-critical text-destructive-foreground' },
  high: { label: 'Alta', className: 'bg-priority-high text-warning-foreground' },
  medium: { label: 'Média', className: 'bg-priority-medium text-warning-foreground' },
  low: { label: 'Baixa', className: 'bg-priority-low text-success-foreground' },
};

function getInitials(name: string | null): string {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

export function KanbanCard({ task, isDragging, allTopLevelTasks, onMoveToParent, onPromoteToTopLevel }: {
  task: TaskWithAssignees;
  isDragging: boolean;
  allTopLevelTasks?: TaskWithAssignees[];
  onMoveToParent?: (taskId: string, parentId: string) => void;
  onPromoteToTopLevel?: (taskId: string) => void;
}) {
  const priority = priorityConfig[task.priority];
  const isOverdue = task.due_date && new Date(task.due_date) < new Date();
  const assignees = task.task_assignees || [];
  const labels = task.task_label_assignments || [];

  const subtasks = task.subtasks || [];
  const subtaskDone = subtasks.filter(s => s.status === 'done').length;

  const assigneeIds = useMemo(() => assignees.map(a => a.user_id), [assignees]);
  const { data: profilesMap } = useAssigneeProfiles(assigneeIds);

  return (
    <div className={`kanban-card p-3 cursor-pointer group ${isDragging ? 'shadow-lg ring-2 ring-primary/30 rotate-2' : ''}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-sm font-medium text-card-foreground leading-snug flex-1">{task.title}</h3>
        {allTopLevelTasks && onMoveToParent && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-accent rounded shrink-0" onClick={e => e.stopPropagation()}>
                <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56" onClick={e => e.stopPropagation()}>
              {task.parent_task_id && onPromoteToTopLevel ? (
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
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <Badge className={`${priority.className} text-[10px] px-1.5 py-0 shrink-0`}>
          {priority.label}
        </Badge>
      </div>

      {labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {labels.map(la => (
            <span
              key={la.label_id}
              className="text-[10px] px-1.5 py-0.5 rounded"
              style={{ backgroundColor: la.task_labels?.color + '20', color: la.task_labels?.color }}
            >
              {la.task_labels?.name}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1.5">
          {task.due_date && (
            <span className={`text-xs flex items-center gap-1 ${isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
              <Calendar className="h-3 w-3" />
              {new Date(task.due_date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
            </span>
          )}
          {subtasks.length > 0 && (
            <span className={`text-xs flex items-center gap-1 ${subtaskDone === subtasks.length ? 'text-emerald-600' : 'text-muted-foreground'}`}>
              <CheckSquare className="h-3 w-3" />
              {subtaskDone}/{subtasks.length}
            </span>
          )}
        </div>
        {assignees.length > 0 && (
          <TooltipProvider>
            <div className="flex -space-x-1.5">
              {assignees.slice(0, 3).map(a => {
                const name = profilesMap?.get(a.user_id)?.full_name || null;
                return (
                  <Tooltip key={a.user_id}>
                    <TooltipTrigger asChild>
                      <Avatar className="h-6 w-6 border-2 border-card">
                        <AvatarFallback className="text-[9px] bg-primary text-primary-foreground">
                          {getInitials(name)}
                        </AvatarFallback>
                      </Avatar>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">{name || 'Usuário'}</TooltipContent>
                  </Tooltip>
                );
              })}
              {assignees.length > 3 && (
                <Avatar className="h-6 w-6 border-2 border-card">
                  <AvatarFallback className="text-[9px] bg-muted text-muted-foreground">
                    +{assignees.length - 3}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
}
