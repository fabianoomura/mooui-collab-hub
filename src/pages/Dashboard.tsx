import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Clock, AlertTriangle, ListTodo } from 'lucide-react';

const stats = [
  { label: 'Total de Tarefas', value: 7, icon: ListTodo, color: 'text-primary' },
  { label: 'Vencem Hoje', value: 1, icon: Clock, color: 'text-warning' },
  { label: 'Atrasadas', value: 2, icon: AlertTriangle, color: 'text-destructive' },
  { label: 'Concluídas esta Semana', value: 3, icon: CheckCircle2, color: 'text-success' },
];

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Painel</h1>
        <p className="text-muted-foreground text-sm mt-1">Visão geral das operações</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Minhas Tarefas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <ListTodo className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Faça login para ver suas tarefas atribuídas</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
