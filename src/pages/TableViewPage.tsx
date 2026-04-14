import { useProjects, useCreateProject, useProjectTasks, type TaskWithAssignees, type TaskStatus, type TaskPriority } from '@/hooks/useProjectData';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Plus, FolderKanban, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { TaskDetailModal } from '@/components/kanban/TaskDetailModal';

const statusLabels: Record<TaskStatus, string> = {
  backlog: 'Backlog',
  todo: 'Não Iniciado',
  in_progress: 'Em Progresso',
  in_review: 'Em Revisão',
  done: 'Concluído',
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

interface TaskGroup {
  label: string;
  status: TaskStatus;
  tasks: TaskWithAssignees[];
  color: string;
}

export default function TableViewPage() {
  const { data: projects, isLoading: loadingProjects } = useProjects();
  const createProject = useCreateProject();
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [selectedTask, setSelectedTask] = useState<TaskWithAssignees | null>(null);

  const activeProjectId = selectedProjectId || projects?.[0]?.id;
  const { columns, tasks, isLoading: loadingTasks, addTask, updateTask } = useProjectTasks(activeProjectId);

  const groups: TaskGroup[] = columns.map((col, i) => ({
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

  const handleCreateProject = () => {
    const name = prompt('Nome do projeto:');
    if (name?.trim()) {
      createProject.mutate(
        { name: name.trim() },
        { onSuccess: (project) => { setSelectedProjectId(project.id); toast.success('Projeto criado!'); } }
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
    return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Quadro Principal</h1>
          <p className="text-muted-foreground text-sm mt-1">Visualize todas as tarefas em tabela</p>
        </div>
        <div className="flex items-center gap-3">
          {projects && projects.length > 0 && (
            <Select value={activeProjectId} onValueChange={setSelectedProjectId}>
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
                {/* Group header */}
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
                  <span className="text-xs text-muted-foreground">{group.tasks.length}</span>
                </button>

                {!isCollapsed && (
                  <div className="rounded-lg border border-border overflow-hidden">
                    {/* Table header */}
                    <div className="grid grid-cols-[1fr_120px_100px_120px_100px_100px_110px] bg-muted/50 px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border">
                      <span>Elemento</span>
                      <span>Responsável</span>
                      <span>Prioridade</span>
                      <span>Status</span>
                      <span>Abertura</span>
                      <span>Conclusão</span>
                      <span>Nº Ticket</span>
                    </div>

                    {/* Rows */}
                    {group.tasks.map((task) => (
                      <div
                        key={task.id}
                        onClick={() => setSelectedTask(task)}
                        className="grid grid-cols-[1fr_120px_100px_120px_100px_100px_110px] px-3 py-2.5 items-center border-b border-border last:border-b-0 hover:bg-accent/40 cursor-pointer transition-colors text-sm"
                        style={{ borderLeft: `3px solid ${group.color}` }}
                      >
                        <span className="font-medium text-foreground truncate pr-2">{task.title}</span>

                        {/* Responsável */}
                        <div className="flex -space-x-1">
                          {task.task_assignees.length > 0 ? (
                            task.task_assignees.slice(0, 3).map((a) => {
                              const initials = a.profiles?.full_name
                                ?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
                              return (
                                <Avatar key={a.user_id} className="h-7 w-7 border-2 border-background">
                                  <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
                                    {initials}
                                  </AvatarFallback>
                                </Avatar>
                              );
                            })
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </div>

                        {/* Prioridade */}
                        <Badge variant="secondary" className={`text-[10px] px-2 py-0.5 ${priorityColors[task.priority]}`}>
                          {priorityLabels[task.priority]}
                        </Badge>

                        {/* Status */}
                        <Badge className={`text-[10px] px-2 py-0.5 ${statusColors[task.status]}`}>
                          {statusLabels[task.status]}
                        </Badge>

                        {/* Abertura */}
                        <span className="text-xs text-muted-foreground">{formatDate(task.created_at)}</span>

                        {/* Conclusão */}
                        <span className="text-xs text-muted-foreground">{formatDate(task.due_date)}</span>

                        {/* Ticket */}
                        <span className="text-xs text-muted-foreground">
                          {(task as any).ticket_number || '—'}
                        </span>
                      </div>
                    ))}

                    {/* Quick add */}
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

          {/* Show empty groups too */}
          {tasks.length === 0 && !loadingTasks && activeProjectId && (
            <div className="text-center py-12 text-muted-foreground">
              <p>Nenhuma tarefa ainda. Clique em "+ Adicionar elemento" para criar.</p>
            </div>
          )}

          {/* Show all status groups even if empty */}
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
              <button
                onClick={() => handleQuickAdd('todo')}
                className="w-full text-left px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" /> Adicionar elemento
              </button>
            </div>
          )}
        </div>
      )}

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
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
