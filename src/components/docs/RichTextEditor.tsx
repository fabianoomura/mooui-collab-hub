import { useEffect, useRef, useState, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Code,
  Code2,
  Link2,
  Table as TableIcon,
  Minus,
  Image as ImageIcon,
  Loader2,
} from 'lucide-react';

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export function RichTextEditor({ value, onChange, placeholder }: Props) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Image,
      Link.configure({
        openOnClick: false,
        autolink: true,
      }),
      Placeholder.configure({
        placeholder: placeholder ?? 'Comece a escrever...',
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
    ],
    content: value,
    onUpdate: ({ editor: e }) => {
      onChange(e.getHTML());
    },
  });

  // Sync external value changes into the editor
  useEffect(() => {
    if (!editor) return;
    const currentHtml = editor.getHTML();
    // Only update if the value actually differs (avoid cursor jumps)
    if (value !== currentHtml) {
      editor.commands.setContent(value, false);
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const uploadImage = useCallback(
    async (file: File) => {
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
        const { error } = await supabase.storage
          .from('chat-attachments')
          .upload(path, file, { contentType: file.type, upsert: false });
        if (error) throw error;
        const { data: pub } = supabase.storage
          .from('chat-attachments')
          .getPublicUrl(path);
        editor?.chain().focus().setImage({ src: pub.publicUrl, alt: file.name }).run();
        toast.success('Imagem inserida');
      } catch (e: any) {
        toast.error('Erro ao enviar imagem: ' + (e?.message ?? ''));
      } finally {
        setUploading(false);
      }
    },
    [editor],
  );

  // Handle paste / drop images
  useEffect(() => {
    if (!editor) return;

    const handlePaste = (view: any, event: ClipboardEvent) => {
      const item = Array.from(event.clipboardData?.items ?? []).find((i) =>
        i.type.startsWith('image/'),
      );
      if (item) {
        const f = item.getAsFile();
        if (f) {
          event.preventDefault();
          uploadImage(f);
          return true;
        }
      }
      return false;
    };

    const handleDrop = (view: any, event: DragEvent) => {
      const f = Array.from(event.dataTransfer?.files ?? []).find((x) =>
        x.type.startsWith('image/'),
      );
      if (f) {
        event.preventDefault();
        uploadImage(f);
        return true;
      }
      return false;
    };

    editor.setOptions({
      editorProps: {
        handlePaste,
        handleDrop,
      },
    });
  }, [editor, uploadImage]);

  if (!editor) return null;

  const promptLink = () => {
    const previousUrl = editor.getAttributes('link').href ?? '';
    const url = window.prompt('URL do link:', previousUrl);
    if (url === null) return; // cancelled
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const insertTable = () => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  };

  type Tool = { icon: any; label: string; action: () => void; active?: boolean } | 'sep';

  const tools: Tool[] = [
    { icon: Bold, label: 'Negrito', action: () => editor.chain().focus().toggleBold().run(), active: editor.isActive('bold') },
    { icon: Italic, label: 'Itálico', action: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive('italic') },
    { icon: Strikethrough, label: 'Tachado', action: () => editor.chain().focus().toggleStrike().run(), active: editor.isActive('strike') },
    'sep',
    { icon: Heading1, label: 'Título 1', action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), active: editor.isActive('heading', { level: 1 }) },
    { icon: Heading2, label: 'Título 2', action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: editor.isActive('heading', { level: 2 }) },
    { icon: Heading3, label: 'Título 3', action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), active: editor.isActive('heading', { level: 3 }) },
    'sep',
    { icon: List, label: 'Lista', action: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive('bulletList') },
    { icon: ListOrdered, label: 'Lista numerada', action: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive('orderedList') },
    { icon: ListChecks, label: 'Lista de tarefas', action: () => editor.chain().focus().toggleTaskList().run(), active: editor.isActive('taskList') },
    'sep',
    { icon: Quote, label: 'Citação', action: () => editor.chain().focus().toggleBlockquote().run(), active: editor.isActive('blockquote') },
    { icon: Code, label: 'Código inline', action: () => editor.chain().focus().toggleCode().run(), active: editor.isActive('code') },
    { icon: Code2, label: 'Bloco de código', action: () => editor.chain().focus().toggleCodeBlock().run(), active: editor.isActive('codeBlock') },
    { icon: Link2, label: 'Link', action: promptLink, active: editor.isActive('link') },
    { icon: ImageIcon, label: 'Imagem', action: () => fileRef.current?.click() },
    { icon: TableIcon, label: 'Tabela', action: insertTable },
    { icon: Minus, label: 'Divisor', action: () => editor.chain().focus().setHorizontalRule().run() },
  ];

  return (
    <div className="flex flex-col">
      {/* Toolbar */}
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
              className={cn(
                'h-7 w-7 flex items-center justify-center rounded transition-colors',
                t.active
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              <t.icon className="h-3.5 w-3.5" />
            </button>
          ),
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) uploadImage(f);
          e.target.value = '';
        }}
      />

      {/* Editor */}
      <div className="relative">
        {uploading && (
          <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5 text-xs text-muted-foreground bg-card border rounded px-2 py-1">
            <Loader2 className="h-3 w-3 animate-spin" /> Enviando imagem...
          </div>
        )}
        <EditorContent
          editor={editor}
          className={cn(
            'prose prose-sm sm:prose-base dark:prose-invert max-w-none min-h-[60vh]',
            'focus-within:outline-none',
            '[&_.tiptap]:outline-none [&_.tiptap]:min-h-[60vh]',
            '[&_.tiptap_p.is-editor-empty:first-child::before]:text-muted-foreground/40',
            '[&_.tiptap_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]',
            '[&_.tiptap_p.is-editor-empty:first-child::before]:float-left',
            '[&_.tiptap_p.is-editor-empty:first-child::before]:h-0',
            '[&_.tiptap_p.is-editor-empty:first-child::before]:pointer-events-none',
            // Task list styles
            '[&_ul[data-type="taskList"]]:list-none [&_ul[data-type="taskList"]]:pl-0',
            '[&_ul[data-type="taskList"]_li]:flex [&_ul[data-type="taskList"]_li]:items-start [&_ul[data-type="taskList"]_li]:gap-2',
            '[&_ul[data-type="taskList"]_li_label]:mt-0.5',
            // Table styles
            '[&_table]:border-collapse [&_table]:w-full',
            '[&_td]:border [&_td]:border-border [&_td]:p-2',
            '[&_th]:border [&_th]:border-border [&_th]:p-2 [&_th]:bg-muted [&_th]:font-semibold',
          )}
        />
      </div>
    </div>
  );
}
