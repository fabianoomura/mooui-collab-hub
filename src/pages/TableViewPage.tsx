import { useProjects, useCreateProject, useProjectTasks, type TaskWithAssignees, type TaskStatus, type TaskPriority } from '@/hooks/useProjectData';
import { useAssigneeProfiles } from '@/hooks/useAssigneeProfiles';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Plus, FolderKanban, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { TaskDetailModal } from '@/components/kanban/TaskDetailModal';

const statusLabels: Record<TaskStatus, string> = {
  backlog: 'Backlog',
  todo: 'Não Iniciado',
  in_progress: 'Em Andamento',
  in_review: 'Em Revisão',
  done: 'Feito',
};

const statusColors: Record<TaskStatus, string> = {
  backlog: 'bg-muted-foreground text-muted',
  todo: 'bg-info text-info-foreground',
  in_progress: 'bg-warning text-warning-foreground',
  in_review: 'bg-primary text-primary-foreground',
  done: 'bg-success text-success-foreground',
};

const priorityLabels: Record<TaskPriority, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  critical: 'Crítica',
};

const priorityColors: Record<TaskPriority, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-info/20 text-info',
  high: 'bg-warning/20 text-warning',
  critical: 'bg-destructive/20 text-destructive',
};

const groupColors = [
  'hsl(var(--primary))',
  'hsl(var(--warning))',
  'hsl(var(--success))',
  'hsl(var(--info))',
  'hsl(var(--destructive))',
];

function getInitials(name: string | null): string {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

function AssigneeAvatars({ assignees, profilesMap }: { assignees: { user_id: string }[]; profilesMap: Map<string, { full_name: string | null; avatar_url: string | null }> }) {
  if (assignees.length === 0) return <span className="text-muted-foreground text-xs">—</span>;

  return (
    <TooltipProvider>
      <div className="flex -space-x-1">
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

export default function TableViewPage() {
  const { data: projects, isLoading: loadingProjects } = useProjects();
  const createProject = useCreateProject();
  const [searchParams, setSearchParams] = useSearchParams();
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [selectedTask, setSelectedTask] = useState<TaskWithAssignees | null>(null);

  const projectFromUrl = searchParams.get('projeto');
  const activeProjectId = projectFromUrl || projects?.[0]?.id;
  const { columns, tasks, isLoading: loadingTasks, addTask, updateTask } = useProjectTasks(activeProjectId);

  // Collect all unique assignee user_ids for profile lookup
  const allAssigneeIds = useMemo(() => {
    const ids = new Set<string>();
    tasks.forEach(t => t.task_assignees.forEach(a => ids.add(a.user_id)));
    return Array.from(ids);
  }, [tasks]);

  const { data: profilesMap } = useAssigneeProfiles(allAssigneeIds);

  const groups = columns.map((col, i) => ({
    label: col.title,
    status: col.id,
    tasks: col.tasks,
    color: groupColors[i % groupColors.length],
  })).filter(g => g.tasks.length > 0);

  const toggleGroup = (label: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  };

  const setSelectedProject = (id: string) => {
    setSearchParams({ projeto: id });
  };

  const handleCreateProject = () => {
    const name = prompt('Nome do projeto:');
    if (name?.trim()) {
      createProject.mutate(
        { name: name.trim() },
        { onSuccess: (project) => { setSelectedProject(project.id); toast.success('Projeto criado!'); } }
      );
    }
  };

  const handleQuickAdd = (status: TaskStatus) => {
    const title = prompt('Título da tarefa:');
    if (title?.trim()) {
      addTask.mutate(
        { title: title.trim(), status, priority: 'medium' },
        { onSuccess: () => toast.success('Tarefa criada!') }
      );
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  };

  const activeProject = projects?.find(p => p.id === activeProjectId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {activeProject?.name || 'Quadro Principal'}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Visualize todas as tarefas em tabela</p>
        </div>
        <div className="flex items-center gap-3">
          {projects && projects.length > 0 && (
            <Select value={activeProjectId} onValueChange={setSelectedProject}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Selecione um projeto" />
              </SelectTrigger>
              <SelectContent>
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
                      {p.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button onClick={handleCreateProject} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Novo Projeto
          </Button>
        </div>
      </div>

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
          <Button onClick={handleCreateProject}>
            <Plus className="h-4 w-4 mr-1" /> Criar Projeto
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => {
            const isCollapsed = collapsedGroups.has(group.label);
            return (
              <div key={group.label}>
                <button
                  onClick={() => toggleGroup(group.label)}
                  className="flex items-center gap-2 mb-2 group"
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-sm font-bold" style={{ color: group.color }}>
                    {group.label}
                  </span>
                  <span className="text-xs text-muted-foreground">{group.tasks.length} Elementos</span>
                </button>

                {!isCollapsed && (
                  <div className="rounded-lg border border-border overflow-hidden">
                    <div className="grid grid-cols-[1fr_120px_100px_120px_100px_100px_110px] bg-muted/50 px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border">
                      <span>Elemento</span>
                      <span>Responsável</span>
                      <span>Prioridade</span>
                      <span>Status</span>
                      <span>Abertura</span>
                      <span>Conclusão</span>
                      <span>Nº Ticket</span>
                    </div>

                    {group.tasks.map((task) => (
                      <div
                        key={task.id}
                        onClick={() => setSelectedTask(task)}
                        className="grid grid-cols-[1fr_120px_100px_120px_100px_100px_110px] px-3 py-2.5 items-center border-b border-border last:border-b-0 hover:bg-accent/40 cursor-pointer transition-colors text-sm"
                        style={{ borderLeft: `3px solid ${group.color}` }}
                      >
                        <span className="font-medium text-foreground truncate pr-2">{task.title}</span>
                        <AssigneeAvatars assignees={task.task_assignees} profilesMap={profilesMap || new Map()} />
                        <Badge variant="secondary" className={`text-[10px] px-2 py-0.5 ${priorityColors[task.priority]}`}>
                          {priorityLabels[task.priority]}
                        </Badge>
                        <Badge className={`text-[10px] px-2 py-0.5 ${statusColors[task.status]}`}>
                          {statusLabels[task.status]}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{formatDate(task.created_at)}</span>
                        <span className="text-xs text-muted-foreground">{formatDate(task.due_date)}</span>
                        <span className="text-xs text-muted-foreground">{task.ticket_number || '—'}</span>
                      </div>
                    ))}

                    <button
                      onClick={() => handleQuickAdd(group.status)}
                      className="w-full text-left px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors flex items-center gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" /> Adicionar elemento
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {tasks.length === 0 && !loadingTasks && activeProjectId && (
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="grid grid-cols-[1fr_120px_100px_120px_100px_100px_110px] bg-muted/50 px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <span>Elemento</span>
                <span>Responsável</span>
                <span>Prioridade</span>
                <span>Status</span>
                <span>Abertura</span>
                <span>Conclusão</span>
                <span>Nº Ticket</span>
              </div>
              <div className="text-center py-8 text-muted-foreground text-sm">
                Nenhuma tarefa ainda.
              </div>
              <button
                onClick={() => handleQuickAdd('todo')}
                className="w-full text-left px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors flex items-center gap-1 border-t border-border"
              >
                <Plus className="h-3.5 w-3.5" /> Adicionar elemento
              </button>
            </div>
          )}
        </div>
      )}

      {selectedTask && activeProjectId && (
        <TaskDetailModal
          task={selectedTask}
          projectId={activeProjectId}
          open={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={(updates) => {
            updateTask.mutate({ taskId: selectedTask.id, updates });
          }}
        />
      )}
    </div>
  );
}
