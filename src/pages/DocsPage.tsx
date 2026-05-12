import { useEffect, useMemo, useState } from 'react';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  useDocPages,
  useCreateDocPage,
  useUpdateDocPage,
  useDeleteDocPage,
  type DocPage,
} from '@/hooks/useDocPages';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MarkdownEditor } from '@/components/docs/MarkdownEditor';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ChevronRight,
  ChevronDown,
  Plus,
  FileText,
  Trash2,
  MoreHorizontal,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TreeNode extends DocPage {
  children: TreeNode[];
}

function buildTree(pages: DocPage[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  pages.forEach((p) => map.set(p.id, { ...p, children: [] }));
  const roots: TreeNode[] = [];
  map.forEach((node) => {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

function PageTreeItem({
  node,
  depth,
  selectedId,
  onSelect,
  onAddChild,
  onDelete,
  expanded,
  toggle,
}: {
  node: TreeNode;
  depth: number;
  selectedId?: string;
  onSelect: (id: string) => void;
  onAddChild: (parentId: string) => void;
  onDelete: (id: string) => void;
  expanded: Set<string>;
  toggle: (id: string) => void;
}) {
  const isOpen = expanded.has(node.id);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedId === node.id;

  return (
    <div>
      <div
        className={cn(
          'group flex items-center gap-1 rounded-md px-2 py-1 text-sm cursor-pointer hover:bg-accent',
          isSelected && 'bg-accent text-accent-foreground font-medium'
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => onSelect(node.id)}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggle(node.id);
          }}
          className="h-4 w-4 flex items-center justify-center text-muted-foreground hover:text-foreground"
        >
          {hasChildren ? (
            isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />
          ) : (
            <span className="h-3 w-3" />
          )}
        </button>
        <span className="text-base leading-none">{node.icon || '📄'}</span>
        <span className="truncate flex-1">{node.title || 'Sem título'}</span>
        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddChild(node.id);
            }}
            className="h-5 w-5 flex items-center justify-center rounded hover:bg-background"
            title="Adicionar subpágina"
          >
            <Plus className="h-3 w-3" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                className="h-5 w-5 flex items-center justify-center rounded hover:bg-background"
              >
                <MoreHorizontal className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onDelete(node.id)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {isOpen && hasChildren && (
        <div>
          {node.children.map((child) => (
            <PageTreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              onAddChild={onAddChild}
              onDelete={onDelete}
              expanded={expanded}
              toggle={toggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function DocsPage() {
  const { currentOrg } = useOrganization();
  const { data: pages = [] } = useDocPages(currentOrg?.id);
  const createPage = useCreateDocPage();
  const updatePage = useUpdateDocPage();
  const deletePage = useDeleteDocPage();

  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [icon, setIcon] = useState('📄');

  const tree = useMemo(() => buildTree(pages), [pages]);
  const selected = pages.find((p) => p.id === selectedId);

  // auto-select first page
  useEffect(() => {
    if (!selectedId && pages.length > 0) setSelectedId(pages[0].id);
  }, [pages, selectedId]);

  // load selected into editor
  useEffect(() => {
    if (selected) {
      setTitle(selected.title);
      setContent(selected.content || '');
      setIcon(selected.icon || '📄');
    } else {
      setTitle('');
      setContent('');
      setIcon('📄');
    }
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  // autosave (debounced)
  useEffect(() => {
    if (!selected) return;
    if (
      title === selected.title &&
      content === (selected.content || '') &&
      icon === (selected.icon || '📄')
    )
      return;
    const t = setTimeout(() => {
      updatePage.mutate({ id: selected.id, title, content, icon });
    }, 600);
    return () => clearTimeout(t);
  }, [title, content, icon]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleCreate = (parentId: string | null) => {
    if (!currentOrg) return;
    createPage.mutate(
      { organization_id: currentOrg.id, parent_id: parentId },
      {
        onSuccess: (p) => {
          setSelectedId(p.id);
          if (parentId) {
            setExpanded((prev) => new Set(prev).add(parentId));
          }
        },
        onError: () => toast.error('Erro ao criar página'),
      }
    );
  };

  const handleDelete = (id: string) => {
    if (!confirm('Excluir esta página e todas as subpáginas?')) return;
    deletePage.mutate(id, {
      onSuccess: () => {
        toast.success('Página excluída');
        if (selectedId === id) setSelectedId(undefined);
      },
      onError: () => toast.error('Sem permissão para excluir'),
    });
  };

  if (!currentOrg) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Selecione uma organização
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] bg-background">
      {/* Sidebar de páginas */}
      <aside className="w-72 border-r bg-card flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="text-sm font-semibold">Documentação</h2>
          <Button size="sm" variant="ghost" onClick={() => handleCreate(null)}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2">
            {tree.length === 0 ? (
              <button
                onClick={() => handleCreate(null)}
                className="w-full text-left text-sm text-muted-foreground p-3 rounded-md hover:bg-accent flex items-center gap-2"
              >
                <Plus className="h-4 w-4" /> Criar primeira página
              </button>
            ) : (
              tree.map((node) => (
                <PageTreeItem
                  key={node.id}
                  node={node}
                  depth={0}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onAddChild={(pid) => handleCreate(pid)}
                  onDelete={handleDelete}
                  expanded={expanded}
                  toggle={toggle}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </aside>

      {/* Editor */}
      <main className="flex-1 overflow-auto">
        {selected ? (
          <div className="max-w-3xl mx-auto px-12 py-12">
            <div className="flex items-center gap-3 mb-4">
              <Input
                value={icon}
                onChange={(e) => setIcon(e.target.value.slice(0, 4))}
                className="w-16 text-3xl text-center border-0 bg-transparent focus-visible:ring-0 px-0 h-auto"
              />
              <span className="text-xs text-muted-foreground">
                Atualizado{' '}
                {formatDistanceToNow(new Date(selected.updated_at), {
                  addSuffix: true,
                  locale: ptBR,
                })}
              </span>
            </div>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Sem título"
              className="text-4xl font-bold border-0 bg-transparent focus-visible:ring-0 px-0 h-auto py-2 mb-4 placeholder:text-muted-foreground/40"
            />
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Comece a escrever, ou pressione '/' para comandos..."
              className="min-h-[60vh] border-0 bg-transparent focus-visible:ring-0 px-0 resize-none text-base leading-relaxed placeholder:text-muted-foreground/40"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
            <FileText className="h-12 w-12 opacity-30" />
            <p>Selecione ou crie uma página para começar</p>
            <Button onClick={() => handleCreate(null)}>
              <Plus className="h-4 w-4 mr-2" /> Nova página
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
