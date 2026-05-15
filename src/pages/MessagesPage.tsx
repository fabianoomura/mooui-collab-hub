import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Hash, Lock, Plus, Send, Trash2, Paperclip, X, FileText, Download, MessageSquare, MessageSquarePlus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  useChannels,
  useDmChannels,
  useOrgMembers,
  useOpenDm,
  useCreateChannel,
  useDeleteChannel,
  useMarkChannelRead,
  useUnreadCounts,
} from '@/hooks/useChannels';
import { useMessages, useSendMessage, useDeleteMessage, useThreadMessages, type MessageWithProfile } from '@/hooks/useMessages';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { notifyUser } from '@/hooks/useNotifications';

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function getInitials(name?: string | null) {
  return name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
}

interface MessageItemProps {
  msg: MessageWithProfile;
  isMine: boolean;
  onDelete: () => void;
  onOpenThread?: () => void;
  showThreadAction?: boolean;
}

function MessageItem({ msg, isMine, onDelete, onOpenThread, showThreadAction }: MessageItemProps) {
  return (
    <div className="group flex gap-3 hover:bg-muted/40 rounded-md px-2 py-1.5 -mx-2">
      <Avatar className="h-9 w-9 shrink-0">
        <AvatarFallback className="bg-primary/15 text-primary text-xs">
          {getInitials(msg.profile?.full_name)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-sm">{msg.profile?.full_name || 'Usuário'}</span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true, locale: ptBR })}
          </span>
        </div>
        {msg.content && msg.content !== '📎' && (
          <p className="text-sm whitespace-pre-wrap break-words">
            {msg.content.split(/(@[\wÀ-ÿ.-]+)/g).map((part, i) =>
              part.startsWith('@') ? (
                <span key={i} className="text-primary font-medium bg-primary/10 rounded px-1">
                  {part}
                </span>
              ) : (
                <span key={i}>{part}</span>
              )
            )}
          </p>
        )}
        {msg.attachments?.length > 0 && (
          <div className="mt-2 space-y-2">
            {msg.attachments.map((att) => {
              const isImage = att.file_type?.startsWith('image/');
              const isVideo = att.file_type?.startsWith('video/');
              if (isImage) {
                return (
                  <a key={att.id} href={att.file_url} target="_blank" rel="noreferrer" className="block max-w-sm">
                    <img src={att.file_url} alt={att.file_name} className="rounded-md border border-border max-h-72 object-contain bg-muted" />
                  </a>
                );
              }
              if (isVideo) {
                return <video key={att.id} src={att.file_url} controls className="rounded-md border border-border max-w-sm max-h-72" />;
              }
              return (
                <a
                  key={att.id}
                  href={att.file_url}
                  target="_blank"
                  rel="noreferrer"
                  download={att.file_name}
                  className="inline-flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 hover:bg-muted transition-colors max-w-sm"
                >
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate">{att.file_name}</p>
                    {att.file_size && <p className="text-[10px] text-muted-foreground">{formatBytes(att.file_size)}</p>}
                  </div>
                  <Download className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </a>
              );
            })}
          </div>
        )}
        {showThreadAction && onOpenThread && (msg.reply_count ?? 0) > 0 && (
          <button
            onClick={onOpenThread}
            className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            <MessageSquare className="h-3 w-3" />
            {msg.reply_count} {msg.reply_count === 1 ? 'resposta' : 'respostas'}
          </button>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {showThreadAction && onOpenThread && (
          <button
            onClick={onOpenThread}
            className="text-muted-foreground hover:text-primary p-1"
            aria-label="Responder em thread"
            title="Responder em thread"
          >
            <MessageSquarePlus className="h-3.5 w-3.5" />
          </button>
        )}
        {isMine && (
          <button onClick={onDelete} className="text-muted-foreground hover:text-destructive p-1" aria-label="Excluir mensagem">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

interface MentionUser {
  id: string;
  full_name: string | null;
}

interface ComposerProps {
  placeholder: string;
  onSend: (content: string, files: File[]) => void;
  pending?: boolean;
  mentionables?: MentionUser[];
}

function Composer({ placeholder, onSend, pending, mentionables = [] }: ComposerProps) {
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Mention popup state
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStart, setMentionStart] = useState(0);
  const [mentionIndex, setMentionIndex] = useState(0);

  const filtered = mentionables
    .filter((u) => u.full_name)
    .filter((u) => u.full_name!.toLowerCase().includes(mentionQuery.toLowerCase()))
    .slice(0, 6);

  const updateMention = (value: string, caret: number) => {
    const upTo = value.slice(0, caret);
    const m = upTo.match(/(?:^|\s)@([\wÀ-ÿ.-]*)$/);
    if (m) {
      setMentionOpen(true);
      setMentionQuery(m[1]);
      setMentionStart(caret - m[1].length - 1);
      setMentionIndex(0);
    } else {
      setMentionOpen(false);
    }
  };

  const insertMention = (u: MentionUser) => {
    const name = (u.full_name || '').split(' ')[0];
    const before = text.slice(0, mentionStart);
    const after = text.slice(mentionStart + 1 + mentionQuery.length);
    const next = `${before}@${name} ${after}`;
    setText(next);
    setMentionOpen(false);
    requestAnimationFrame(() => {
      const pos = before.length + name.length + 2;
      taRef.current?.focus();
      taRef.current?.setSelectionRange(pos, pos);
    });
  };

  const send = () => {
    if (!text.trim() && files.length === 0) return;
    onSend(text.trim() || '📎', files);
    setText('');
    setFiles([]);
    setMentionOpen(false);
  };

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    const valid = picked.filter(f => {
      if (f.size > 50 * 1024 * 1024) {
        toast.error(`${f.name} excede 50MB`);
        return false;
      }
      return true;
    });
    setFiles(prev => [...prev, ...valid]);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="p-3 border-t border-border relative">
      {files.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-2 rounded-md border border-border bg-muted/40 pl-2 pr-1 py-1 text-xs">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="truncate max-w-[160px]">{f.name}</span>
              <span className="text-muted-foreground">{formatBytes(f.size)}</span>
              <button
                onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))}
                className="text-muted-foreground hover:text-destructive p-0.5"
                aria-label="Remover"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {mentionOpen && filtered.length > 0 && (
        <div className="absolute bottom-full left-3 mb-1 w-64 rounded-md border border-border bg-popover shadow-lg z-50 overflow-hidden">
          <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
            Mencionar pessoa
          </div>
          {filtered.map((u, i) => (
            <button
              key={u.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); insertMention(u); }}
              onMouseEnter={() => setMentionIndex(i)}
              className={cn(
                'w-full flex items-center gap-2 px-2 py-1.5 text-left text-sm transition-colors',
                i === mentionIndex ? 'bg-accent' : 'hover:bg-accent/50'
              )}
            >
              <Avatar className="h-6 w-6">
                <AvatarFallback className="bg-primary/15 text-primary text-[10px]">
                  {getInitials(u.full_name)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate">{u.full_name}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <input ref={fileRef} type="file" multiple className="hidden" onChange={pick} />
        <Button variant="outline" size="icon" onClick={() => fileRef.current?.click()} aria-label="Anexar">
          <Paperclip className="h-4 w-4" />
        </Button>
        <Textarea
          ref={taRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            updateMention(e.target.value, e.target.selectionStart ?? e.target.value.length);
          }}
          onKeyDown={(e) => {
            if (mentionOpen && filtered.length > 0) {
              if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex((i) => (i + 1) % filtered.length); return; }
              if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex((i) => (i - 1 + filtered.length) % filtered.length); return; }
              if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertMention(filtered[mentionIndex]); return; }
              if (e.key === 'Escape') { e.preventDefault(); setMentionOpen(false); return; }
            }
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={placeholder}
          rows={1}
          className="resize-none min-h-[40px] max-h-32"
        />
        <Button onClick={send} disabled={(!text.trim() && files.length === 0) || pending} size="icon">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  const { user } = useAuth();
  const { currentOrg, isAdmin } = useOrganization();
  const { data: channels = [], isLoading: loadingChannels } = useChannels(currentOrg?.id);
  const { data: dms = [] } = useDmChannels(currentOrg?.id);
  const { data: orgMembers = [] } = useOrgMembers(currentOrg?.id);

  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [threadParentId, setThreadParentId] = useState<string | null>(null);
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [showNewDm, setShowNewDm] = useState(false);

  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDesc, setNewChannelDesc] = useState('');
  const [newChannelPrivate, setNewChannelPrivate] = useState(false);

  const createChannel = useCreateChannel();
  const deleteChannel = useDeleteChannel();
  const sendMessage = useSendMessage();
  const deleteMessage = useDeleteMessage();
  const markRead = useMarkChannelRead();
  const openDm = useOpenDm();

  const allChannelIds = [...channels.map(c => c.id), ...dms.map(d => d.id)];
  const { data: unreadMap = {} } = useUnreadCounts(allChannelIds);

  // Auto-select first channel only on desktop (mobile shows the list first)
  const didAutoSelect = useRef(false);
  useEffect(() => {
    if (didAutoSelect.current) return;
    if (channels.length === 0) return;
    const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;
    if (isDesktop && !activeChannelId) {
      setActiveChannelId(channels[0].id);
    }
    didAutoSelect.current = true;
  }, [channels, activeChannelId]);

  // Mark as read when opening a channel
  useEffect(() => {
    if (activeChannelId) {
      markRead.mutate(activeChannelId);
    }
    setThreadParentId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChannelId]);

  const activeChannel = channels.find(c => c.id === activeChannelId)
    || dms.find(d => d.id === activeChannelId)
    || null;
  const activeDm = dms.find(d => d.id === activeChannelId);

  const { data: messages = [] } = useMessages(activeChannelId || undefined);
  const { data: threadMessages = [] } = useThreadMessages(threadParentId || undefined);
  const threadParent = messages.find(m => m.id === threadParentId);

  const scrollRef = useRef<HTMLDivElement>(null);
  const threadScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    if (activeChannelId) markRead.mutate(activeChannelId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);
  useEffect(() => {
    if (threadScrollRef.current) threadScrollRef.current.scrollTop = threadScrollRef.current.scrollHeight;
  }, [threadMessages.length]);

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

  const handleStartDm = (otherUserId: string) => {
    if (!currentOrg) return;
    openDm.mutate(
      { otherUserId, orgId: currentOrg.id },
      {
        onSuccess: (channelId) => {
          setShowNewDm(false);
          setActiveChannelId(channelId);
        },
        onError: (e: any) => toast.error(e?.message || 'Erro ao abrir conversa'),
      }
    );
  };

  const handleDeleteChannel = (id: string, name: string) => {
    if (!confirm(`Excluir #${name}? Todas as mensagens serão perdidas.`)) return;
    deleteChannel.mutate(id, {
      onSuccess: () => toast.success('Canal excluído'),
      onError: () => toast.error('Erro ao excluir canal'),
    });
  };

  const notifyMentions = (content: string, channelId: string, channelLabel: string) => {
    const matches = Array.from(content.matchAll(/@([\wÀ-ÿ.-]+)/g)).map(m => m[1].toLowerCase());
    if (!matches.length) return;
    const seen = new Set<string>();
    matches.forEach((token) => {
      const member = orgMembers.find(m => {
        const first = (m.full_name || '').split(' ')[0].toLowerCase();
        const full = (m.full_name || '').toLowerCase();
        return first === token || full === token;
      });
      if (member && member.id !== user?.id && !seen.has(member.id)) {
        seen.add(member.id);
        notifyUser({
          userId: member.id,
          type: 'mention',
          title: `${user?.user_metadata?.full_name || 'Alguém'} mencionou você em ${channelLabel}`,
          message: content.slice(0, 140),
          link: `/mensagens`,
        });
      }
    });
  };

  const handleSend = (content: string, files: File[]) => {
    if (!activeChannelId) return;
    sendMessage.mutate(
      { channelId: activeChannelId, content, files: files.length ? files : undefined },
      {
        onSuccess: () => notifyMentions(content, activeChannelId, headerLabel ? (activeDm ? `DM com ${headerLabel}` : `#${headerLabel}`) : 'um canal'),
        onError: () => toast.error('Erro ao enviar'),
      }
    );
  };

  const handleSendThreadReply = (content: string, files: File[]) => {
    if (!activeChannelId || !threadParentId) return;
    sendMessage.mutate(
      { channelId: activeChannelId, content, files: files.length ? files : undefined, parentMessageId: threadParentId },
      {
        onSuccess: () => notifyMentions(content, activeChannelId, headerLabel ? (activeDm ? `DM com ${headerLabel}` : `#${headerLabel}`) : 'um canal'),
        onError: () => toast.error('Erro ao responder'),
      }
    );
  };

  if (!currentOrg) {
    return <div className="p-6 text-muted-foreground">Selecione uma organização.</div>;
  }

  const headerLabel = activeDm
    ? activeDm.partner?.full_name || 'Conversa'
    : activeChannel?.name || '';

  const showChatOnMobile = !!activeChannelId;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] -m-3 sm:-m-6">
      {/* Sidebar */}
      <aside
        className={cn(
          'w-full lg:w-72 border-r border-border bg-muted/30 flex-col shrink-0',
          showChatOnMobile ? 'hidden lg:flex' : 'flex'
        )}
      >
        <div className="p-3 border-b border-border">
          <h2 className="font-semibold text-sm">{currentOrg.name}</h2>
          <p className="text-xs text-muted-foreground">Mensagens</p>
        </div>

        <ScrollArea className="flex-1">
          {/* Channels */}
          <div className="flex items-center justify-between px-3 pt-3 pb-1">
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
              Canais
              <span className="text-[10px] text-muted-foreground/70 normal-case tracking-normal font-normal">({channels.length})</span>
              {(() => {
                const total = channels.reduce((s, c) => s + (unreadMap[c.id] || 0), 0);
                return total > 0 ? (
                  <Badge variant="default" className="h-4 min-w-4 px-1 text-[9px]">{total > 99 ? '99+' : total}</Badge>
                ) : null;
              })()}
            </span>
            <button
              onClick={() => setShowNewChannel(true)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Novo canal"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <div className="px-2 pb-3 space-y-0.5">
            {loadingChannels && <div className="px-2 py-1 text-xs text-muted-foreground">Carregando…</div>}
            {!loadingChannels && channels.length === 0 && (
              <div className="px-2 py-1 text-xs text-muted-foreground">Nenhum canal ainda</div>
            )}
            {channels.map((c) => {
              const Icon = c.is_private ? Lock : Hash;
              const active = c.id === activeChannelId;
              const unread = unreadMap[c.id] || 0;
              return (
                <button
                  key={c.id}
                  onClick={() => setActiveChannelId(c.id)}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors text-left',
                    active ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-accent',
                    unread > 0 && !active && 'font-semibold'
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate flex-1">{c.name}</span>
                  {unread > 0 && (
                    <Badge variant="default" className="h-5 min-w-5 px-1.5 text-[10px]">
                      {unread > 99 ? '99+' : unread}
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>

          {/* DMs */}
          <div className="flex items-center justify-between px-3 pt-2 pb-1">
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
              Mensagens diretas
              <span className="text-[10px] text-muted-foreground/70 normal-case tracking-normal font-normal">({dms.length})</span>
              {(() => {
                const total = dms.reduce((s, d) => s + (unreadMap[d.id] || 0), 0);
                return total > 0 ? (
                  <Badge variant="default" className="h-4 min-w-4 px-1 text-[9px]">{total > 99 ? '99+' : total}</Badge>
                ) : null;
              })()}
            </span>
            <button
              onClick={() => setShowNewDm(true)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Nova conversa"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <div className="px-2 pb-3 space-y-0.5">
            {dms.length === 0 && (
              <div className="px-2 py-1 text-xs text-muted-foreground">Nenhuma conversa</div>
            )}
            {dms.map((d) => {
              const active = d.id === activeChannelId;
              const unread = unreadMap[d.id] || 0;
              return (
                <button
                  key={d.id}
                  onClick={() => setActiveChannelId(d.id)}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors text-left',
                    active ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-accent',
                    unread > 0 && !active && 'font-semibold'
                  )}
                >
                  <Avatar className="h-5 w-5 shrink-0">
                    <AvatarFallback className="bg-primary/15 text-primary text-[9px]">
                      {getInitials(d.partner?.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate flex-1">{d.partner?.full_name || 'Usuário'}</span>
                  {unread > 0 && (
                    <Badge variant="default" className="h-5 min-w-5 px-1.5 text-[10px]">
                      {unread > 99 ? '99+' : unread}
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </aside>

      {/* Messages area */}
      <div className={cn(
        'flex-1 flex-col min-w-0',
        showChatOnMobile ? 'flex' : 'hidden lg:flex'
      )}>
        {!activeChannel ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground p-4 text-center text-sm">
            Crie ou selecione um canal para começar.
          </div>
        ) : (
          <>
            <header className="h-14 border-b border-border flex items-center justify-between px-3 sm:px-4 shrink-0 gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <button
                  onClick={() => setActiveChannelId(null)}
                  className="lg:hidden -ml-1 p-1 text-muted-foreground hover:text-foreground"
                  aria-label="Voltar"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                {activeDm ? (
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="bg-primary/15 text-primary text-[10px]">
                      {getInitials(activeDm.partner?.full_name)}
                    </AvatarFallback>
                  </Avatar>
                ) : activeChannel.is_private ? (
                  <Lock className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Hash className="h-4 w-4 text-muted-foreground" />
                )}
                <h1 className="font-semibold truncate">{headerLabel}</h1>
                {activeChannel.description && !activeDm && (
                  <span className="hidden sm:inline text-sm text-muted-foreground truncate">— {activeChannel.description}</span>
                )}
              </div>
              {!activeDm && (activeChannel.created_by === user?.id || isAdmin) && (
                <button
                  onClick={() => handleDeleteChannel(activeChannel.id, activeChannel.name)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                  aria-label="Excluir canal"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </header>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
              {messages.length === 0 && (
                <div className="text-center text-sm text-muted-foreground py-8">
                  {activeDm
                    ? `Comece sua conversa com ${activeDm.partner?.full_name || 'este usuário'}`
                    : `Seja o primeiro a enviar uma mensagem em #${activeChannel.name}`}
                </div>
              )}
              {messages.map((m) => (
                <MessageItem
                  key={m.id}
                  msg={m}
                  isMine={m.user_id === user?.id}
                  onDelete={() => deleteMessage.mutate(m.id)}
                  onOpenThread={() => setThreadParentId(m.id)}
                  showThreadAction
                />
              ))}
            </div>

            <Composer
              placeholder={activeDm ? `Mensagem para ${activeDm.partner?.full_name || ''}` : `Mensagem para #${activeChannel.name}`}
              onSend={handleSend}
              pending={sendMessage.isPending}
              mentionables={orgMembers}
            />
          </>
        )}
      </div>

      {/* Thread side panel */}
      {threadParentId && threadParent && (
        <aside className="fixed inset-0 z-40 md:static md:inset-auto md:w-96 w-full border-l border-border bg-background flex flex-col shrink-0">
          <header className="h-14 border-b border-border flex items-center justify-between px-4 shrink-0">
            <div>
              <h2 className="font-semibold text-sm">Thread</h2>
              <p className="text-xs text-muted-foreground">
                {!activeDm && activeChannel ? `#${activeChannel.name}` : ''}
              </p>
            </div>
            <button
              onClick={() => setThreadParentId(null)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Fechar thread"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div ref={threadScrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            <MessageItem
              msg={threadParent}
              isMine={threadParent.user_id === user?.id}
              onDelete={() => deleteMessage.mutate(threadParent.id)}
            />
            <div className="border-t border-border pt-3 -mx-4 px-4 space-y-3">
              {threadMessages.length === 0 && (
                <p className="text-xs text-muted-foreground text-center">Nenhuma resposta ainda</p>
              )}
              {threadMessages.map((m) => (
                <MessageItem
                  key={m.id}
                  msg={m}
                  isMine={m.user_id === user?.id}
                  onDelete={() => deleteMessage.mutate(m.id)}
                />
              ))}
            </div>
          </div>

          <Composer
            placeholder="Responder na thread"
            onSend={handleSendThreadReply}
            pending={sendMessage.isPending}
            mentionables={orgMembers}
          />
        </aside>
      )}

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
                placeholder="ex: geral, marketing"
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

      {/* New DM dialog */}
      <Dialog open={showNewDm} onOpenChange={setShowNewDm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova conversa</DialogTitle>
          </DialogHeader>
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {orgMembers.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Não há outros membros nesta organização.
              </p>
            )}
            {orgMembers.map((m) => (
              <button
                key={m.id}
                onClick={() => handleStartDm(m.id)}
                disabled={openDm.isPending}
                className="w-full flex items-center gap-3 px-2 py-2 rounded-md hover:bg-accent transition-colors text-left disabled:opacity-50"
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/15 text-primary text-xs">
                    {getInitials(m.full_name)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm">{m.full_name || 'Usuário'}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
