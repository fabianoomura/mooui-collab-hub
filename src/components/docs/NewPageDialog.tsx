import { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDepartments } from '@/hooks/useOrgSettings';
import { IconPicker } from './IconPicker';
import { Upload, FileText, X } from 'lucide-react';
import { toast } from 'sonner';

export function NewPageDialog({
  open, onOpenChange, orgId, onCreate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  orgId: string;
  onCreate: (input: { title: string; icon: string; department_id: string | null; content?: string }) => void;
}) {
  const { data: departments = [] } = useDepartments(orgId);
  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState('📄');
  const [deptId, setDeptId] = useState<string>('__none__');
  const [importedContent, setImportedContent] = useState<string | null>(null);
  const [importedName, setImportedName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setTitle(''); setIcon('📄'); setDeptId('__none__');
    setImportedContent(null); setImportedName(null);
  };

  const submit = () => {
    onCreate({
      title: title.trim() || importedName?.replace(/\.md$/i, '') || 'Sem título',
      icon,
      department_id: deptId === '__none__' ? null : deptId,
      content: importedContent ?? undefined,
    });
    reset();
  };

  const handleFile = async (file: File) => {
    if (!/\.(md|markdown|txt)$/i.test(file.name)) {
      toast.error('Apenas arquivos .md, .markdown ou .txt');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Arquivo muito grande (máx. 2MB)');
      return;
    }
    const text = await file.text();
    setImportedContent(text);
    setImportedName(file.name);
    // Try to derive title from first H1 or filename
    if (!title) {
      const m = text.match(/^#\s+(.+)$/m);
      setTitle((m?.[1] ?? file.name.replace(/\.(md|markdown|txt)$/i, '')).trim());
    }
    toast.success('Arquivo carregado — clique em Criar para importar');
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova página</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="flex items-end gap-3">
            <div>
              <Label className="mb-2 block">Ícone</Label>
              <IconPicker value={icon} onChange={setIcon} />
            </div>
            <div className="flex-1">
              <Label htmlFor="np-title">Título</Label>
              <Input id="np-title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()} placeholder="Ex.: Manual de processos" />
            </div>
          </div>
          <div>
            <Label>Setor</Label>
            <Select value={deptId} onValueChange={setDeptId}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sem setor</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Crie novos setores em Configurações → Setores & Cargos.
            </p>
          </div>

          <div>
            <Label className="mb-2 block">Importar de arquivo (opcional)</Label>
            <input
              ref={fileRef}
              type="file"
              accept=".md,.markdown,.txt,text/markdown,text/plain"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = '';
              }}
            />
            {importedName ? (
              <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1 truncate">{importedName}</span>
                <span className="text-xs text-muted-foreground">
                  {(importedContent?.length ?? 0).toLocaleString('pt-BR')} chars
                </span>
                <button
                  type="button"
                  onClick={() => { setImportedContent(null); setImportedName(null); }}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Remover"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" /> Importar .md
              </Button>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit}>Criar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
