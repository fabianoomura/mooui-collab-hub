import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface MelhoriaAttachment {
  id: string;
  melhoria_id: string;
  user_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
  signed_url?: string;
  profile?: { full_name: string | null } | null;
}

const BUCKET = 'melhoria-attachments';

export function useMelhoriaAttachments(melhoriaId: string | null) {
  const qc = useQueryClient();
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['melhoria-attachments', melhoriaId],
    queryFn: async () => {
      if (!melhoriaId) return [] as MelhoriaAttachment[];
      const { data, error } = await supabase
        .from('melhoria_attachments' as any)
        .select('*')
        .eq('melhoria_id', melhoriaId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const rows = (data || []) as unknown as MelhoriaAttachment[];
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
    enabled: !!melhoriaId,
  });

  const uploadFile = useMutation({
    mutationFn: async ({ melhoriaId: mid, file }: { melhoriaId: string; file: File }) => {
      if (!user) throw new Error('Sem usuário');
      const ext = file.name.split('.').pop() || 'bin';
      const path = `${mid}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type, upsert: false,
      });
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from('melhoria_attachments' as any).insert({
        melhoria_id: mid,
        user_id: user.id,
        file_url: path,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type || null,
      });
      if (insErr) throw insErr;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['melhoria-attachments', melhoriaId] }),
  });

  const deleteAttachment = useMutation({
    mutationFn: async (id: string) => {
      const att = query.data?.find(a => a.id === id);
      if (att) {
        await supabase.storage.from(BUCKET).remove([att.file_url]);
      }
      const { error } = await supabase.from('melhoria_attachments' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['melhoria-attachments', melhoriaId] }),
  });

  return {
    attachments: query.data || [],
    isLoading: query.isLoading,
    uploadFile,
    deleteAttachment,
  };
}
