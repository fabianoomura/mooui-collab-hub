import { useTaskAttachments } from '@/hooks/useTaskAttachments';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Upload, FileText, Image, Film, Trash2, Download, Loader2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

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
  return type.startsWith('image/') || type.startsWith('video/');
}

interface Props {
  taskId: string;
}

export function TaskFilesTab({ taskId }: Props) {
  const { attachments, isLoading, uploadFile, deleteAttachment } = useTaskAttachments(taskId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const maxSize = 50 * 1024 * 1024; // 50MB
    Array.from(files).forEach(file => {
      if (file.size > maxSize) {
        toast.error(`${file.name} excede 50MB`);
        return;
      }
      uploadFile.mutate(
        { taskId, file },
        {
          onSuccess: () => toast.success(`${file.name} enviado!`),
          onError: () => toast.error(`Erro ao enviar ${file.name}`),
        }
      );
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-3">
        {/* Upload area */}
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
            dragOver ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
          }`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          {uploadFile.isPending ? (
            <Loader2 className="h-8 w-8 mx-auto text-primary animate-spin" />
          ) : (
            <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
          )}
          <p className="text-sm text-muted-foreground mt-2">
            Arraste arquivos ou clique para enviar
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Imagens, vídeos, PDFs e outros (máx. 50MB)
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.txt"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>

        {/* File list */}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : attachments.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">Nenhum arquivo ainda</p>
        ) : (
          <div className="space-y-2">
            {attachments.map((att) => (
              <div key={att.id} className="group rounded-lg border border-border overflow-hidden">
                {/* Preview for images/videos */}
                {isPreviewable(att.file_type) && (
                  <div className="bg-muted/30">
                    {att.file_type?.startsWith('image/') ? (
                      <img
                        src={att.file_url}
                        alt={att.file_name}
                        className="w-full max-h-48 object-contain"
                        loading="lazy"
                      />
                    ) : (
                      <video
                        src={att.file_url}
                        controls
                        className="w-full max-h-48"
                        preload="metadata"
                      />
                    )}
                  </div>
                )}

                {/* File info */}
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
                    <a href={att.file_url} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    </a>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => deleteAttachment.mutate(att.id, {
                        onSuccess: () => toast.success('Arquivo removido'),
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
    </ScrollArea>
  );
}
