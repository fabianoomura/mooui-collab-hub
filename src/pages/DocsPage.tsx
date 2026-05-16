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
import { Plus, FileText, Trash2, MoreHorizontal, Folder, ChevronDown, ChevronRight, Menu, X } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { NewPageDialog } from '@/components/docs/NewPageDialog';
import { PagePermissions } from '@/components/docs/PagePermissions';
import { IconPicker } from '@/components/docs/IconPicker';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

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

  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [icon, setIcon] = useState('📄');
  const [showNew, setShowNew] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = useIsMobile();

  const selected = pages.find((p) => p.id === selectedId);

  const profileIds = useMemo(() => {
    const s = new Set<string>();
    pages.forEach(p => { s.add(p.created_by); if (p.updated_by) s.add(p.updated_by); });
    return [...s];
  }, [pages]);
  const { data: profiles = [] } = useProfilesByIds(profileIds);
  const profileMap = useMemo(() => Object.fromEntries(profiles.map(p => [p.id, p])), [profiles]);

  // Group pages by department
  const grouped = useMemo(() => {
    const byDept = new Map<string, DocPage[]>();
    pages.forEach((p) => {
      const k = p.department_id ?? '__none__';
      if (!byDept.has(k)) byDept.set(k, []);
      byDept.get(k)!.push(p);
    });
    byDept.forEach((arr) => arr.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'pt-BR')));
    const groups = departments
      .map((d) => ({ id: d.id, name: d.name, color: d.color, pages: byDept.get(d.id) ?? [] }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    const orphan = byDept.get('__none__') ?? [];
    if (orphan.length) groups.push({ id: '__none__', name: 'Sem setor', color: '#9CA3AF', pages: orphan });
    return groups;
  }, [pages, departments]);

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
    if (title === selected.title && content === (selected.content || '') && icon === (selected.icon || '📄')) return;
    const t = setTimeout(() => {
      updatePage.mutate({ id: selected.id, title, content, icon }, {
        onError: () => toast.error('Sem permissão para editar este documento'),
      });
    }, 700);
    return () => clearTimeout(t);
  }, [title, content, icon]); // eslint-disable-line

  const toggleGroup = (id: string) => setCollapsed(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const handleCreate = (input: { title: string; icon: string; department_id: string | null }) => {
    if (!currentOrg) return;
    createPage.mutate(
      { organization_id: currentOrg.id, ...input },
      {
        onSuccess: (p) => { setSelectedId(p.id); setShowNew(false); toast.success('Página criada'); },
        onError: () => toast.error('Erro ao criar página'),
      }
    );
  };

  const handleDelete = (id: string) => {
    if (!confirm('Excluir esta página?')) return;
    deletePage.mutate(id, {
      onSuccess: () => { toast.success('Página excluída'); if (selectedId === id) setSelectedId(undefined); },
      onError: () => toast.error('Sem permissão para excluir'),
    });
  };

  if (!currentOrg) {
    return <div className="flex items-center justify-center h-full text-muted-foreground">Selecione uma organização</div>;
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] bg-background">
      <aside className="hidden md:flex w-72 border-r bg-card flex-col">
        {sidebarContent}
      </aside>
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="p-0 w-[85vw] max-w-xs">{sidebarContent}</SheetContent>
      </Sheet>
      <main className="flex-1 overflow-auto">
        {selected ? (
          <div className="max-w-3xl mx-auto px-6 sm:px-12 py-8 sm:py-12">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <IconPicker value={icon} onChange={setIcon} />
              <div className="flex-1 min-w-[200px] flex flex-wrap gap-x-4 gap-y-1">
                <UserChip profile={profileMap[selected.created_by]} label="Autor:" />
                {selected.updated_by && (
                  <UserChip profile={profileMap[selected.updated_by]} label="Editado por:" />
                )}
              </div>
              <PagePermissions
                page={selected}
                disabled={!isAdmin}
                onChange={(patch) => updatePage.mutate({ id: selected.id, ...patch }, {
                  onSuccess: () => toast.success('Permissões atualizadas'),
                  onError: () => toast.error('Erro ao atualizar permissões'),
                })}
              />
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Criado em {format(new Date(selected.created_at), 'dd/MM/yyyy', { locale: ptBR })}
              {' · '}
              Atualizado {formatDistanceToNow(new Date(selected.updated_at), { addSuffix: true, locale: ptBR })}
            </p>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Sem título"
              className="text-3xl sm:text-4xl font-bold border-0 bg-transparent focus-visible:ring-0 px-0 h-auto py-2 mb-4 placeholder:text-muted-foreground/40"
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
    </div>
  );
}
