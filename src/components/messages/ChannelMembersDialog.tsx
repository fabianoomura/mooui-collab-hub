import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Check, Search, Trash2, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  useChannelMembersList,
  useAddChannelMembers,
  useRemoveChannelMember,
  useOrgMembers,
} from '@/hooks/useChannels';

function getInitials(name?: string | null) {
  return name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
}

export function ChannelMembersDialog({
  open, onOpenChange, channelId, channelName, orgId, canManage,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  channelId: string;
  channelName: string;
  orgId: string;
  canManage: boolean;
}) {
  const { data: members = [], isLoading } = useChannelMembersList(channelId);
  const { data: orgMembers = [] } = useOrgMembers(orgId);
  const addMembers = useAddChannelMembers();
  const removeMember = useRemoveChannelMember();

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const memberIds = useMemo(() => new Set(members.map(m => m.id)), [members]);
  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orgMembers
      .filter(m => !memberIds.has(m.id))
      .filter(m => !q || (m.full_name || '').toLowerCase().includes(q));
  }, [orgMembers, memberIds, search]);

  const handleAdd = () => {
    if (selected.size === 0) return;
    addMembers.mutate(
      { channelId, userIds: [...selected] },
      {
        onSuccess: () => {
          toast.success(`${selected.size} ${selected.size === 1 ? 'pessoa adicionada' : 'pessoas adicionadas'}`);
          setSelected(new Set());
        },
        onError: (e: any) => toast.error(e?.message || 'Erro ao adicionar'),
      }
    );
  };

  const toggle = (id: string) => setSelected(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Membros de #{channelName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Membros atuais */}
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
              Atuais ({members.length})
            </p>
            <ScrollArea className="max-h-40 rounded-md border border-border">
              {isLoading ? (
                <p className="text-xs text-muted-foreground p-3">Carregando…</p>
              ) : members.length === 0 ? (
                <p className="text-xs text-muted-foreground p-3">Nenhum membro</p>
              ) : (
                <ul className="divide-y divide-border">
                  {members.map(m => (
                    <li key={m.id} className="flex items-center gap-2 px-2 py-1.5">
                      <Avatar className="h-6 w-6">
                        {m.avatar_url && <AvatarImage src={m.avatar_url} />}
                        <AvatarFallback className="text-[10px]">{getInitials(m.full_name)}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm flex-1 truncate">{m.full_name || 'Usuário'}</span>
                      {canManage && (
                        <Button
                          size="icon" variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => removeMember.mutate(
                            { channelId, userId: m.id },
                            { onSuccess: () => toast.success('Removido'), onError: () => toast.error('Erro') }
                          )}
                          title="Remover do canal"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </div>

          {/* Adicionar */}
          {canManage && (
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
                Adicionar pessoas
              </p>
              <div className="relative mb-2">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar membros da org…"
                  className="h-8 pl-7"
                />
              </div>
              <ScrollArea className="max-h-48 rounded-md border border-border">
                {candidates.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-3 text-center">
                    {orgMembers.length === 0 ? 'Sem outros membros na org' : 'Todos já estão no canal'}
                  </p>
                ) : (
                  <ul>
                    {candidates.map(c => {
                      const checked = selected.has(c.id);
                      return (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() => toggle(c.id)}
                            className={cn(
                              'w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-accent',
                              checked && 'bg-accent'
                            )}
                          >
                            <div className="h-4 w-4 flex items-center justify-center">
                              {checked && <Check className="h-3.5 w-3.5 text-primary" />}
                            </div>
                            <Avatar className="h-6 w-6">
                              {c.avatar_url && <AvatarImage src={c.avatar_url} />}
                              <AvatarFallback className="text-[10px]">{getInitials(c.full_name)}</AvatarFallback>
                            </Avatar>
                            <span className="text-sm flex-1 truncate">{c.full_name || 'Usuário'}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          {canManage && (
            <Button onClick={handleAdd} disabled={selected.size === 0 || addMembers.isPending}>
              <UserPlus className="h-4 w-4 mr-1.5" />
              Adicionar {selected.size > 0 ? `(${selected.size})` : ''}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
