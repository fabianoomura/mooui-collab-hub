import type { TaskWithAssignees, TaskPriority } from '@/hooks/useProjectData';
import { useAssigneeProfiles } from '@/hooks/useAssigneeProfiles';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Calendar } from 'lucide-react';
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

export function KanbanCard({ task, isDragging }: { task: TaskWithAssignees; isDragging: boolean }) {
  const priority = priorityConfig[task.priority];
  const isOverdue = task.due_date && new Date(task.due_date) < new Date();
  const assignees = task.task_assignees || [];
  const labels = task.task_label_assignments || [];

  const assigneeIds = useMemo(() => assignees.map(a => a.user_id), [assignees]);
  const { data: profilesMap } = useAssigneeProfiles(assigneeIds);

  return (
    <div className={`kanban-card p-3 cursor-pointer ${isDragging ? 'shadow-lg ring-2 ring-primary/30 rotate-2' : ''}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-sm font-medium text-card-foreground leading-snug flex-1">{task.title}</h3>
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
