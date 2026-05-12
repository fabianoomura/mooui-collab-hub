import { useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Bold, Italic, Strikethrough, Heading1, Heading2, Heading3,
  List, ListOrdered, ListChecks, Quote, Code, Link2, Table as TableIcon,
  Minus, Eye, Pencil, Image as ImageIcon, Loader2,
} from 'lucide-react';

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

type Mode = 'edit' | 'preview';

export function MarkdownEditor({ value, onChange, placeholder }: Props) {
  const [mode, setMode] = useState<Mode>('edit');
  const [uploading, setUploading] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadImage = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Apenas imagens são aceitas');
      return;
    }
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id ?? 'anon';
      const ext = file.name.split('.').pop() || 'png';
      const path = `docs/${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from('chat-attachments').upload(path, file, {
        contentType: file.type, upsert: false,
      });
      if (error) throw error;
      const { data: pub } = supabase.storage.from('chat-attachments').getPublicUrl(path);
      insertBlock(`![${file.name}](${pub.publicUrl})`);
      toast.success('Imagem inserida');
    } catch (e: any) {
      toast.error('Erro ao enviar imagem: ' + (e?.message ?? ''));
    } finally {
      setUploading(false);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith('image/'));
    if (item) {
      const f = item.getAsFile();
      if (f) { e.preventDefault(); uploadImage(f); }
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLTextAreaElement>) => {
    const f = Array.from(e.dataTransfer.files).find((x) => x.type.startsWith('image/'));
    if (f) { e.preventDefault(); uploadImage(f); }
  };


  const wrap = (before: string, after = before, sample = '') => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end) || sample;
    const next = value.slice(0, start) + before + selected + after + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = start + before.length;
      el.selectionEnd = start + before.length + selected.length;
    });
  };

  const insertBlock = (block: string) => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const before = value.slice(0, start);
    const after = value.slice(start);
    const prefix = before.length === 0 || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
    const next = before + prefix + block + (after.startsWith('\n') ? '' : '\n') + after;
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = before.length + prefix.length + block.length;
      el.selectionStart = el.selectionEnd = pos;
    });
  };

  const linePrefix = (prefix: string) => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const next = value.slice(0, lineStart) + prefix + value.slice(lineStart);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + prefix.length;
    });
  };

  const tableTemplate = `| Coluna 1 | Coluna 2 | Coluna 3 |
| -------- | -------- | -------- |
| Valor    | Valor    | Valor    |
| Valor    | Valor    | Valor    |`;

  const tools: Array<{ icon: any; label: string; action: () => void } | 'sep'> = [
    { icon: Heading1, label: 'Título 1', action: () => linePrefix('# ') },
    { icon: Heading2, label: 'Título 2', action: () => linePrefix('## ') },
    { icon: Heading3, label: 'Título 3', action: () => linePrefix('### ') },
    'sep',
    { icon: Bold, label: 'Negrito', action: () => wrap('**', '**', 'texto') },
    { icon: Italic, label: 'Itálico', action: () => wrap('*', '*', 'texto') },
    { icon: Strikethrough, label: 'Tachado', action: () => wrap('~~', '~~', 'texto') },
    { icon: Code, label: 'Código', action: () => wrap('`', '`', 'codigo') },
    'sep',
    { icon: List, label: 'Lista', action: () => linePrefix('- ') },
    { icon: ListOrdered, label: 'Lista numerada', action: () => linePrefix('1. ') },
    { icon: ListChecks, label: 'Checklist', action: () => linePrefix('- [ ] ') },
    'sep',
    { icon: Quote, label: 'Citação', action: () => linePrefix('> ') },
    { icon: TableIcon, label: 'Tabela', action: () => insertBlock(tableTemplate) },
    { icon: Minus, label: 'Divisor', action: () => insertBlock('---') },
    { icon: Link2, label: 'Link', action: () => wrap('[', '](https://)', 'texto') },
  ];

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1 flex-wrap mb-2 pb-2 border-b border-border">
        {tools.map((t, i) =>
          t === 'sep' ? (
            <span key={i} className="w-px h-5 bg-border mx-1" />
          ) : (
            <button
              key={i}
              type="button"
              onClick={t.action}
              title={t.label}
              className="h-7 w-7 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              disabled={mode === 'preview'}
            >
              <t.icon className="h-3.5 w-3.5" />
            </button>
          )
        )}
        <div className="ml-auto flex items-center rounded-md border border-border overflow-hidden">
          <Button
            type="button"
            variant={mode === 'edit' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 rounded-none px-2 text-xs"
            onClick={() => setMode('edit')}
          >
            <Pencil className="h-3 w-3 mr-1" /> Editar
          </Button>
          <Button
            type="button"
            variant={mode === 'preview' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 rounded-none px-2 text-xs"
            onClick={() => setMode('preview')}
          >
            <Eye className="h-3 w-3 mr-1" /> Visualizar
          </Button>
        </div>
      </div>

      {mode === 'edit' ? (
        <Textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="min-h-[60vh] border-0 bg-transparent focus-visible:ring-0 px-0 resize-none text-base leading-relaxed placeholder:text-muted-foreground/40 font-mono text-sm"
        />
      ) : (
        <div className={cn('prose-doc min-h-[60vh] text-base leading-relaxed')}>
          {value.trim() ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
          ) : (
            <p className="text-muted-foreground/60">Nada para mostrar ainda.</p>
          )}
        </div>
      )}
    </div>
  );
}
