import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { useProjects, useCreateProject } from '@/hooks/useProjectData';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, FolderKanban, Search, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

export default function KanbanPage() {
  const { data: projects, isLoading } = useProjects();
  const createProject = useCreateProject();
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');

  const activeProjectId = selectedProjectId || projects?.[0]?.id;

  const handleCreateProject = () => {
    const name = newName.trim();
    if (!name) return;
    createProject.mutate(
      { name },
      {
        onSuccess: (project) => {
          setSelectedProjectId(project.id);
          setShowNew(false);
          setNewName('');
          toast.success('Projeto criado!');
        },
        onError: () => toast.error('Erro ao criar projeto'),
      }
    );
  };

  const hasProjects = !!projects && projects.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Quadro Kanban</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie suas tarefas visualmente</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {hasProjects && (
            <Select value={activeProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue placeholder="Selecione um projeto" />
              </SelectTrigger>
              <SelectContent>
                {projects!.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
                      {p.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button onClick={() => setShowNew(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Novo Projeto
          </Button>
        </div>
      </div>

      {hasProjects && activeProjectId && (
        <div className="relative max-w-md">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar tarefas neste quadro…"
            className="pl-8 pr-8 h-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
      )}

      {!isLoading && !hasProjects ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <FolderKanban className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-1">Nenhum projeto ainda</h3>
          <p className="text-muted-foreground text-sm mb-4">Crie seu primeiro projeto para começar a gerenciar tarefas</p>
          <Button onClick={() => setShowNew(true)}>
            <Plus className="h-4 w-4 mr-1" /> Criar Projeto
          </Button>
        </div>
      ) : (
        <KanbanBoard projectId={activeProjectId} search={search} />
      )}

      <Dialog open={showNew} onOpenChange={(o) => { setShowNew(o); if (!o) setNewName(''); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo projeto</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Nome do projeto</Label>
            <Input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreateProject(); } }}
              placeholder="Ex.: Lançamento Q1"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button onClick={handleCreateProject} disabled={!newName.trim() || createProject.isPending}>
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
