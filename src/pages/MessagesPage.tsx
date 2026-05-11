import { useEffect, useRef, useState } from 'react';
import { Hash, Lock, Plus, Send, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { useChannels, useCreateChannel, useDeleteChannel } from '@/hooks/useChannels';
import { useMessages, useSendMessage, useDeleteMessage } from '@/hooks/useMessages';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function MessagesPage() {
  const { user } = useAuth();
  const { currentOrg, isAdmin } = useOrganization();
  const { data: channels = [], isLoading: loadingChannels } = useChannels(currentOrg?.id);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);

  const createChannel = useCreateChannel();
  const deleteChannel = useDeleteChannel();
  const sendMessage = useSendMessage();
  const deleteMessage = useDeleteMessage();

  const [showNewChannel, setShowNewChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDesc, setNewChannelDesc] = useState('');
  const [newChannelPrivate, setNewChannelPrivate] = useState(false);

  const [messageInput, setMessageInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-select first channel
  useEffect(() => {
    if (!activeChannelId && channels.length > 0) {
      setActiveChannelId(channels[0].id);
    }
    if (activeChannelId && !channels.find(c => c.id === activeChannelId)) {
      setActiveChannelId(channels[0]?.id || null);
    }
  }, [channels, activeChannelId]);

  const activeChannel = channels.find(c => c.id === activeChannelId) || null;
  const { data: messages = [] } = useMessages(activeChannelId || undefined);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, activeChannelId]);

  const handleCreateChannel = () => {
    if (!newChannelName.trim() || !currentOrg) return;
    createChannel.mutate(
      {
        name: newChannelName,
        description: newChannelDesc || undefined,
        isPrivate: newChannelPrivate,
        organizationId: currentOrg.id,
      },
      {
        onSuccess: (channel) => {
          toast.success('Canal criado!');
          setShowNewChannel(false);
          setNewChannelName('');
          setNewChannelDesc('');
          setNewChannelPrivate(false);
          setActiveChannelId(channel.id);
        },
        onError: (e: any) => toast.error(e?.message || 'Erro ao criar canal'),
      }
    );
  };

  const handleSend = () => {
    if (!messageInput.trim() || !activeChannelId) return;
    const content = messageInput.trim();
    setMessageInput('');
    sendMessage.mutate(
      { channelId: activeChannelId, content },
      { onError: () => { toast.error('Erro ao enviar'); setMessageInput(content); } }
    );
  };

  const handleDeleteChannel = (id: string, name: string) => {
    if (!confirm(`Excluir o canal #${name}? Todas as mensagens serão perdidas.`)) return;
    deleteChannel.mutate(id, {
      onSuccess: () => toast.success('Canal excluído'),
      onError: () => toast.error('Erro ao excluir canal'),
    });
  };

  if (!currentOrg) {
    return <div className="p-6 text-muted-foreground">Selecione uma organização.</div>;
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] -m-6">
      {/* Channels list */}
      <aside className="w-60 border-r border-border bg-muted/30 flex flex-col shrink-0">
        <div className="p-3 border-b border-border">
          <h2 className="font-semibold text-sm">{currentOrg.name}</h2>
          <p className="text-xs text-muted-foreground">Mensagens</p>
        </div>

        <div className="flex items-center justify-between px-3 pt-3 pb-1">
          <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            Canais
          </span>
          <button
            onClick={() => setShowNewChannel(true)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Novo canal"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <ScrollArea className="flex-1">
          <div className="px-2 pb-3 space-y-0.5">
            {loadingChannels && <div className="px-2 py-1 text-xs text-muted-foreground">Carregando…</div>}
            {!loadingChannels && channels.length === 0 && (
              <div className="px-2 py-1 text-xs text-muted-foreground">Nenhum canal ainda</div>
            )}
            {channels.map((c) => {
              const Icon = c.is_private ? Lock : Hash;
              const active = c.id === activeChannelId;
              return (
                <button
                  key={c.id}
                  onClick={() => setActiveChannelId(c.id)}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors text-left',
                    active
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-foreground hover:bg-accent'
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{c.name}</span>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </aside>

      {/* Messages area */}
      <div className="flex-1 flex flex-col min-w-0">
        {!activeChannel ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Crie ou selecione um canal para começar.
          </div>
        ) : (
          <>
            <header className="h-14 border-b border-border flex items-center justify-between px-4 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                {activeChannel.is_private ? (
                  <Lock className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Hash className="h-4 w-4 text-muted-foreground" />
                )}
                <h1 className="font-semibold truncate">{activeChannel.name}</h1>
                {activeChannel.description && (
                  <span className="text-sm text-muted-foreground truncate">
                    — {activeChannel.description}
                  </span>
                )}
              </div>
              {(activeChannel.created_by === user?.id || isAdmin) && (
                <button
                  onClick={() => handleDeleteChannel(activeChannel.id, activeChannel.name)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                  aria-label="Excluir canal"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </header>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="text-center text-sm text-muted-foreground py-8">
                  Seja o primeiro a enviar uma mensagem em #{activeChannel.name}
                </div>
              )}
              {messages.map((m) => {
                const isMine = m.user_id === user?.id;
                const initials = m.profile?.full_name
                  ?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
                return (
                  <div key={m.id} className="group flex gap-3 hover:bg-muted/40 rounded-md px-2 py-1.5 -mx-2">
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarFallback className="bg-primary/15 text-primary text-xs">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="font-semibold text-sm">
                          {m.profile?.full_name || 'Usuário'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(m.created_at), { addSuffix: true, locale: ptBR })}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap break-words">{m.content}</p>
                    </div>
                    {isMine && (
                      <button
                        onClick={() => deleteMessage.mutate(m.id)}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0"
                        aria-label="Excluir mensagem"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="p-3 border-t border-border">
              <div className="flex items-end gap-2">
                <Textarea
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={`Mensagem para #${activeChannel.name}`}
                  rows={1}
                  className="resize-none min-h-[40px] max-h-32"
                />
                <Button onClick={handleSend} disabled={!messageInput.trim() || sendMessage.isPending} size="icon">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                Enter para enviar · Shift+Enter para nova linha
              </p>
            </div>
          </>
        )}
      </div>

      {/* New channel dialog */}
      <Dialog open={showNewChannel} onOpenChange={setShowNewChannel}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo canal</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nome</Label>
              <Input
                placeholder="ex: geral, marketing, anuncios"
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                autoFocus
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Letras minúsculas, sem espaços (serão convertidos em hífens).
              </p>
            </div>
            <div>
              <Label className="text-xs">Descrição (opcional)</Label>
              <Input
                placeholder="Sobre o que é este canal?"
                value={newChannelDesc}
                onChange={(e) => setNewChannelDesc(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <Label className="text-sm">Canal privado</Label>
                <p className="text-xs text-muted-foreground">Apenas membros convidados podem ver.</p>
              </div>
              <Switch checked={newChannelPrivate} onCheckedChange={setNewChannelPrivate} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewChannel(false)}>Cancelar</Button>
            <Button onClick={handleCreateChannel} disabled={!newChannelName.trim() || createChannel.isPending}>
              Criar canal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
