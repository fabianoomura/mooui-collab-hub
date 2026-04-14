import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { useKanbanData, type KanbanColumn, type KanbanTask, type Status } from '@/hooks/useKanbanData';
import { KanbanCard } from './KanbanCard';
import { TaskDetailModal } from './TaskDetailModal';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

const statusColors: Record<Status, string> = {
  backlog: 'bg-muted-foreground/20',
  todo: 'bg-info/20',
  in_progress: 'bg-warning/20',
  in_review: 'bg-primary/20',
  done: 'bg-success/20',
};

const statusDotColors: Record<Status, string> = {
  backlog: 'bg-muted-foreground',
  todo: 'bg-info',
  in_progress: 'bg-warning',
  in_review: 'bg-primary',
  done: 'bg-success',
};

export function KanbanBoard() {
  const { columns, moveTask, addTask, updateTask } = useKanbanData();
  const [selectedTask, setSelectedTask] = useState<KanbanTask | null>(null);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const taskId = result.draggableId;
    const newStatus = result.destination.droppableId as Status;
    const newIndex = result.destination.index;
    moveTask(taskId, newStatus, newIndex);
  };

  const handleQuickAdd = (status: Status) => {
    const title = prompt('Título da tarefa:');
    if (title?.trim()) {
      addTask({ title: title.trim(), status, priority: 'medium', labels: [] });
    }
  };

  return (
    <div className="h-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Quadro Kanban</h1>
        <p className="text-muted-foreground text-sm mt-1">Operações MOOUI</p>
      </div>

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

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          open={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={(updates) => {
            updateTask(selectedTask.id, updates);
            setSelectedTask(prev => prev ? { ...prev, ...updates } : null);
          }}
        />
      )}
    </div>
  );
}

function KanbanColumnView({
  column,
  statusColor,
  dotColor,
  onCardClick,
  onQuickAdd,
}: {
  column: KanbanColumn;
  statusColor: string;
  dotColor: string;
  onCardClick: (task: KanbanTask) => void;
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
