import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';

export type Attachment = {
  id: string;
  organization_id: string;
  entity_type: string;
  entity_id: string;
  storage_path: string;
  file_name: string;
  file_size: number | null;
  file_type: string | null;
  uploaded_by: string;
  created_at: string;
  uploader?: { full_name: string | null };
};

const BUCKET = 'entity-attachments';

export function useAttachments(entityType: string, entityId: string | undefined) {
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id;

  return useQuery({
    queryKey: ['attachments', entityType, entityId],
    queryFn: async () => {
      if (!orgId || !entityId) return [];
      const { data, error } = await supabase
        .from('attachments' as any)
        .select('*, uploader:profiles!uploaded_by(full_name)')
        .eq('organization_id', orgId)
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Attachment[];
    },
    enabled: !!orgId && !!entityId,
  });
}

export function useUploadAttachment() {
  const qc = useQueryClient();
  const { currentOrg } = useOrganization();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: { entityType: string; entityId: string; file: File }) => {
      if (!currentOrg || !user) throw new Error('Sem organização ou usuário');

      const ext = input.file.name.split('.').pop() || 'bin';
      const storagePath = `${input.entityType}/${input.entityId}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, input.file, { contentType: input.file.type, upsert: false });
      if (uploadError) throw uploadError;

      const { data, error } = await supabase
        .from('attachments' as any)
        .insert({
          organization_id: currentOrg.id,
          entity_type: input.entityType,
          entity_id: input.entityId,
          storage_path: storagePath,
          file_name: input.file.name,
          file_size: input.file.size,
          file_type: input.file.type || null,
          uploaded_by: user.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['attachments', vars.entityType, vars.entityId] });
    },
  });
}

export function useDeleteAttachment() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, storagePath, entityType, entityId }: {
      id: string; storagePath: string; entityType: string; entityId: string;
    }) => {
      // Delete from storage first
      await supabase.storage.from(BUCKET).remove([storagePath]);
      // Delete record
      const { error } = await supabase.from('attachments' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['attachments', vars.entityType, vars.entityId] });
    },
  });
}

export function useAttachmentUrl(storagePath: string | undefined) {
  if (!storagePath) return null;
  // Migrated records may have a full URL stored in storage_path
  if (storagePath.startsWith('http://') || storagePath.startsWith('https://')) {
    return storagePath;
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return data?.publicUrl || null;
}
