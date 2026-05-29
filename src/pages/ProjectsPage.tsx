import { useProjectsByOrg, useCreateProject } from '@/hooks/useProjectData';
import { useOrganization } from '@/contexts/OrganizationContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Plus, FolderKanban, Users, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

export default function ProjectsPage() {
  const navigate = useNavigate();
  const { currentOrg } = useOrganization();
  const { data: projects, isLoading } = useProjectsByOrg(currentOrg?.id);
  const createProject = useCreateProject();
  const { canDo } = usePermissions();

  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const reset = () => { setName(''); setDescription(''); };

  const handleCreateProject = () => {
    const n = name.trim();
    if (!n) return;
    createProject.mutate(
      { name: n, description: description.trim() || undefined, organizationId: currentOrg?.id },
      {
        onSuccess: () => {
          toast.success('Projeto criado!');
          setShowNew(false);
          reset();
        },
        onError: () => toast.error('Erro ao criar projeto'),
      }
    );
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
          <h1 className="text-2xl font-bold text-foreground">Sunday</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie todos os seus projetos</p>
        </div>
        {canDo('create_project') && (
          <Button onClick={() => setShowNew(true)}>
            <Plus className="h-4 w-4 mr-1" /> Novo Projeto
          </Button>
        )}
      </div>

      {!projects?.length ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <FolderKanban className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-1">Nenhum projeto ainda</h3>
          <p className="text-muted-foreground text-sm mb-4">Crie seu primeiro projeto para começar</p>
          {canDo('create_project') && (
            <Button onClick={() => setShowNew(true)}>
              <Plus className="h-4 w-4 mr-1" /> Criar Projeto
            </Button>
          )}
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

      <Dialog open={showNew} onOpenChange={(o) => { setShowNew(o); if (!o) reset(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo projeto</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome</Label>
              <Input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) { e.preventDefault(); handleCreateProject(); } }}
                placeholder="Ex.: Lançamento Q1"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Descrição (opcional)</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Sobre o que é este projeto?"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button onClick={handleCreateProject} disabled={!name.trim() || createProject.isPending}>
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
