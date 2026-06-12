import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface OrderAttachment {
  id: string;
  order_id: string;
  user_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
  signed_url?: string;
  profile?: { full_name: string | null } | null;
}

const BUCKET = 'entity-attachments';

/**
 * Resolves URL for an attachment.
 * Migrated records from order_attachments have bucket-relative paths in old bucket.
 * New records use entity-attachments bucket with the storage_path.
 */
function resolveUrl(storagePath: string): string {
  if (storagePath.startsWith('http://') || storagePath.startsWith('https://')) {
    return storagePath;
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return data?.publicUrl || storagePath;
}

export function useOrderAttachments(orderId: string | null) {
  const qc = useQueryClient();
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['order-attachments', orderId],
    queryFn: async () => {
      if (!orderId) return [] as OrderAttachment[];
      const { data, error } = await supabase
        .from('attachments' as any)
        .select('*, uploader:profiles!uploaded_by(full_name)')
        .eq('entity_type', 'order')
        .eq('entity_id', orderId)
        .order('created_at', { ascending: false });
      if (error) throw error;

      return (data || []).map((a: any) => {
        const url = resolveUrl(a.storage_path);
        return {
          id: a.id,
          order_id: a.entity_id,
          user_id: a.uploaded_by,
          file_name: a.file_name,
          file_url: url,
          file_type: a.file_type || null,
          file_size: a.file_size || null,
          created_at: a.created_at,
          signed_url: url,
          profile: a.uploader || null,
        } as OrderAttachment;
      });
    },
    enabled: !!orderId,
  });

  const uploadFile = useMutation({
    mutationFn: async ({ orderId: oid, file }: { orderId: string; file: File }) => {
      if (!user) throw new Error('Sem usuário');

      // Get org_id from order
      const { data: order } = await supabase
        .from('orders' as any)
        .select('organization_id')
        .eq('id', oid)
        .single();
      const orgId = (order as any)?.organization_id;
      if (!orgId) throw new Error('Pedido não encontrado');

      const ext = file.name.split('.').pop() || 'bin';
      const path = `order/${oid}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type, upsert: false,
      });
      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from('attachments' as any).insert({
        organization_id: orgId,
        entity_type: 'order',
        entity_id: oid,
        storage_path: path,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type || null,
        uploaded_by: user.id,
      } as any);
      if (insErr) throw insErr;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['order-attachments', orderId] }),
  });

  const deleteAttachment = useMutation({
    mutationFn: async (id: string) => {
      // Get storage_path
      const { data: att } = await supabase
        .from('attachments' as any)
        .select('storage_path')
        .eq('id', id)
        .single();
      const path = (att as any)?.storage_path;
      if (path && !path.startsWith('http')) {
        await supabase.storage.from(BUCKET).remove([path]);
      }

      const { error } = await supabase.from('attachments' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['order-attachments', orderId] }),
  });

  return {
    attachments: query.data || [],
    isLoading: query.isLoading,
    uploadFile,
    deleteAttachment,
  };
}
