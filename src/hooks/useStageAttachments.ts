import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface StageAttachment {
  id: string;
  stage_id: string;
  user_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
  profile?: { full_name: string | null } | null;
}

export function useStageAttachments(stageId: string | undefined) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const attachmentsQuery = useQuery({
    queryKey: ['stage-attachments', stageId],
    queryFn: async () => {
      if (!stageId) return [];
      const { data, error } = await supabase
        .from('launch_stage_attachments' as any)
        .select('*')
        .eq('stage_id', stageId)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const userIds = [...new Set((data || []).map((a: any) => a.user_id))];
      if (userIds.length === 0) return data as StageAttachment[];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));

      return (data || []).map((a: any) => ({
        ...a,
        profile: profileMap.get(a.user_id) || null,
      })) as StageAttachment[];
    },
    enabled: !!stageId,
  });

  const uploadFile = useMutation({
    mutationFn: async ({ stageId, file }: { stageId: string; file: File }) => {
      if (!user) throw new Error('Not authenticated');

      const ext = file.name.split('.').pop();
      const path = `${stageId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('launch-stage-attachments')
        .upload(path, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('launch-stage-attachments')
        .getPublicUrl(path);

      const { error: dbError } = await supabase.from('launch_stage_attachments' as any).insert({
        stage_id: stageId,
        user_id: user.id,
        file_name: file.name,
        file_url: urlData.publicUrl,
        file_type: file.type || null,
        file_size: file.size,
      });
      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stage-attachments', stageId] });
    },
  });

  const deleteAttachment = useMutation({
    mutationFn: async (attachmentId: string) => {
      const { error } = await supabase
        .from('launch_stage_attachments' as any)
        .delete()
        .eq('id', attachmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stage-attachments', stageId] });
    },
  });

  return {
    attachments: attachmentsQuery.data || [],
    isLoading: attachmentsQuery.isLoading,
    uploadFile,
    deleteAttachment,
  };
}
