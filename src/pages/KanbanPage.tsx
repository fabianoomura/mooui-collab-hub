import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { useProjects, useCreateProject } from '@/hooks/useProjectData';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Plus, FolderKanban } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export default function KanbanPage() {
  const { data: projects, isLoading } = useProjects();
  const createProject = useCreateProject();
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  const activeProjectId = selectedProjectId || projects?.[0]?.id;

  const handleCreateProject = () => {
    const name = prompt('Nome do projeto:');
    if (name?.trim()) {
      createProject.mutate(
        { name: name.trim() },
        {
          onSuccess: (project) => {
            setSelectedProjectId(project.id);
            toast.success('Projeto criado!');
          },
        }
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Quadro Kanban</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie suas tarefas visualmente</p>
        </div>

        <div className="flex items-center gap-3">
          {projects && projects.length > 0 && (
            <Select value={activeProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Selecione um projeto" />
              </SelectTrigger>
              <SelectContent>
                {projects.map(p => (
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
          <Button onClick={handleCreateProject} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Novo Projeto
          </Button>
        </div>
      </div>

      {!isLoading && (!projects || projects.length === 0) ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <FolderKanban className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-1">Nenhum projeto ainda</h3>
          <p className="text-muted-foreground text-sm mb-4">Crie seu primeiro projeto para começar a gerenciar tarefas</p>
          <Button onClick={handleCreateProject}>
            <Plus className="h-4 w-4 mr-1" /> Criar Projeto
          </Button>
        </div>
      ) : (
        <KanbanBoard projectId={activeProjectId} />
      )}
    </div>
  );
}
