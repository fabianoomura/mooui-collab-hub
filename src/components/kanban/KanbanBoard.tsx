import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { useProjectTasks, type KanbanColumn, type TaskWithAssignees, type TaskStatus } from '@/hooks/useProjectData';
import { KanbanCard } from './KanbanCard';
import { TaskDetailModal } from './TaskDetailModal';
import { useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

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
}

export function KanbanBoard({ projectId }: Props) {
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

  const handleQuickAdd = (status: TaskStatus) => {
    const title = prompt('Título da tarefa:');
    if (title?.trim()) {
      addTask.mutate(
        { title: title.trim(), status, priority: 'medium' },
        { onSuccess: () => toast.success('Tarefa criada!') }
      );
    }
  };

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
          {columns.map((column) => (
            <KanbanColumnView
              key={column.id}
              column={column}
              statusColor={statusColors[column.id]}
              dotColor={statusDotColors[column.id]}
              onCardClick={setSelectedTask}
              onQuickAdd={() => handleQuickAdd(column.id)}
            />
          ))}
        </div>
      </DragDropContext>

      {selectedTask && projectId && (
        <TaskDetailModal
          task={selectedTask}
          projectId={projectId}
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

function KanbanColumnView({
  column, statusColor, dotColor, onCardClick, onQuickAdd,
}: {
  column: KanbanColumn;
  statusColor: string;
  dotColor: string;
  onCardClick: (task: TaskWithAssignees) => void;
  onQuickAdd: () => void;
}) {
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
        <button onClick={onQuickAdd} className="text-muted-foreground hover:text-foreground transition-colors">
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
          </div>
        )}
      </Droppable>
    </div>
  );
}
