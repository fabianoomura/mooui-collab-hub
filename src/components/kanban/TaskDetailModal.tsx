import { type KanbanTask, type Priority, type Status } from '@/hooks/useKanbanData';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Calendar, User, Flag, Tag, MessageSquare } from 'lucide-react';
import { useState } from 'react';

const priorityOptions: { value: Priority; label: string }[] = [
  { value: 'low', label: 'Baixa' },
  { value: 'medium', label: 'Média' },
  { value: 'high', label: 'Alta' },
  { value: 'critical', label: 'Crítica' },
];

const statusOptions: { value: Status; label: string }[] = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'todo', label: 'A Fazer' },
  { value: 'in_progress', label: 'Em Progresso' },
  { value: 'in_review', label: 'Em Revisão' },
  { value: 'done', label: 'Concluído' },
];

interface Props {
  task: KanbanTask;
  open: boolean;
  onClose: () => void;
  onUpdate: (updates: Partial<KanbanTask>) => void;
}

export function TaskDetailModal({ task, open, onClose, onUpdate }: Props) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [comment, setComment] = useState('');

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="sr-only">Detalhes da tarefa</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Title */}
          <Input
            value={title}
            onChange={e => setTitle(e.target.value)}
            onBlur={() => title !== task.title && onUpdate({ title })}
            className="text-lg font-semibold border-0 px-0 focus-visible:ring-0 bg-transparent"
          />

          {/* Meta row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Flag className="h-3 w-3" /> Prioridade
              </Label>
              <Select value={task.priority} onValueChange={(v: Priority) => onUpdate({ priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {priorityOptions.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Tag className="h-3 w-3" /> Status
              </Label>
              <Select value={task.status} onValueChange={(v: Status) => onUpdate({ status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {statusOptions.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <User className="h-3 w-3" /> Responsável
              </Label>
              <p className="text-sm">{task.assignee || 'Não atribuído'}</p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Data de entrega
              </Label>
              <Input
                type="date"
                value={task.dueDate || ''}
                onChange={e => onUpdate({ dueDate: e.target.value })}
              />
            </div>
          </div>

          {/* Labels */}
          {task.labels.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {task.labels.map(l => (
                <Badge key={l} variant="secondary" className="text-xs">{l}</Badge>
              ))}
            </div>
          )}

          {/* Description */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Descrição</Label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              onBlur={() => description !== (task.description || '') && onUpdate({ description })}
              placeholder="Adicione uma descrição..."
              className="min-h-[100px] resize-none"
            />
          </div>

          {/* Comments placeholder */}
          <div className="space-y-3 border-t pt-4">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <MessageSquare className="h-3 w-3" /> Comentários
            </Label>
            <div className="flex gap-2">
              <Input
                placeholder="Adicionar um comentário..."
                value={comment}
                onChange={e => setComment(e.target.value)}
              />
              <Button size="sm" disabled={!comment.trim()} onClick={() => setComment('')}>
                Enviar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center py-4">Nenhum comentário ainda</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
