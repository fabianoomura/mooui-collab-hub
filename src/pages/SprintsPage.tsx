import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProjects } from '@/hooks/useProjectData';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Timer, Loader2, Calendar } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { PromptDialog } from '@/components/PromptDialog';

export default function SprintsPage() {
  const { user } = useAuth();
  const { data: projects } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const queryClient = useQueryClient();

  const activeProjectId = selectedProjectId || projects?.[0]?.id;

  const { data: sprints, isLoading } = useQuery({
    queryKey: ['sprints', activeProjectId],
    queryFn: async () => {
      if (!activeProjectId) return [];
      const { data, error } = await supabase
        .from('sprints')
        .select('*')
        .eq('project_id', activeProjectId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeProjectId,
  });

  const createSprint = useMutation({
    mutationFn: async (name: string) => {
      if (!activeProjectId) throw new Error('Selecione um projeto');
      const { error } = await supabase.from('sprints').insert({
        name,
        project_id: activeProjectId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprints', activeProjectId] });
      toast.success('Sprint criada!');
    },
  });

  const [showNew, setShowNew] = useState(false);

  const handleCreate = () => setShowNew(true);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sprints</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie ciclos de desenvolvimento</p>
        </div>
        <div className="flex items-center gap-3">
          {projects && projects.length > 0 && (
            <Select value={activeProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Selecione um projeto" />
              </SelectTrigger>
              <SelectContent>
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button onClick={handleCreate} size="sm" disabled={!activeProjectId}>
            <Plus className="h-4 w-4 mr-1" /> Nova Sprint
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : !sprints?.length ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <Timer className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-1">Nenhuma sprint ainda</h3>
          <p className="text-muted-foreground text-sm mb-4">Crie sua primeira sprint para organizar tarefas em ciclos</p>
          <Button onClick={handleCreate} disabled={!activeProjectId}>
            <Plus className="h-4 w-4 mr-1" /> Criar Sprint
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {sprints.map((sprint) => (
            <Card key={sprint.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{sprint.name}</CardTitle>
                  <Badge variant={sprint.is_active ? 'default' : 'secondary'}>
                    {sprint.is_active ? 'Ativa' : 'Inativa'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {sprint.goal && <p className="text-sm text-muted-foreground mb-2">{sprint.goal}</p>}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  {sprint.start_date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Início: {new Date(sprint.start_date).toLocaleDateString('pt-BR')}
                    </span>
                  )}
                  {sprint.end_date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Fim: {new Date(sprint.end_date).toLocaleDateString('pt-BR')}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
