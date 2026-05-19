import { useRef, useState } from 'react';
import { Upload, FileText, Image, Film, Trash2, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useTicketAttachments } from '@/hooks/useTicketAttachments';

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(type: string | null) {
  if (!type) return <FileText className="h-5 w-5 text-muted-foreground" />;
  if (type.startsWith('image/')) return <Image className="h-5 w-5 text-blue-400" />;
  if (type.startsWith('video/')) return <Film className="h-5 w-5 text-purple-400" />;
  return <FileText className="h-5 w-5 text-muted-foreground" />;
}

function isPreviewable(type: string | null): boolean {
  if (!type) return false;
  return type.startsWith('image/');
}

export function TicketFilesTab({ ticketId }: { ticketId: string }) {
  const { attachments, isLoading, uploadFile, deleteAttachment } = useTicketAttachments(ticketId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const maxSize = 25 * 1024 * 1024;
    Array.from(files).forEach(file => {
      if (file.size > maxSize) {
        toast.error(`${file.name} excede 25MB`);
        return;
      }
      uploadFile.mutate(
        { ticketId, file },
        {
          onSuccess: () => toast.success(`${file.name} enviado`),
          onError: (e: any) => toast.error(e?.message || `Erro ao enviar ${file.name}`),
        }
      );
    });
  };

  return (
    <div className="space-y-3">
      <div
        className={`border-2 border-dashed rounded-lg p-5 text-center transition-colors cursor-pointer ${
          dragOver ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
        }`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
      >
        {uploadFile.isPending ? (
          <Loader2 className="h-6 w-6 mx-auto text-primary animate-spin" />
        ) : (
          <Upload className="h-6 w-6 mx-auto text-muted-foreground" />
        )}
        <p className="text-xs text-muted-foreground mt-2">
          Arraste prints, logs ou clique para enviar (máx. 25MB)
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : attachments.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">Nenhum anexo</p>
      ) : (
        <div className="space-y-2">
          {attachments.map((att) => (
            <div key={att.id} className="group rounded-lg border border-border overflow-hidden">
              {isPreviewable(att.file_type) && att.signed_url && (
                <div className="bg-muted/30">
                  <img src={att.signed_url} alt={att.file_name} className="w-full max-h-48 object-contain" loading="lazy" />
                </div>
              )}
              <div className="flex items-center gap-2 p-2">
                {getFileIcon(att.file_type)}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{att.file_name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatFileSize(att.file_size)}
                    {att.profile?.full_name && ` · ${att.profile.full_name}`}
                  </p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {att.signed_url && (
                    <a href={att.signed_url} target="_blank" rel="noopener noreferrer" download={att.file_name}>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    </a>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => deleteAttachment.mutate(att.id, {
                      onSuccess: () => toast.success('Anexo removido'),
                      onError: () => toast.error('Erro ao remover'),
                    })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
