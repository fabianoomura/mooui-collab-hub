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

const BUCKET = 'order-attachments';

export function useOrderAttachments(orderId: string | null) {
  const qc = useQueryClient();
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['order-attachments', orderId],
    queryFn: async () => {
      if (!orderId) return [] as OrderAttachment[];
      const { data, error } = await supabase
        .from('order_attachments' as any)
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const rows = (data || []) as unknown as OrderAttachment[];
      const userIds = [...new Set(rows.map(r => r.user_id))];
      const { data: profs } = userIds.length
        ? await supabase.from('profiles').select('id, full_name').in('id', userIds)
        : { data: [] as any[] };
      const pMap = new Map((profs || []).map((p: any) => [p.id, p]));
      const signed = await Promise.all(rows.map(async r => {
        const { data: s } = await supabase.storage.from(BUCKET).createSignedUrl(r.file_url, 3600);
        return { ...r, signed_url: s?.signedUrl, profile: pMap.get(r.user_id) || null };
      }));
      return signed;
    },
    enabled: !!orderId,
  });

  const uploadFile = useMutation({
    mutationFn: async ({ orderId: oid, file }: { orderId: string; file: File }) => {
      if (!user) throw new Error('Sem usuário');
      const ext = file.name.split('.').pop() || 'bin';
      const path = `${oid}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type, upsert: false,
      });
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from('order_attachments' as any).insert({
        order_id: oid,
        user_id: user.id,
        file_url: path,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type || null,
      } as any);
      if (insErr) throw insErr;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['order-attachments', orderId] }),
  });

  const deleteAttachment = useMutation({
    mutationFn: async (id: string) => {
      const att = query.data?.find(a => a.id === id);
      if (att) {
        await supabase.storage.from(BUCKET).remove([att.file_url]);
      }
      const { error } = await supabase.from('order_attachments' as any).delete().eq('id', id);
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
