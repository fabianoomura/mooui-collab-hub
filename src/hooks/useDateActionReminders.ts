import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { TaskWithAssignees } from '@/hooks/useProjectData';

const db = supabase as any;

function flattenTasks(tasks: TaskWithAssignees[]): TaskWithAssignees[] {
  return tasks.flatMap(task => [task, ...(task.subtasks || [])]);
}

function reminderDate(dueDate: string, leadDays: number): string {
  const date = new Date(`${dueDate}T09:00:00`);
  date.setDate(date.getDate() - leadDays);
  return date.toISOString();
}

export function useDateActionReminders(projectId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const configureDateActionReminders = useMutation({
    mutationFn: async ({ leadDays, tasks }: { leadDays: number; tasks: TaskWithAssignees[] }) => {
      if (!projectId || !user) throw new Error('Missing project or user');
      const eligibleTasks = flattenTasks(tasks).filter(task => !!task.due_date && task.status !== 'done');
      if (eligibleTasks.length === 0) return 0;

      const rows = eligibleTasks.map(task => ({
        project_id: projectId,
        task_id: task.id,
        user_id: user.id,
        source_column: 'due_date',
        lead_days: leadDays,
        remind_at: reminderDate(task.due_date!, leadDays),
        status: 'pending',
        metadata: {
          title: task.title,
          due_date: task.due_date,
          ticket_number: task.ticket_number,
        },
      }));

      const { error } = await db
        .from('board_task_reminders')
        .upsert(rows, { onConflict: 'task_id,user_id,source_column,lead_days' });
      if (error) throw error;
      return rows.length;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board-task-reminders', projectId, user?.id] });
    },
  });

  return { configureDateActionReminders };
}
