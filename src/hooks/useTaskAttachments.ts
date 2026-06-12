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

const BUCKET = 'entity-attachments';

/**
 * Resolves a URL for an attachment.
 * Migrated records have a full URL in storage_path; new records have a bucket-relative path.
 */
function resolveUrl(storagePath: string): string {
  if (storagePath.startsWith('http://') || storagePath.startsWith('https://')) {
    return storagePath;
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return data?.publicUrl || storagePath;
}

export function useTaskAttachments(taskId: string | undefined) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const attachmentsQuery = useQuery({
    queryKey: ['task-attachments', taskId],
    queryFn: async () => {
      if (!taskId) return [];
      const { data, error } = await supabase
        .from('attachments' as any)
        .select('*, uploader:profiles!uploaded_by(full_name)')
        .eq('entity_type', 'task')
        .eq('entity_id', taskId)
        .order('created_at', { ascending: false });
      if (error) throw error;

      return (data || []).map((a: any) => ({
        id: a.id,
        task_id: a.entity_id,
        user_id: a.uploaded_by,
        file_name: a.file_name,
        file_url: resolveUrl(a.storage_path),
        file_type: a.file_type || null,
        file_size: a.file_size || null,
        created_at: a.created_at,
        profile: a.uploader || null,
      })) as TaskAttachment[];
    },
    enabled: !!taskId,
  });

  const uploadFile = useMutation({
    mutationFn: async ({ taskId, file }: { taskId: string; file: File }) => {
      if (!user) throw new Error('Not authenticated');

      // Resolve org_id from task's project
      const { data: task } = await supabase
        .from('tasks')
        .select('project_id, projects(organization_id)')
        .eq('id', taskId)
        .single();
      const orgId = (task as any)?.projects?.organization_id;
      if (!orgId) throw new Error('Could not resolve organization');

      const ext = file.name.split('.').pop() || 'bin';
      const storagePath = `task/${taskId}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from('attachments' as any).insert({
        organization_id: orgId,
        entity_type: 'task',
        entity_id: taskId,
        storage_path: storagePath,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type || null,
        uploaded_by: user.id,
      });
      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-attachments', taskId] });
    },
  });

  const deleteAttachment = useMutation({
    mutationFn: async (attachmentId: string) => {
      // Get the attachment to find storage_path
      const { data: att } = await supabase
        .from('attachments' as any)
        .select('storage_path')
        .eq('id', attachmentId)
        .single();

      // Delete from storage if it's a bucket path (not a legacy full URL)
      const path = (att as any)?.storage_path;
      if (path && !path.startsWith('http')) {
        await supabase.storage.from(BUCKET).remove([path]);
      }

      const { error } = await supabase
        .from('attachments' as any)
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
