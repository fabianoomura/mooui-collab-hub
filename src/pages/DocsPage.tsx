import { useEffect, useMemo, useState } from 'react';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  useDocPages, useCreateDocPage, useUpdateDocPage, useDeleteDocPage, type DocPage,
} from '@/hooks/useDocPages';
import { useDepartments } from '@/hooks/useOrgSettings';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MarkdownEditor } from '@/components/docs/MarkdownEditor';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, FileText, Trash2, MoreHorizontal, Folder, ChevronDown, ChevronRight, Menu, Search, X, Check, Loader2, Plus as PlusIcon, Star, Download, FileArchive, LayoutTemplate, Lock } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { NewPageDialog } from '@/components/docs/NewPageDialog';
import { PagePermissions } from '@/components/docs/PagePermissions';
import { IconPicker } from '@/components/docs/IconPicker';
import { TemplatePickerDialog } from '@/components/docs/TemplatePickerDialog';
import { useConfirm } from '@/components/ConfirmDialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useDocFavorites, useToggleFavorite } from '@/hooks/useDocFavorites';
import JSZip from 'jszip';

interface ProfileLite { id: string; full_name: string | null; avatar_url: string | null; }

function useProfilesByIds(ids: string[]) {
  const key = [...new Set(ids)].sort().join(',');
  return useQuery({
    queryKey: ['profiles-lite', key],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id,full_name,avatar_url').in('id', [...new Set(ids)]);
      if (error) throw error;
      return data as ProfileLite[];
    },
  });
}

function UserChip({ profile, label }: { profile?: ProfileLite; label: string }) {
  const initials = (profile?.full_name ?? '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      {label}
      <Avatar className="h-4 w-4">
        {profile?.avatar_url && <AvatarImage src={profile.avatar_url} />}
        <AvatarFallback className="text-[8px]">{initials}</AvatarFallback>
      </Avatar>
      <span className="font-medium text-foreground/80">{profile?.full_name ?? '—'}</span>
    </span>
  );
}

export default function DocsPage() {
  const { currentOrg, isAdmin } = useOrganization();
  const { data: pages = [] } = useDocPages(currentOrg?.id);
  const { data: departments = [] } = useDepartments(currentOrg?.id);
  const createPage = useCreateDocPage();
  const updatePage = useUpdateDocPage();
  const deletePage = useDeleteDocPage();
  const confirm = useConfirm();

  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [icon, setIcon] = useState('📄');
  const [showNew, setShowNew] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const { data: favorites = new Set<string>() } = useDocFavorites();
  const toggleFavorite = useToggleFavorite();

  const selected = pages.find((p) => p.id === selectedId);

  const profileIds = useMemo(() => {
    const s = new Set<string>();
    pages.forEach(p => { s.add(p.created_by); if (p.updated_by) s.add(p.updated_by); });
    return [...s];
  }, [pages]);
  const { data: profiles = [] } = useProfilesByIds(profileIds);
  const profileMap = useMemo(() => Object.fromEntries(profiles.map(p => [p.id, p])), [profiles]);

  // Group pages by department + build children map for nesting
  const childrenMap = useMemo(() => {
    const m = new Map<string, DocPage[]>();
    pages.forEach(p => {
      if (p.parent_id) {
        const arr = m.get(p.parent_id) || [];
        arr.push(p);
        m.set(p.parent_id, arr);
      }
    });
    m.forEach(arr => arr.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'pt-BR')));
    return m;
  }, [pages]);

  // Breadcrumb path for selected
  const breadcrumbs = useMemo(() => {
    if (!selected) return [] as DocPage[];
    const path: DocPage[] = [];
    let cur: DocPage | undefined = selected;
    const guard = new Set<string>();
    while (cur && !guard.has(cur.id)) {
      guard.add(cur.id);
      path.unshift(cur);
      cur = cur.parent_id ? pages.find(p => p.id === cur!.parent_id) : undefined;
    }
    return path;
  }, [selected, pages]);

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q ? pages.filter(p => (p.title || '').toLowerCase().includes(q) || (p.content || '').toLowerCase().includes(q)) : pages;
    const byDept = new Map<string, DocPage[]>();
    filtered.forEach((p) => {
      // When searching, show all matches at top level (flat); otherwise only root pages here
      if (!q && p.parent_id) return;
      const k = p.department_id ?? '__none__';
      if (!byDept.has(k)) byDept.set(k, []);
      byDept.get(k)!.push(p);
    });
    byDept.forEach((arr) => arr.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'pt-BR')));
    const groups = departments
      .map((d) => ({ id: d.id, name: d.name, color: d.color, pages: byDept.get(d.id) ?? [] }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
      .filter((g) => !q || g.pages.length > 0);
    const orphan = byDept.get('__none__') ?? [];
    if (orphan.length) groups.push({ id: '__none__', name: 'Sem setor', color: '#9CA3AF', pages: orphan });
    return groups;
  }, [pages, departments, search]);

  const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set());
  const togglePage = (id: string) => setExpandedPages(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  // Auto-expand ancestors of selected
  useEffect(() => {
    if (!selected) return;
    setExpandedPages(prev => {
      const n = new Set(prev);
      let cur = selected.parent_id ? pages.find(p => p.id === selected.parent_id) : undefined;
      while (cur) {
        n.add(cur.id);
        cur = cur.parent_id ? pages.find(p => p.id === cur!.parent_id) : undefined;
      }
      return n;
    });
  }, [selectedId, pages]); // eslint-disable-line

  useEffect(() => {
    if (!selectedId && pages.length > 0) setSelectedId(pages[0].id);
  }, [pages, selectedId]);

  useEffect(() => {
    if (selected) {
      setTitle(selected.title);
      setContent(selected.content || '');
      setIcon(selected.icon || '📄');
    }
  }, [selectedId]); // eslint-disable-line

  // autosave
  useEffect(() => {
    if (!selected) return;
    if (title === selected.title && content === (selected.content || '') && icon === (selected.icon || '📄')) {
      setSaveState('idle');
      return;
    }
    setSaveState('saving');
    const t = setTimeout(() => {
      updatePage.mutate({ id: selected.id, title, content, icon }, {
        onSuccess: () => {
          setSaveState('saved');
          setTimeout(() => setSaveState((s) => (s === 'saved' ? 'idle' : s)), 1500);
        },
        onError: () => { setSaveState('idle'); toast.error('Sem permissão para editar este documento'); },
      });
    }, 700);
    return () => clearTimeout(t);
  }, [title, content, icon]); // eslint-disable-line

  const toggleGroup = (id: string) => setCollapsed(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const handleCreate = (input: { title: string; icon: string; department_id: string | null; content?: string }) => {
    if (!currentOrg) return;
    createPage.mutate(
      { organization_id: currentOrg.id, ...input },
      {
        onSuccess: (p) => { setSelectedId(p.id); setShowNew(false); toast.success(input.content ? 'Página importada' : 'Página criada'); },
        onError: () => toast.error('Erro ao criar página'),
      }
    );
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({ title: 'Excluir esta página?', destructive: true, confirmText: 'Excluir' });
    if (!ok) return;
    deletePage.mutate(id, {
      onSuccess: () => { toast.success('Página excluída'); if (selectedId === id) setSelectedId(undefined); },
      onError: () => toast.error('Sem permissão para excluir'),
    });
  };

  const slug = (s: string) => (s || 'sem-titulo').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'sem-titulo';

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const exportPageMd = (p: DocPage) => {
    const md = `# ${p.title || 'Sem título'}\n\n${p.content || ''}`;
    downloadBlob(new Blob([md], { type: 'text/markdown;charset=utf-8' }), `${slug(p.title)}.md`);
  };

  const exportPageWithChildren = async (root: DocPage) => {
    const zip = new JSZip();
    const walk = (node: DocPage, folder: JSZip) => {
      const md = `# ${node.title || 'Sem título'}\n\n${node.content || ''}`;
      const children = childrenMap.get(node.id) || [];
      if (children.length > 0) {
        const sub = folder.folder(slug(node.title))!;
        sub.file('index.md', md);
        children.forEach((c) => walk(c, sub));
      } else {
        folder.file(`${slug(node.title)}.md`, md);
      }
    };
    walk(root, zip);
    const blob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(blob, `${slug(root.title)}.zip`);
    toast.success('Exportado com sub-páginas');
  };


  if (!currentOrg) {
    return <div className="flex items-center justify-center h-full text-muted-foreground">Selecione uma organização</div>;
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h2 className="text-sm font-semibold">Documentação</h2>
        <div className="flex items-center gap-0.5">
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="A partir de template"
            onClick={() => { setShowTemplates(true); setSidebarOpen(false); }}>
            <LayoutTemplate className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Nova página"
            onClick={() => { setShowNew(true); setSidebarOpen(false); }}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="px-3 py-2 border-b">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar páginas…"
            className="h-8 pl-7 pr-7 text-sm"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Limpar"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {!search && favorites.size > 0 && (
            <div className="mb-2">
              <div className="flex items-center gap-1 px-2 py-1 text-xs uppercase tracking-wider text-muted-foreground">
                <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                <span className="font-semibold">Favoritos</span>
              </div>
              <div className="ml-2">
                {pages.filter(p => favorites.has(p.id)).map(p => (
                  <div
                    key={`fav-${p.id}`}
                    onClick={() => { setSelectedId(p.id); setSidebarOpen(false); }}
                    className={cn(
                      'flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-accent',
                      selectedId === p.id && 'bg-accent text-accent-foreground font-medium'
                    )}
                  >
                    <span className="text-base leading-none">{p.icon || '📄'}</span>
                    <span className="truncate">{p.title || 'Sem título'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {grouped.length === 0 || pages.length === 0 ? (
            search ? (
              <p className="text-xs text-muted-foreground p-3">Nenhuma página corresponde a "{search}"</p>
            ) : (
            <button
              onClick={() => { setShowNew(true); setSidebarOpen(false); }}
              className="w-full text-left text-sm text-muted-foreground p-3 rounded-md hover:bg-accent flex items-center gap-2"
            >
              <Plus className="h-4 w-4" /> Criar primeira página
            </button>
            )
          ) : grouped.map((g) => {
            const isOpen = !!search || !collapsed.has(g.id);
            return (
              <div key={g.id}>
                <button
                  onClick={() => toggleGroup(g.id)}
                  className="w-full flex items-center gap-1 px-2 py-1 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
                >
                  {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  <Folder className="h-3.5 w-3.5" style={{ color: g.color }} />
                  <span className="font-semibold">{g.name}</span>
                  <span className="ml-auto text-[10px]">{g.pages.length}</span>
                </button>
                {isOpen && (
                  <div className="ml-2">
                    {g.pages.map((p) => (
                      <PageNode
                        key={p.id}
                        page={p}
                        depth={0}
                        childrenMap={childrenMap}
                        expandedPages={expandedPages}
                        togglePage={togglePage}
                        selectedId={selectedId}
                        onSelect={(id) => { setSelectedId(id); setSidebarOpen(false); }}
                        onDelete={handleDelete}
                        onAddChild={(parentId) => {
                          if (!currentOrg) return;
                          const parent = pages.find(x => x.id === parentId);
                          createPage.mutate(
                            { organization_id: currentOrg.id, parent_id: parentId, department_id: parent?.department_id ?? null, title: 'Sem título' },
                            { onSuccess: (np) => { setSelectedId(np.id); setExpandedPages(prev => new Set(prev).add(parentId)); } }
                          );
                        }}
                      />
                    ))}
                    {g.pages.length === 0 && (
                      <div className="px-2 py-1 text-xs text-muted-foreground italic">Sem páginas</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );

  return (
    <div className="flex h-[calc(100vh-3.5rem)] bg-background">
      <aside className="hidden md:flex w-72 border-r bg-card flex-col">
        {sidebarContent}
      </aside>
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="p-0 w-[85vw] max-w-xs">{sidebarContent}</SheetContent>
      </Sheet>
      <main className="flex-1 overflow-auto min-w-0">
        <div className="md:hidden sticky top-0 z-10 flex items-center gap-2 px-3 py-2 border-b bg-background/95 backdrop-blur">
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <span className="text-sm font-medium truncate">
            {selected ? `${selected.icon || '📄'} ${selected.title || 'Sem título'}` : 'Documentação'}
          </span>
        </div>
        {selected ? (
          <div className="max-w-3xl mx-auto px-4 sm:px-12 py-6 sm:py-12">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <IconPicker value={icon} onChange={setIcon} />
              <div className="flex-1 min-w-[200px] flex flex-wrap gap-x-4 gap-y-1">
                <UserChip profile={profileMap[selected.created_by]} label="Autor:" />
                {selected.updated_by && (
                  <UserChip profile={profileMap[selected.updated_by]} label="Editado por:" />
                )}
              </div>
              <button
                onClick={() => toggleFavorite.mutate({ pageId: selected.id, on: !favorites.has(selected.id) })}
                title={favorites.has(selected.id) ? 'Remover dos favoritos' : 'Favoritar'}
                className="h-8 w-8 flex items-center justify-center rounded hover:bg-accent"
              >
                <Star className={cn('h-4 w-4', favorites.has(selected.id) && 'fill-yellow-400 text-yellow-400')} />
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="h-8 w-8 flex items-center justify-center rounded hover:bg-accent" title="Exportar">
                    <Download className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => exportPageMd(selected)}>
                    <FileText className="h-3.5 w-3.5 mr-2" /> Exportar página (.md)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportPageWithChildren(selected)}>
                    <FileArchive className="h-3.5 w-3.5 mr-2" /> Exportar com sub-páginas (.zip)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <PagePermissions
                page={selected}
                disabled={!isAdmin}
                onChange={(patch) => updatePage.mutate({ id: selected.id, ...patch }, {
                  onSuccess: () => toast.success('Permissões atualizadas'),
                  onError: () => toast.error('Erro ao atualizar permissões'),
                })}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-4">
              <span>
                Criado em {format(new Date(selected.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                {' · '}
                Atualizado {formatDistanceToNow(new Date(selected.updated_at), { addSuffix: true, locale: ptBR })}
              </span>
              {saveState === 'saving' && (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Salvando…
                </span>
              )}
              {saveState === 'saved' && (
                <span className="inline-flex items-center gap-1 text-green-600">
                  <Check className="h-3 w-3" /> Salvo
                </span>
              )}
            </div>
            {breadcrumbs.length > 1 && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2 flex-wrap">
                {breadcrumbs.slice(0, -1).map((b) => (
                  <span key={b.id} className="flex items-center gap-1">
                    <button onClick={() => setSelectedId(b.id)} className="hover:text-foreground hover:underline">
                      {b.icon || '📄'} {b.title || 'Sem título'}
                    </button>
                    <ChevronRight className="h-3 w-3" />
                  </span>
                ))}
                <span className="text-foreground/80">{selected.title || 'Sem título'}</span>
              </div>
            )}
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Sem título"
              className="text-2xl sm:text-4xl font-bold border-0 bg-transparent focus-visible:ring-0 px-0 h-auto py-2 mb-4 placeholder:text-muted-foreground/40"
            />
            <MarkdownEditor
              value={content}
              onChange={setContent}
              placeholder="Comece a escrever em Markdown… use a barra de ferramentas para inserir tabelas, checklists, código, citações e mais."
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
            <FileText className="h-12 w-12 opacity-30" />
            <p>Selecione ou crie uma página para começar</p>
            <Button onClick={() => setShowNew(true)}>
              <Plus className="h-4 w-4 mr-2" /> Nova página
            </Button>
          </div>
        )}
      </main>

      <NewPageDialog
        open={showNew}
        onOpenChange={setShowNew}
        orgId={currentOrg.id}
        onCreate={handleCreate}
      />
      <TemplatePickerDialog
        open={showTemplates}
        onOpenChange={setShowTemplates}
        orgId={currentOrg.id}
        onPick={(t) => handleCreate({ title: t.name, icon: t.icon || '📄', department_id: null, content: t.content })}
      />
    </div>
  );
}

function PageNode({
  page, depth, childrenMap, expandedPages, togglePage, selectedId, onSelect, onDelete, onAddChild,
}: {
  page: DocPage;
  depth: number;
  childrenMap: Map<string, DocPage[]>;
  expandedPages: Set<string>;
  togglePage: (id: string) => void;
  selectedId?: string;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onAddChild: (parentId: string) => void;
}) {
  const children = childrenMap.get(page.id) || [];
  const hasChildren = children.length > 0;
  const isOpen = expandedPages.has(page.id);
  return (
    <div>
      <div
        onClick={() => onSelect(page.id)}
        style={{ paddingLeft: depth * 12 }}
        className={cn(
          'group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-accent',
          selectedId === page.id && 'bg-accent text-accent-foreground font-medium'
        )}
      >
        {hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); togglePage(page.id); }}
            className="h-4 w-4 flex items-center justify-center text-muted-foreground hover:text-foreground"
          >
            {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        ) : (
          <span className="w-4" />
        )}
        <span className="text-base leading-none">{page.icon || '📄'}</span>
        <span className="truncate flex-1">{page.title || 'Sem título'}</span>
        <button
          onClick={(e) => { e.stopPropagation(); onAddChild(page.id); }}
          className="md:opacity-0 md:group-hover:opacity-100 h-6 w-6 flex items-center justify-center rounded hover:bg-background"
          title="Nova sub-página"
        >
          <PlusIcon className="h-3 w-3" />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button onClick={(e) => e.stopPropagation()}
              className="md:opacity-0 md:group-hover:opacity-100 h-6 w-6 flex items-center justify-center rounded hover:bg-background">
              <MoreHorizontal className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onAddChild(page.id)}>
              <PlusIcon className="h-3.5 w-3.5 mr-2" /> Nova sub-página
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => onDelete(page.id)}
            >
              <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {isOpen && hasChildren && (
        <div>
          {children.map(c => (
            <PageNode
              key={c.id}
              page={c}
              depth={depth + 1}
              childrenMap={childrenMap}
              expandedPages={expandedPages}
              togglePage={togglePage}
              selectedId={selectedId}
              onSelect={onSelect}
              onDelete={onDelete}
              onAddChild={onAddChild}
            />
          ))}
        </div>
      )}
    </div>
  );
}
