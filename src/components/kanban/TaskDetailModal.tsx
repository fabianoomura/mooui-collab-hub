import type { TaskWithAssignees, TaskPriority, TaskStatus } from '@/hooks/useProjectData';
import { useProjectMembers } from '@/hooks/useProjectMembers';
import { useCreateAnnualEvent } from '@/hooks/useAnnualEvents';
import { useCreateLink } from '@/hooks/useModuleLinks';
import { LinkedItems } from '@/components/LinkedItems';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Calendar, CalendarPlus, User, Flag, Tag, MessageSquare, X, UserPlus, Hash } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

const priorityOptions: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: 'Baixa' },
  { value: 'medium', label: 'Média' },
  { value: 'high', label: 'Alta' },
  { value: 'critical', label: 'Crítica' },
];

const statusOptions: { value: TaskStatus; label: string }[] = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'todo', label: 'Não Iniciado' },
  { value: 'in_progress', label: 'Em Andamento' },
  { value: 'in_review', label: 'Em Revisão' },
  { value: 'done', label: 'Feito' },
];

function getInitials(name: string | null): string {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

interface Props {
  task: TaskWithAssignees;
  projectId: string;
  open: boolean;
  onClose: () => void;
  onUpdate: (updates: Record<string, unknown>) => void;
}

export function TaskDetailModal({ task, projectId, open, onClose, onUpdate }: Props) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [ticketNumber, setTicketNumber] = useState(task.ticket_number || '');
  const [comment, setComment] = useState('');
  const { members, addAssignee, removeAssignee } = useProjectMembers(projectId);
  const createEvent = useCreateAnnualEvent();
  const createLink = useCreateLink();

  const assignedUserIds = new Set(task.task_assignees?.map(a => a.user_id) || []);
  const unassignedMembers = members.filter(m => !assignedUserIds.has(m.user_id));

  const sendToCalendar = () => {
    const date = task.due_date || new Date().toISOString().split('T')[0];
    createEvent.mutate(
      { title: task.title, description: task.description || null, category: 'acao', color: '#3b82f6', start_date: date, end_date: null, project_id: null },
      {
        onSuccess: (evt) => {
          createLink.mutate({
            source_type: 'task',
            source_id: task.id,
            target_type: 'calendar',
            target_id: evt.id,
          });
          toast.success('Evento criado no calendário');
        },
        onError: (e: any) => toast.error(e.message),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="sr-only">Detalhes da tarefa</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <Input
            value={title}
            onChange={e => setTitle(e.target.value)}
            onBlur={() => title !== task.title && onUpdate({ title })}
            className="text-lg font-semibold border-0 px-0 focus-visible:ring-0 bg-transparent"
          />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Flag className="h-3 w-3" /> Prioridade
              </Label>
              <Select value={task.priority} onValueChange={(v) => onUpdate({ priority: v })}>
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
              <Select value={task.status} onValueChange={(v) => onUpdate({ status: v })}>
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
                <Calendar className="h-3 w-3" /> Data de entrega
              </Label>
              <Input
                type="date"
                value={task.due_date || ''}
                onChange={e => onUpdate({ due_date: e.target.value || null })}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Hash className="h-3 w-3" /> Nº Ticket
              </Label>
              <Input
                value={ticketNumber}
                onChange={e => setTicketNumber(e.target.value)}
                onBlur={() => ticketNumber !== (task.ticket_number || '') && onUpdate({ ticket_number: ticketNumber || null })}
                placeholder="Ex: MOOUI-001"
              />
            </div>
          </div>

          {/* Assignees section */}
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <User className="h-3 w-3" /> Responsáveis
            </Label>
            <div className="flex flex-wrap gap-2">
              {task.task_assignees?.map(a => {
                const member = members.find(m => m.user_id === a.user_id);
                const name = member?.profile?.full_name || 'Usuário';
                return (
                  <Badge key={a.user_id} variant="secondary" className="flex items-center gap-1.5 py-1 px-2">
                    <Avatar className="h-5 w-5">
                      <AvatarFallback className="text-[8px] bg-primary text-primary-foreground">
                        {getInitials(name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs">{name}</span>
                    <button
                      onClick={() => removeAssignee.mutate({ taskId: task.id, userId: a.user_id })}
                      className="ml-0.5 hover:text-destructive transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                );
              })}
              {assignedUserIds.size === 0 && (
                <span className="text-sm text-muted-foreground">Nenhum responsável</span>
              )}
            </div>

            {unassignedMembers.length > 0 && (
              <Select onValueChange={(userId) => addAssignee.mutate({ taskId: task.id, userId })}>
                <SelectTrigger className="w-full">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <UserPlus className="h-3.5 w-3.5" /> Adicionar responsável
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {unassignedMembers.map(m => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      <span className="flex items-center gap-2">
                        <Avatar className="h-5 w-5">
                          <AvatarFallback className="text-[8px] bg-primary text-primary-foreground">
                            {getInitials(m.profile?.full_name || null)}
                          </AvatarFallback>
                        </Avatar>
                        {m.profile?.full_name || 'Usuário'}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {task.task_label_assignments?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {task.task_label_assignments.map(la => (
                <Badge key={la.label_id} variant="secondary" className="text-xs">
                  {la.task_labels?.name}
                </Badge>
              ))}
            </div>
          )}

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

          {/* Cross-module links */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={sendToCalendar}
              disabled={createEvent.isPending}
            >
              <CalendarPlus className="h-4 w-4 mr-1.5" />
              Enviar para Calendário
            </Button>
          </div>

          <LinkedItems sourceType="task" sourceId={task.id} />

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
