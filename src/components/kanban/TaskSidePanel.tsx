import type { TaskWithAssignees, TaskPriority, TaskStatus } from '@/hooks/useProjectData';
import { useTaskComments, useTaskActivity } from '@/hooks/useProjectData';
import { useProjectMembers } from '@/hooks/useProjectMembers';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar, User, Flag, Tag, MessageSquare, X, UserPlus, Hash, FileText, Activity, Info, Send } from 'lucide-react';
import { TaskFilesTab } from './TaskFilesTab';
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

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'agora';
  if (diffMins < 60) return `${diffMins}min`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d`;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

interface Props {
  task: TaskWithAssignees;
  parentTask?: TaskWithAssignees;
  projectId: string;
  open: boolean;
  onClose: () => void;
  onUpdate: (updates: Record<string, unknown>) => void;
}

export function TaskSidePanel({ task, parentTask, projectId, open, onClose, onUpdate }: Props) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [ticketNumber, setTicketNumber] = useState(task.ticket_number || '');
  const [comment, setComment] = useState('');
  const { members, addAssignee, removeAssignee } = useProjectMembers(projectId);
  const { comments, addComment } = useTaskComments(task.id);
  const { data: activityLog } = useTaskActivity(task.id);

  const assignedUserIds = new Set(task.task_assignees?.map(a => a.user_id) || []);
  const unassignedMembers = members.filter(m => !assignedUserIds.has(m.user_id));

  const handleSendComment = () => {
    if (!comment.trim()) return;
    addComment.mutate(
      { taskId: task.id, content: comment.trim() },
      { onSuccess: () => { setComment(''); toast.success('Comentário adicionado!'); } }
    );
  };

  if (!open) return null;

  return (
    <div className="fixed top-0 right-0 h-full w-[480px] max-w-full bg-card border-l border-border shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex-1 min-w-0">
          {parentTask && (
            <p className="text-[10px] text-muted-foreground mb-0.5 truncate">
              {parentTask.title}
            </p>
          )}
          <h3 className="text-sm font-semibold text-foreground truncate">{task.title}</h3>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 transition-colors">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="updates" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent h-auto p-0 px-4">
          <TabsTrigger value="updates" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs py-2 px-3">
            <MessageSquare className="h-3 w-3 mr-1" /> Atualizações
            {comments.length > 0 && <span className="ml-1 text-muted-foreground">/{comments.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="files" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs py-2 px-3">
            <FileText className="h-3 w-3 mr-1" /> Arquivos
          </TabsTrigger>
          <TabsTrigger value="activity" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs py-2 px-3">
            <Activity className="h-3 w-3 mr-1" /> Log
          </TabsTrigger>
          <TabsTrigger value="info" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs py-2 px-3">
            <Info className="h-3 w-3 mr-1" /> Informações
          </TabsTrigger>
        </TabsList>

        {/* Updates Tab */}
        <TabsContent value="updates" className="flex-1 flex flex-col overflow-hidden m-0">
          {/* Comment input */}
          <div className="p-4 border-b border-border">
            <div className="rounded-lg border border-border p-3">
              <Textarea
                placeholder="Escreva uma atualização e mencione outros com @"
                value={comment}
                onChange={e => setComment(e.target.value)}
                className="min-h-[60px] border-0 p-0 resize-none focus-visible:ring-0 text-sm"
              />
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <button className="p-1 hover:text-foreground"><span className="text-xs">@</span></button>
                  <button className="p-1 hover:text-foreground"><span className="text-xs">📎</span></button>
                  <button className="p-1 hover:text-foreground"><span className="text-xs">😊</span></button>
                </div>
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  disabled={!comment.trim() || addComment.isPending}
                  onClick={handleSendComment}
                >
                  <Send className="h-3 w-3 mr-1" /> Enviar
                </Button>
              </div>
            </div>
          </div>

          {/* Comments list */}
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {comments.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">Nenhuma atualização ainda</p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
                          {getInitials(c.profile?.full_name || null)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <span className="text-sm font-medium text-foreground">
                          {c.profile?.full_name || 'Usuário'}
                        </span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {formatRelativeTime(c.created_at)}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-foreground pl-10 whitespace-pre-wrap">{c.content}</p>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Files Tab */}
        <TabsContent value="files" className="flex-1 m-0">
          <TaskFilesTab taskId={task.id} />
        </TabsContent>

        {/* Activity Log Tab */}
        <TabsContent value="activity" className="flex-1 m-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-3">
              {(!activityLog || activityLog.length === 0) ? (
                <p className="text-xs text-muted-foreground text-center py-8">Nenhuma atividade registrada</p>
              ) : (
                activityLog.map((a) => (
                  <div key={a.id} className="flex items-start gap-2 text-xs">
                    <Avatar className="h-6 w-6 mt-0.5">
                      <AvatarFallback className="text-[8px] bg-muted text-muted-foreground">
                        {getInitials(a.profile?.full_name || null)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <span className="font-medium">{a.profile?.full_name || 'Usuário'}</span>
                      <span className="text-muted-foreground"> alterou </span>
                      <span className="font-medium">{a.field_name}</span>
                      {a.old_value && <span className="text-muted-foreground"> de "{a.old_value}"</span>}
                      {a.new_value && <span className="text-muted-foreground"> para "{a.new_value}"</span>}
                      <p className="text-muted-foreground mt-0.5">{formatRelativeTime(a.created_at)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Info Tab */}
        <TabsContent value="info" className="flex-1 m-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-5">
              {/* Title */}
              <Input
                value={title}
                onChange={e => setTitle(e.target.value)}
                onBlur={() => title !== task.title && onUpdate({ title })}
                className="text-base font-semibold border-0 px-0 focus-visible:ring-0 bg-transparent"
              />

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Flag className="h-3 w-3" /> Prioridade
                  </Label>
                  <Select value={task.priority} onValueChange={(v) => onUpdate({ priority: v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {priorityOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Tag className="h-3 w-3" /> Status
                  </Label>
                  <Select value={task.status} onValueChange={(v) => onUpdate({ status: v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {statusOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Data de entrega
                  </Label>
                  <Input
                    type="date"
                    value={task.due_date || ''}
                    onChange={e => onUpdate({ due_date: e.target.value || null })}
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Hash className="h-3 w-3" /> Nº Ticket
                  </Label>
                  <Input
                    value={ticketNumber}
                    onChange={e => setTicketNumber(e.target.value)}
                    onBlur={() => ticketNumber !== (task.ticket_number || '') && onUpdate({ ticket_number: ticketNumber || null })}
                    placeholder="Ex: MOOUI-001"
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              {/* Assignees */}
              <div className="space-y-2">
                <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <User className="h-3 w-3" /> Responsáveis
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {task.task_assignees?.map(a => {
                    const member = members.find(m => m.user_id === a.user_id);
                    const name = member?.profile?.full_name || 'Usuário';
                    return (
                      <Badge key={a.user_id} variant="secondary" className="flex items-center gap-1 py-0.5 px-2 text-xs">
                        <Avatar className="h-4 w-4">
                          <AvatarFallback className="text-[7px] bg-primary text-primary-foreground">
                            {getInitials(name)}
                          </AvatarFallback>
                        </Avatar>
                        {name}
                        <button
                          onClick={() => removeAssignee.mutate({ taskId: task.id, userId: a.user_id })}
                          className="ml-0.5 hover:text-destructive"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>

                {unassignedMembers.length > 0 && (
                  <Select onValueChange={(userId) => addAssignee.mutate({ taskId: task.id, userId })}>
                    <SelectTrigger className="h-8 text-xs">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <UserPlus className="h-3 w-3" /> Adicionar
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {unassignedMembers.map(m => (
                        <SelectItem key={m.user_id} value={m.user_id}>
                          {m.profile?.full_name || 'Usuário'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label className="text-[10px] text-muted-foreground">Descrição</Label>
                <Textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  onBlur={() => description !== (task.description || '') && onUpdate({ description })}
                  placeholder="Adicione uma descrição..."
                  className="min-h-[80px] resize-none text-sm"
                />
              </div>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
