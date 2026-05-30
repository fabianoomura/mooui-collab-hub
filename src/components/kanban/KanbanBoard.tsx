import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { useProjectTasks, type KanbanColumn, type TaskWithAssignees, type TaskStatus } from '@/hooks/useProjectData';
import { KanbanCard } from './KanbanCard';
import { TaskSidePanel } from './TaskSidePanel';
import { useMemo, useState } from 'react';
import { Plus, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const statusColors: Record<TaskStatus, string> = {
  backlog: 'bg-muted-foreground/20',
  todo: 'bg-info/20',
  in_progress: 'bg-warning/20',
  in_review: 'bg-primary/20',
  done: 'bg-success/20',
};

const statusDotColors: Record<TaskStatus, string> = {
  backlog: 'bg-muted-foreground',
  todo: 'bg-info',
  in_progress: 'bg-warning',
  in_review: 'bg-primary',
  done: 'bg-success',
};

interface Props {
  projectId: string | undefined;
  search?: string;
}

export function KanbanBoard({ projectId, search = '' }: Props) {
  const { columns, isLoading, moveTask, addTask, updateTask } = useProjectTasks(projectId);
  const [selectedTask, setSelectedTask] = useState<TaskWithAssignees | null>(null);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    moveTask.mutate({
      taskId: result.draggableId,
      newStatus: result.destination.droppableId as TaskStatus,
      newPosition: result.destination.index,
    });
  };

  const handleQuickAdd = (status: TaskStatus, title: string) => {
    if (!title.trim()) return;
    addTask.mutate(
      { title: title.trim(), status, priority: 'medium' },
      { onSuccess: () => toast.success('Tarefa criada!') }
    );
  };

  const q = search.trim().toLowerCase();
  const filteredColumns = useMemo(() => {
    if (!q) return columns;
    return columns.map((c) => ({
      ...c,
      tasks: c.tasks.filter((t) => (t.title || '').toLowerCase().includes(q)),
    }));
  }, [columns, q]);

  if (!projectId) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p>Selecione um projeto para ver o quadro Kanban</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full">
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {filteredColumns.map((column) => (
            <KanbanColumnView
              key={column.id}
              column={column}
              statusColor={statusColors[column.id]}
              dotColor={statusDotColors[column.id]}
              onCardClick={setSelectedTask}
              onQuickAdd={(title) => handleQuickAdd(column.id, title)}
              isFiltered={!!q}
            />
          ))}
        </div>
      </DragDropContext>

      {selectedTask && projectId && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setSelectedTask(null)} />
          <TaskSidePanel
            task={selectedTask}
            projectId={projectId}
            open={!!selectedTask}
            onClose={() => setSelectedTask(null)}
            onUpdate={(updates) => {
              updateTask.mutate({ taskId: selectedTask.id, updates });
            }}
            onAddSubtask={(title) => {
              addTask.mutate({ title, status: selectedTask.status, priority: 'medium', parent_task_id: selectedTask.id });
            }}
            onUpdateSubtask={(taskId, updates) => {
              updateTask.mutate({ taskId, updates });
            }}
          />
        </>
      )}
    </div>
  );
}

function KanbanColumnView({
  column, statusColor, dotColor, onCardClick, onQuickAdd, isFiltered,
}: {
  column: KanbanColumn;
  statusColor: string;
  dotColor: string;
  onCardClick: (task: TaskWithAssignees) => void;
  onQuickAdd: (title: string) => void;
  isFiltered: boolean;
}) {
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState('');

  const submit = () => {
    const t = draft.trim();
    if (!t) { setComposing(false); return; }
    onQuickAdd(t);
    setDraft('');
    setComposing(false);
  };

  return (
    <div className="flex-shrink-0 w-72">
      <div className={`rounded-lg px-3 py-2 mb-3 flex items-center justify-between ${statusColor}`}>
        <div className="flex items-center gap-2">
          <div className={`h-2.5 w-2.5 rounded-full ${dotColor}`} />
          <span className="text-sm font-semibold text-foreground">{column.title}</span>
          <span className="text-xs text-muted-foreground bg-background/60 rounded-full px-2 py-0.5">
            {column.tasks.length}
          </span>
        </div>
        <button
          onClick={() => setComposing(true)}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Adicionar tarefa"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <Droppable droppableId={column.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`min-h-[200px] space-y-2 rounded-lg p-1 transition-colors ${
              snapshot.isDraggingOver ? 'bg-accent/50' : ''
            }`}
          >
            {column.tasks.map((task, index) => (
              <Draggable key={task.id} draggableId={task.id} index={index}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    onClick={() => onCardClick(task)}
                  >
                    <KanbanCard task={task} isDragging={snapshot.isDragging} />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}

            {composing && (
              <div className="rounded-md border bg-card p-2 space-y-2">
                <Input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); submit(); }
                    if (e.key === 'Escape') { setComposing(false); setDraft(''); }
                  }}
                  placeholder="Título da tarefa…"
                  className="h-8 text-sm"
                />
                <div className="flex items-center gap-1">
                  <Button size="sm" className="h-7 px-2" onClick={submit} disabled={!draft.trim()}>
                    Adicionar
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 px-2"
                    onClick={() => { setComposing(false); setDraft(''); }}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}

            {!composing && column.tasks.length === 0 && (
              <button
                onClick={() => setComposing(true)}
                className="w-full text-left text-xs text-muted-foreground italic px-2 py-3 rounded hover:bg-accent/40"
              >
                {isFiltered ? 'Nenhuma tarefa corresponde à busca' : '+ Adicionar tarefa'}
              </button>
            )}
          </div>
        )}
      </Droppable>
    </div>
  );
}
