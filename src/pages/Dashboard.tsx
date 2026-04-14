import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Clock, AlertTriangle, ListTodo, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export default function Dashboard() {
  const { user } = useAuth();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const { data: tasks } = await supabase.from('tasks').select('id, status, due_date');
      const allTasks = tasks || [];
      const today = new Date().toISOString().split('T')[0];
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

      return {
        total: allTasks.length,
        dueToday: allTasks.filter(t => t.due_date === today && t.status !== 'done').length,
        overdue: allTasks.filter(t => t.due_date && t.due_date < today && t.status !== 'done').length,
        completedWeek: allTasks.filter(t => t.status === 'done').length,
      };
    },
    enabled: !!user,
  });

  const { data: myTasks } = useQuery({
    queryKey: ['my-tasks'],
    queryFn: async () => {
      if (!user) return [];
      const { data: assignments } = await supabase
        .from('task_assignees')
        .select('task_id')
        .eq('user_id', user.id);
      if (!assignments?.length) return [];
      const taskIds = assignments.map(a => a.task_id);
      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, title, status, priority, due_date')
        .in('id', taskIds)
        .neq('status', 'done')
        .order('due_date', { ascending: true, nullsFirst: false });
      return tasks || [];
    },
    enabled: !!user,
  });

  const cards = [
    { label: 'Total de Tarefas', value: stats?.total ?? 0, icon: ListTodo, color: 'text-primary' },
    { label: 'Vencem Hoje', value: stats?.dueToday ?? 0, icon: Clock, color: 'text-warning' },
    { label: 'Atrasadas', value: stats?.overdue ?? 0, icon: AlertTriangle, color: 'text-destructive' },
    { label: 'Concluídas', value: stats?.completedWeek ?? 0, icon: CheckCircle2, color: 'text-success' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Painel</h1>
        <p className="text-muted-foreground text-sm mt-1">Visão geral das operações</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                <div className="text-3xl font-bold">{stat.value}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Minhas Tarefas</CardTitle>
        </CardHeader>
        <CardContent>
          {!myTasks?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <ListTodo className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Nenhuma tarefa atribuída a você</p>
            </div>
          ) : (
            <div className="space-y-2">
              {myTasks.map(task => (
                <div key={task.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <span className="text-sm font-medium">{task.title}</span>
                  {task.due_date && (
                    <span className="text-xs text-muted-foreground">
                      {new Date(task.due_date).toLocaleDateString('pt-BR')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
