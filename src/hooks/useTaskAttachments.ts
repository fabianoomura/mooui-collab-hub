import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface TaskAttachment {
  id: string;
  task_id: string;
  user_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
  profile?: { full_name: string | null } | null;
}

export function useTaskAttachments(taskId: string | undefined) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const attachmentsQuery = useQuery({
    queryKey: ['task-attachments', taskId],
    queryFn: async () => {
      if (!taskId) return [];
      const { data, error } = await supabase
        .from('task_attachments')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const userIds = [...new Set((data || []).map(a => a.user_id))];
      if (userIds.length === 0) return data as TaskAttachment[];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));

      return (data || []).map(a => ({
        ...a,
        profile: profileMap.get(a.user_id) || null,
      })) as TaskAttachment[];
    },
    enabled: !!taskId,
  });

  const uploadFile = useMutation({
    mutationFn: async ({ taskId, file }: { taskId: string; file: File }) => {
      if (!user) throw new Error('Not authenticated');

      const ext = file.name.split('.').pop();
      const path = `${taskId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('task-attachments')
        .upload(path, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('task-attachments')
        .getPublicUrl(path);

      const { error: dbError } = await supabase.from('task_attachments').insert({
        task_id: taskId,
        user_id: user.id,
        file_name: file.name,
        file_url: urlData.publicUrl,
        file_type: file.type || null,
        file_size: file.size,
      });
      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-attachments', taskId] });
    },
  });

  const deleteAttachment = useMutation({
    mutationFn: async (attachmentId: string) => {
      const { error } = await supabase
        .from('task_attachments')
        .delete()
        .eq('id', attachmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-attachments', taskId] });
    },
  });

  return {
    attachments: attachmentsQuery.data || [],
    isLoading: attachmentsQuery.isLoading,
    uploadFile,
    deleteAttachment,
  };
}
