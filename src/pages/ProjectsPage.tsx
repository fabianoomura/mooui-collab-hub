import { useProjectsByOrg, useCreateProject } from '@/hooks/useProjectData';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, FolderKanban, Users, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export default function ProjectsPage() {
  const navigate = useNavigate();
  const { currentOrg } = useOrganization();
  const { data: projects, isLoading } = useProjectsByOrg(currentOrg?.id);
  const createProject = useCreateProject();

  const handleCreateProject = () => {
    const name = prompt('Nome do projeto:');
    if (name?.trim()) {
      const description = prompt('Descrição (opcional):') || '';
      createProject.mutate(
        { name: name.trim(), description: description || undefined, organizationId: currentOrg?.id },
        { onSuccess: () => toast.success('Projeto criado!') }
      );
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Projetos</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie todos os seus projetos</p>
        </div>
        <Button onClick={handleCreateProject}>
          <Plus className="h-4 w-4 mr-1" /> Novo Projeto
        </Button>
      </div>

      {!projects?.length ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <FolderKanban className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-1">Nenhum projeto ainda</h3>
          <p className="text-muted-foreground text-sm mb-4">Crie seu primeiro projeto para começar</p>
          <Button onClick={handleCreateProject}>
            <Plus className="h-4 w-4 mr-1" /> Criar Projeto
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <Card
              key={project.id}
              onClick={() => navigate(`/tabela?projeto=${project.id}`)}
              className="hover:shadow-md hover:border-primary/40 transition-all cursor-pointer"
            >
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: project.color }} />
                  <CardTitle className="text-base">{project.name}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  {project.description || 'Sem descrição'}
                </p>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    <Users className="h-3 w-3 mr-1" />
                    {project.project_members?.length || 0} membros
                  </Badge>
                  <Badge variant="outline" className="text-xs capitalize">{project.status}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
