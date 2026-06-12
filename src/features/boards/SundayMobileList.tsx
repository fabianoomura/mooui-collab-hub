import { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Calendar, MoreHorizontal, Archive, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { TaskWithAssignees, TaskStatus, TaskPriority } from '@/hooks/useProjectData';

const statusLabels: Record<TaskStatus, string> = {
  backlog: 'Backlog', todo: 'Não Iniciado', in_progress: 'Em Andamento',
  in_review: 'Em Revisão', done: 'Feito',
};
const statusColors: Record<TaskStatus, string> = {
  backlog: 'bg-muted text-muted-foreground',
  todo: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  in_progress: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  in_review: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  done: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
};
const priorityLabels: Record<TaskPriority, string> = {
  low: 'Baixa', medium: 'Média', high: 'Alta', critical: 'Crítica',
};
const priorityColors: Record<TaskPriority, string> = {
  low: '', medium: 'text-amber-600', high: 'text-orange-600', critical: 'text-red-600',
};

interface TaskGroup {
  key: string;
  label: string;
  tasks: TaskWithAssignees[];
  color: string;
}

interface SundayMobileListProps {
  groups: TaskGroup[];
  profilesMap: Map<string, { full_name: string | null; avatar_url: string | null }>;
  onClickTask: (task: TaskWithAssignees, parent?: TaskWithAssignees) => void;
  onQuickAdd: (status?: TaskStatus) => void;
  onArchiveGroup?: (group: TaskGroup) => void;
  onDeleteGroup?: (group: TaskGroup) => void;
}

function getInitials(name?: string | null) {
  return name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
}

export function SundayMobileList({
  groups, profilesMap, onClickTask, onQuickAdd, onArchiveGroup, onDeleteGroup,
}: SundayMobileListProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggle = (key: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {groups.map(group => {
        const isCollapsed = collapsed.has(group.key);
        return (
          <div key={group.key}>
            {/* Group header */}
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={() => toggle(group.key)}
                className="flex items-center gap-2 min-h-[40px] flex-1"
              >
                {isCollapsed
                  ? <ChevronRight className="h-4 w-4 shrink-0" style={{ color: group.color }} />
                  : <ChevronDown className="h-4 w-4 shrink-0" style={{ color: group.color }} />}
                <span className="text-sm font-bold tracking-wide" style={{ color: group.color }}>
                  {group.label}
                </span>
                <span className="text-xs text-muted-foreground">
                  {group.tasks.length}
                </span>
              </button>
              {(onArchiveGroup || onDeleteGroup) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {onArchiveGroup && (
                      <DropdownMenuItem onClick={() => onArchiveGroup(group)}>
                        <Archive className="h-4 w-4 mr-2" /> Arquivar grupo
                      </DropdownMenuItem>
                    )}
                    {onDeleteGroup && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onDeleteGroup(group)} className="text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" /> Excluir grupo
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {/* Task cards */}
            {!isCollapsed && (
              <div className="space-y-1.5">
                {group.tasks.map(task => {
                  const assignees = task.task_assignees.map(a => profilesMap.get(a.user_id));
                  const subtaskCount = task.subtasks?.length ?? 0;
                  const subtaskDone = task.subtasks?.filter(s => s.status === 'done').length ?? 0;

                  return (
                    <button
                      key={task.id}
                      onClick={() => onClickTask(task)}
                      className="w-full text-left rounded-lg border p-3 min-h-[44px] hover:border-primary/40 active:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-start gap-2">
                        {/* Color pip */}
                        <div
                          className="w-1 h-8 rounded-full shrink-0 mt-0.5"
                          style={{ backgroundColor: group.color }}
                        />
                        <div className="flex-1 min-w-0">
                          {/* Title */}
                          <div className="font-medium text-sm truncate">{task.title}</div>

                          {/* Meta row */}
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            <Badge variant="outline" className={cn('text-[10px] h-5', statusColors[task.status])}>
                              {statusLabels[task.status]}
                            </Badge>
                            {task.priority !== 'medium' && (
                              <span className={cn('text-[10px] font-medium', priorityColors[task.priority])}>
                                {priorityLabels[task.priority]}
                              </span>
                            )}
                            {task.due_date && (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(task.due_date), "dd MMM", { locale: ptBR })}
                              </span>
                            )}
                            {subtaskCount > 0 && (
                              <span className="text-[10px] text-muted-foreground">
                                {subtaskDone}/{subtaskCount} sub
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Assignee avatars */}
                        {assignees.length > 0 && (
                          <div className="flex -space-x-1.5 shrink-0">
                            {assignees.slice(0, 3).map((p, i) => (
                              <Avatar key={i} className="h-6 w-6 border-2 border-background">
                                <AvatarFallback className="text-[9px] bg-primary/15 text-primary">
                                  {getInitials(p?.full_name)}
                                </AvatarFallback>
                              </Avatar>
                            ))}
                            {assignees.length > 3 && (
                              <Avatar className="h-6 w-6 border-2 border-background">
                                <AvatarFallback className="text-[9px] bg-muted text-muted-foreground">
                                  +{assignees.length - 3}
                                </AvatarFallback>
                              </Avatar>
                            )}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}

                {/* Quick add */}
                <button
                  onClick={() => onQuickAdd('todo')}
                  className="w-full flex items-center gap-1.5 px-3 py-2 min-h-[40px] text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent/30 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" /> Adicionar
                </button>
              </div>
            )}
          </div>
        );
      })}

      {groups.length === 0 && (
        <div className="text-center py-12 text-sm text-muted-foreground">
          Nenhuma tarefa encontrada.
        </div>
      )}
    </div>
  );
}
