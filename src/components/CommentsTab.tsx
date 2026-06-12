import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Send } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useComments, useAddComment, useDeleteComment } from '@/hooks/useComments';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface CommentsTabProps {
  entityType: string;
  entityId: string | undefined;
}

export default function CommentsTab({ entityType, entityId }: CommentsTabProps) {
  const { user } = useAuth();
  const { data: comments = [], isLoading } = useComments(entityType, entityId);
  const addComment = useAddComment();
  const deleteComment = useDeleteComment();
  const [text, setText] = useState('');

  const send = () => {
    if (!text.trim() || !entityId) return;
    addComment.mutate(
      { entityType, entityId, body: text.trim() },
      {
        onSuccess: () => setText(''),
        onError: () => toast.error('Erro ao enviar comentario'),
      },
    );
  };

  if (isLoading) return <p className="text-xs text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-3">
      {comments.length === 0 && <p className="text-xs text-muted-foreground">Nenhum comentario.</p>}
      {comments.map((c) => {
        const initials = c.author?.full_name
          ?.split(' ')
          .map((n) => n[0])
          .join('')
          .slice(0, 2)
          .toUpperCase() || '?';
        return (
          <div key={c.id} className="flex gap-2">
            <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-medium">{c.author?.full_name || 'Usuario'}</span>
                <span className="text-[10px] text-muted-foreground">
                  {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: ptBR })}
                </span>
                {c.author_id === user?.id && (
                  <button
                    onClick={() => deleteComment.mutate({ id: c.id, entityType, entityId: entityId! })}
                    className="text-[10px] text-muted-foreground hover:text-destructive"
                  >
                    excluir
                  </button>
                )}
              </div>
              <p className="text-sm whitespace-pre-wrap">{c.body}</p>
            </div>
          </div>
        );
      })}
      <div className="flex gap-2">
        <Input
          placeholder="Escrever comentario..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          className="h-8 text-sm"
        />
        <Button size="sm" className="h-8 px-3" onClick={send} disabled={!text.trim() || addComment.isPending}>
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
