import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useDocTemplates, type DocTemplate } from '@/hooks/useDocTemplates';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orgId?: string;
  onPick: (t: DocTemplate) => void;
}

export function TemplatePickerDialog({ open, onOpenChange, orgId, onPick }: Props) {
  const { data: templates = [], isLoading } = useDocTemplates(orgId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nova página a partir de template</DialogTitle>
          <DialogDescription>Escolha um modelo para começar mais rápido.</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ScrollArea className="max-h-[60vh]">
            <div className="grid sm:grid-cols-2 gap-3 p-1">
              {templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { onPick(t); onOpenChange(false); }}
                  className="text-left p-4 rounded-lg border border-border hover:border-primary hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl">{t.icon || '📄'}</span>
                    <span className="font-medium">{t.name}</span>
                  </div>
                  {t.description && (
                    <p className="text-xs text-muted-foreground">{t.description}</p>
                  )}
                </button>
              ))}
              {templates.length === 0 && (
                <p className="text-sm text-muted-foreground col-span-2 text-center py-6">
                  Nenhum template disponível
                </p>
              )}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
