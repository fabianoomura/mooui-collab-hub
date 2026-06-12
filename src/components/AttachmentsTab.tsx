import { useRef } from 'react';
import { FileText, Paperclip, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAttachments, useUploadAttachment, useDeleteAttachment, useAttachmentUrl } from '@/hooks/useAttachments';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface AttachmentsTabProps {
  entityType: string;
  entityId: string | undefined;
}

function AttachmentRow({
  attachment,
  entityType,
  entityId,
}: {
  attachment: { id: string; storage_path: string; file_name: string; file_size: number | null; uploaded_by: string };
  entityType: string;
  entityId: string;
}) {
  const { user } = useAuth();
  const deleteAttachment = useDeleteAttachment();
  const url = useAttachmentUrl(attachment.storage_path);

  return (
    <div className="flex items-center gap-2 text-sm">
      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="truncate text-primary hover:underline flex-1">
          {attachment.file_name}
        </a>
      ) : (
        <span className="truncate flex-1">{attachment.file_name}</span>
      )}
      <span className="text-xs text-muted-foreground shrink-0">
        {attachment.file_size ? `${(attachment.file_size / 1024).toFixed(0)} KB` : ''}
      </span>
      {attachment.uploaded_by === user?.id && (
        <button
          onClick={() =>
            deleteAttachment.mutate({
              id: attachment.id,
              storagePath: attachment.storage_path,
              entityType,
              entityId,
            })
          }
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export default function AttachmentsTab({ entityType, entityId }: AttachmentsTabProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: attachments = [], isLoading } = useAttachments(entityType, entityId);
  const uploadAttachment = useUploadAttachment();

  const handleFiles = (files: FileList) => {
    if (!entityId) return;
    Array.from(files).forEach((file) => {
      if (file.size > 50 * 1024 * 1024) {
        toast.error(`${file.name} excede 50MB`);
        return;
      }
      uploadAttachment.mutate(
        { entityType, entityId, file },
        {
          onSuccess: () => toast.success(`${file.name} enviado`),
          onError: () => toast.error(`Erro ao enviar ${file.name}`),
        },
      );
    });
  };

  return (
    <div className="space-y-3">
      <input
        ref={fileRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploadAttachment.isPending}>
        <Paperclip className="h-3.5 w-3.5 mr-1.5" />
        Anexar arquivo
      </Button>
      {isLoading && <p className="text-xs text-muted-foreground">Carregando...</p>}
      {attachments.length === 0 && !isLoading && <p className="text-xs text-muted-foreground">Nenhum anexo.</p>}
      {entityId &&
        attachments.map((a) => (
          <AttachmentRow key={a.id} attachment={a} entityType={entityType} entityId={entityId} />
        ))}
    </div>
  );
}
