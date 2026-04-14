import { useState, useCallback } from 'react';

export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type Status = 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done';

export interface KanbanTask {
  id: string;
  title: string;
  description?: string;
  status: Status;
  priority: Priority;
  assignee?: string;
  assigneeInitials?: string;
  dueDate?: string;
  labels: string[];
}

export interface KanbanColumn {
  id: Status;
  title: string;
  tasks: KanbanTask[];
}

const COLUMNS_CONFIG: { id: Status; title: string }[] = [
  { id: 'backlog', title: 'Backlog' },
  { id: 'todo', title: 'A Fazer' },
  { id: 'in_progress', title: 'Em Progresso' },
  { id: 'in_review', title: 'Em Revisão' },
  { id: 'done', title: 'Concluído' },
];

const SAMPLE_TASKS: KanbanTask[] = [
  { id: '1', title: 'Atualizar catálogo de produtos 2025', description: 'Revisar e atualizar todos os produtos do catálogo para a nova coleção.', status: 'todo', priority: 'high', assignee: 'Ana Silva', assigneeInitials: 'AS', dueDate: '2025-02-15', labels: ['Catálogo', 'Marketing'] },
  { id: '2', title: 'Revisar estoque de tecidos', description: 'Verificar quantidades disponíveis e fazer pedidos de reposição.', status: 'in_progress', priority: 'critical', assignee: 'Carlos Mendes', assigneeInitials: 'CM', dueDate: '2025-02-10', labels: ['Estoque'] },
  { id: '3', title: 'Criar posts para Instagram', description: 'Preparar conteúdo visual para as redes sociais da semana.', status: 'in_progress', priority: 'medium', assignee: 'Julia Santos', assigneeInitials: 'JS', labels: ['Marketing', 'Social Media'] },
  { id: '4', title: 'Preparar relatório mensal', description: 'Compilar dados de vendas e operações do mês anterior.', status: 'todo', priority: 'medium', dueDate: '2025-02-05', labels: ['Relatórios'] },
  { id: '5', title: 'Aprovar amostras de nova coleção', status: 'in_review', priority: 'high', assignee: 'Ana Silva', assigneeInitials: 'AS', dueDate: '2025-02-12', labels: ['Produção'] },
  { id: '6', title: 'Configurar novo fornecedor no sistema', status: 'backlog', priority: 'low', labels: ['Operações'] },
  { id: '7', title: 'Enviar pedidos pendentes', status: 'done', priority: 'high', assignee: 'Carlos Mendes', assigneeInitials: 'CM', labels: ['Logística'] },
];

export function useKanbanData() {
  const [tasks, setTasks] = useState<KanbanTask[]>(SAMPLE_TASKS);

  const columns: KanbanColumn[] = COLUMNS_CONFIG.map(col => ({
    ...col,
    tasks: tasks.filter(t => t.status === col.id),
  }));

  const moveTask = useCallback((taskId: string, newStatus: Status, newIndex: number) => {
    setTasks(prev => {
      const task = prev.find(t => t.id === taskId);
      if (!task) return prev;
      return prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t);
    });
  }, []);

  const addTask = useCallback((task: Omit<KanbanTask, 'id'>) => {
    setTasks(prev => [...prev, { ...task, id: crypto.randomUUID() }]);
  }, []);

  const updateTask = useCallback((taskId: string, updates: Partial<KanbanTask>) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));
  }, []);

  return { columns, tasks, moveTask, addTask, updateTask };
}
