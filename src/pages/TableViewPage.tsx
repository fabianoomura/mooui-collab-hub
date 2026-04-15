import { useProjects, useCreateProject, useProjectTasks, type TaskWithAssignees, type TaskStatus, type TaskPriority } from '@/hooks/useProjectData';
import { useAssigneeProfiles } from '@/hooks/useAssigneeProfiles';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Plus, FolderKanban, Loader2, ChevronDown, ChevronRight, Search, SlidersHorizontal, ArrowUpDown, Eye, LayoutGrid, User } from 'lucide-react';
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

// Inline editable priority cell
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

export default function TableViewPage() {
  const { data: projects, isLoading: loadingProjects } = useProjects();
  const createProject = useCreateProject();
  const [searchParams, setSearchParams] = useSearchParams();
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [selectedTask, setSelectedTask] = useState<TaskWithAssignees | null>(null);
  const [searchText, setSearchText] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

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

  // Filter by search text
  const filteredTasks = useMemo(() => {
    if (!searchText.trim()) return tasks;
    const lower = searchText.toLowerCase();
    return tasks.filter(t => t.title.toLowerCase().includes(lower));
  }, [tasks, searchText]);

  // Group by month (using due_date, fallback to created_at)
  const monthGroups = useMemo(() => {
    const grouped = new Map<string, TaskWithAssignees[]>();
    filteredTasks.forEach(task => {
      const key = getMonthYearKey(task.due_date || task.created_at);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(task);
    });
    // Sort groups by date key
    const sorted = Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b));
    return sorted.map(([key, tasks], i) => ({
      key,
      label: getMonthYearLabel(key),
      tasks,
      color: groupColors[i % groupColors.length],
    }));
  }, [filteredTasks]);

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
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

  const handleQuickAdd = (status: TaskStatus = 'todo') => {
    const title = prompt('Título da tarefa:');
    if (title?.trim()) {
      addTask.mutate(
        { title: title.trim(), status, priority: 'medium' },
        { onSuccess: () => toast.success('Tarefa criada!') }
      );
    }
  };

  const handleInlineUpdate = (taskId: string, updates: Record<string, unknown>) => {
    updateTask.mutate({ taskId, updates });
  };

  const activeProject = projects?.find(p => p.id === activeProjectId);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {projects && projects.length > 0 && (
            <Select value={activeProjectId} onValueChange={setSelectedProject}>
              <SelectTrigger className="w-56 border-0 bg-transparent text-xl font-bold text-foreground h-auto py-0">
                <SelectValue placeholder="Selecione um projeto" />
              </SelectTrigger>
              <SelectContent>
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                      {p.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {!projects?.length && <h1 className="text-xl font-bold text-foreground">Quadro Principal</h1>}
        </div>
      </div>

      {/* Monday.com-style Toolbar */}
      {activeProjectId && (
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={() => handleQuickAdd('todo')}
            size="sm"
            className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-md font-medium"
          >
            <Plus className="h-4 w-4 mr-1" /> Criar elemento
          </Button>

          <div className="h-6 w-px bg-border mx-1" />

          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground gap-1.5 text-xs"
            onClick={() => setSearchOpen(!searchOpen)}
          >
            <Search className="h-3.5 w-3.5" /> Pesquisar
          </Button>
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-1.5 text-xs">
            <User className="h-3.5 w-3.5" /> Pessoa
          </Button>
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-1.5 text-xs">
            <SlidersHorizontal className="h-3.5 w-3.5" /> Filtro
          </Button>
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-1.5 text-xs">
            <ArrowUpDown className="h-3.5 w-3.5" /> Ordenar
          </Button>
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-1.5 text-xs">
            <Eye className="h-3.5 w-3.5" /> Ocultar
          </Button>
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-1.5 text-xs">
            <LayoutGrid className="h-3.5 w-3.5" /> Agrupar por
          </Button>

          <div className="flex-1" />
          <Button onClick={handleCreateProject} variant="outline" size="sm" className="text-xs">
            <Plus className="h-3.5 w-3.5 mr-1" /> Novo Projeto
          </Button>
        </div>
      )}

      {/* Search bar */}
      {searchOpen && (
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar elementos..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            className="max-w-sm h-8 text-sm"
            autoFocus
          />
        </div>
      )}

      {/* Loading */}
      {(loadingProjects || loadingTasks) && (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* Empty state */}
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
          {monthGroups.map((group) => {
            const isCollapsed = collapsedGroups.has(group.key);
            return (
              <div key={group.key}>
                {/* Group header */}
                <button
                  onClick={() => toggleGroup(group.key)}
                  className="flex items-center gap-2 mb-1 group"
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4" style={{ color: group.color }} />
                  ) : (
                    <ChevronDown className="h-4 w-4" style={{ color: group.color }} />
                  )}
                  <span className="text-sm font-bold tracking-wide" style={{ color: group.color }}>
                    {group.label}
                  </span>
                  <span className="text-xs text-muted-foreground ml-1">{group.tasks.length} elementos</span>
                </button>

                {!isCollapsed && (
                  <div className="rounded-lg overflow-hidden border border-border">
                    {/* Column headers */}
                    <div
                      className="grid items-center bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border"
                      style={{
                        gridTemplateColumns: '3px 1fr 110px 100px 120px 100px 100px 100px',
                      }}
                    >
                      <div style={{ backgroundColor: group.color }} className="h-full" />
                      <span className="px-3 py-2">Elemento</span>
                      <span className="px-2 py-2 text-center">Data Ação</span>
                      <span className="px-2 py-2 text-center">Prioridade</span>
                      <span className="px-2 py-2 text-center">Status</span>
                      <span className="px-2 py-2 text-center">Responsável</span>
                      <span className="px-2 py-2 text-center">Abertura</span>
                      <span className="px-2 py-2 text-center">Nº Ticket</span>
                    </div>

                    {/* Task rows */}
                    {group.tasks.map((task) => (
                      <div
                        key={task.id}
                        className="grid items-center border-b border-border last:border-b-0 hover:bg-accent/30 cursor-pointer transition-colors text-sm"
                        style={{
                          gridTemplateColumns: '3px 1fr 110px 100px 120px 100px 100px 100px',
                        }}
                        onClick={() => setSelectedTask(task)}
                      >
                        <div style={{ backgroundColor: group.color }} className="h-full" />
                        <span className="px-3 py-2 font-medium text-foreground truncate">{task.title}</span>
                        <span className="px-2 py-1 text-center text-xs text-muted-foreground">
                          {formatDateShort(task.due_date)}
                        </span>
                        <div className="px-1 py-1" onClick={e => e.stopPropagation()}>
                          <PriorityCell
                            value={task.priority}
                            onChange={(v) => handleInlineUpdate(task.id, { priority: v })}
                          />
                        </div>
                        <div className="px-1 py-1" onClick={e => e.stopPropagation()}>
                          <StatusCell
                            value={task.status}
                            onChange={(v) => handleInlineUpdate(task.id, { status: v })}
                          />
                        </div>
                        <div className="px-1 py-1">
                          <AssigneeAvatars assignees={task.task_assignees} profilesMap={profilesMap || new Map()} />
                        </div>
                        <span className="px-2 py-1 text-center text-xs text-muted-foreground">
                          {formatDateShort(task.created_at)}
                        </span>
                        <span className="px-2 py-1 text-center text-xs text-muted-foreground">
                          {task.ticket_number || '—'}
                        </span>
                      </div>
                    ))}

                    {/* Add element row */}
                    <button
                      onClick={() => handleQuickAdd('todo')}
                      className="w-full text-left px-6 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/20 transition-colors flex items-center gap-1.5"
                    >
                      <Plus className="h-3.5 w-3.5" /> Adicionar elemento
                    </button>

                    {/* Summary row with color indicators */}
                    <div
                      className="grid items-center border-t border-border bg-muted/20"
                      style={{
                        gridTemplateColumns: '3px 1fr 110px 100px 120px 100px 100px 100px',
                      }}
                    >
                      <div style={{ backgroundColor: group.color }} className="h-full" />
                      <span className="px-3 py-1.5" />
                      <span className="px-2 py-1.5" />
                      <div className="px-1 py-1.5 flex gap-0.5">
                        {(['high', 'critical', 'medium', 'low'] as TaskPriority[]).map(p => {
                          const count = group.tasks.filter(t => t.priority === p).length;
                          if (count === 0) return null;
                          return (
                            <div
                              key={p}
                              className={`h-5 rounded-sm ${priorityCellColors[p]}`}
                              style={{ flex: count }}
                              title={`${priorityLabels[p]}: ${count}`}
                            />
                          );
                        })}
                      </div>
                      <div className="px-1 py-1.5 flex gap-0.5">
                        {(['done', 'in_progress', 'in_review', 'todo', 'backlog'] as TaskStatus[]).map(s => {
                          const count = group.tasks.filter(t => t.status === s).length;
                          if (count === 0) return null;
                          return (
                            <div
                              key={s}
                              className={`h-5 rounded-sm ${statusCellColors[s]}`}
                              style={{ flex: count }}
                              title={`${statusLabels[s]}: ${count}`}
                            />
                          );
                        })}
                      </div>
                      <span className="px-2 py-1.5" />
                      <span className="px-2 py-1.5" />
                      <span className="px-2 py-1.5" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Empty when no tasks */}
          {filteredTasks.length === 0 && !loadingTasks && activeProjectId && (
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="text-center py-12 text-muted-foreground text-sm">
                {searchText ? 'Nenhum resultado encontrado.' : 'Nenhuma tarefa ainda. Clique em "Criar elemento" para começar.'}
              </div>
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
