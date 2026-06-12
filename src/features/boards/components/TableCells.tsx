import { useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, UserPlus } from 'lucide-react';
import { type TaskStatus, type TaskPriority, type TaskWithAssignees } from '@/hooks/useProjectData';
import { type LabelOption } from '@/components/table/LabelEditor';
import { statusLabels, statusCellColors, priorityLabels, priorityCellColors, getInitials } from '../constants';

export function StatusCell({ value, onChange, onEditLabels, customLabels }: {
  value: TaskStatus; onChange: (v: TaskStatus) => void;
  onEditLabels?: () => void; customLabels?: LabelOption[];
}) {
  const [open, setOpen] = useState(false);
  const statuses: TaskStatus[] = ['backlog', 'todo', 'in_progress', 'in_review', 'done'];

  const getLabel = (s: TaskStatus) => customLabels?.find(l => l.id === s)?.text || statusLabels[s];
  const getColor = (s: TaskStatus) => customLabels?.find(l => l.id === s)?.color || null;
  const currentColor = getColor(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={`w-full h-full px-2 py-1.5 text-[11px] font-medium text-center rounded-sm transition-colors ${!currentColor ? statusCellColors[value] : ''}`}
          style={currentColor ? { backgroundColor: currentColor, color: '#fff' } : undefined}
          onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        >
          {getLabel(value)}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1" onClick={(e) => e.stopPropagation()}>
        {statuses.map((s) => {
          const color = getColor(s);
          return (
            <button
              key={s}
              className={`w-full text-left px-3 py-1.5 text-xs rounded-sm mb-0.5 hover:opacity-90 font-medium text-center ${!color ? statusCellColors[s] : ''}`}
              style={color ? { backgroundColor: color, color: '#fff' } : undefined}
              onClick={(e) => { e.stopPropagation(); onChange(s); setOpen(false); }}
            >
              {getLabel(s)}
            </button>
          );
        })}
        {onEditLabels && (
          <div className="border-t border-border mt-1 pt-1">
            <button
              className="w-full text-left px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5"
              onClick={(e) => { e.stopPropagation(); setOpen(false); onEditLabels(); }}
            >
              <span className="text-[10px]">✏️</span> Editar etiquetas
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function PriorityCell({ value, onChange, onEditLabels, customLabels }: {
  value: TaskPriority; onChange: (v: TaskPriority) => void;
  onEditLabels?: () => void; customLabels?: LabelOption[];
}) {
  const [open, setOpen] = useState(false);
  const priorities: TaskPriority[] = ['low', 'medium', 'high', 'critical'];

  const getLabel = (p: TaskPriority) => customLabels?.find(l => l.id === p)?.text || priorityLabels[p];
  const getColor = (p: TaskPriority) => customLabels?.find(l => l.id === p)?.color || null;
  const currentColor = getColor(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={`w-full h-full px-2 py-1.5 text-[11px] font-medium text-center rounded-sm transition-colors ${!currentColor ? priorityCellColors[value] : ''}`}
          style={currentColor ? { backgroundColor: currentColor, color: '#fff' } : undefined}
          onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        >
          {getLabel(value)}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-40 p-1" onClick={(e) => e.stopPropagation()}>
        {priorities.map((p) => {
          const color = getColor(p);
          return (
            <button
              key={p}
              className={`w-full text-left px-3 py-1.5 text-xs rounded-sm mb-0.5 hover:opacity-90 font-medium text-center ${!color ? priorityCellColors[p] : ''}`}
              style={color ? { backgroundColor: color, color: '#fff' } : undefined}
              onClick={(e) => { e.stopPropagation(); onChange(p); setOpen(false); }}
            >
              {getLabel(p)}
            </button>
          );
        })}
        {onEditLabels && (
          <div className="border-t border-border mt-1 pt-1">
            <button
              className="w-full text-left px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5"
              onClick={(e) => { e.stopPropagation(); setOpen(false); onEditLabels(); }}
            >
              <span className="text-[10px]">✏️</span> Editar etiquetas
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function AssigneeAvatars({ assignees, profilesMap }: {
  assignees: { user_id: string }[];
  profilesMap: Map<string, { full_name: string | null; avatar_url: string | null }>;
}) {
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
                  <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">{getInitials(name)}</AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">{name}</TooltipContent>
            </Tooltip>
          );
        })}
        {assignees.length > 3 && (
          <Avatar className="h-7 w-7 border-2 border-background">
            <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">+{assignees.length - 3}</AvatarFallback>
          </Avatar>
        )}
      </div>
    </TooltipProvider>
  );
}

export function AssigneePickerCell({ task, profilesMap, projectMembers, onAdd, onRemove }: {
  task: TaskWithAssignees;
  profilesMap: Map<string, { full_name: string | null; avatar_url: string | null }>;
  projectMembers: { user_id: string; profile: { full_name: string | null } | null }[];
  onAdd: (taskId: string, userId: string) => void;
  onRemove: (taskId: string, userId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const assignedIds = new Set(task.task_assignees.map(a => a.user_id));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="w-full h-full px-1 py-1 flex items-center justify-center hover:bg-accent/40 rounded-sm transition-colors min-h-[30px]"
          onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        >
          {task.task_assignees.length === 0 ? (
            <span className="text-muted-foreground text-xs flex items-center gap-1">
              <UserPlus className="h-3 w-3" /> —
            </span>
          ) : (
            <AssigneeAvatars assignees={task.task_assignees} profilesMap={profilesMap} />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="start" onClick={(e) => e.stopPropagation()}>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase px-2 py-1.5">Responsáveis</p>
        {projectMembers.map(m => {
          const checked = assignedIds.has(m.user_id);
          const name = m.profile?.full_name || 'Usuário';
          return (
            <button
              key={m.user_id}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-sm hover:bg-accent text-left"
              onClick={() => {
                if (checked) onRemove(task.id, m.user_id);
                else onAdd(task.id, m.user_id);
              }}
            >
              <div className="h-4 w-4 flex items-center justify-center">
                {checked && <Check className="h-3.5 w-3.5 text-primary" />}
              </div>
              <Avatar className="h-5 w-5">
                <AvatarFallback className="text-[8px] bg-primary text-primary-foreground">{getInitials(name)}</AvatarFallback>
              </Avatar>
              <span className="truncate">{name}</span>
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
