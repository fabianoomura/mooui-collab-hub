import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface SessaoAttachment {
  id: string;
  sessao_id: string;
  user_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
  signed_url?: string;
  profile?: { full_name: string | null } | null;
}

const BUCKET = 'sessao-attachments';

export function useSessaoAttachments(sessaoId: string | null) {
  const qc = useQueryClient();
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['sessao-attachments', sessaoId],
    queryFn: async () => {
      if (!sessaoId) return [] as SessaoAttachment[];
      const { data, error } = await supabase
        .from('sessao_attachments' as any)
        .select('*')
        .eq('sessao_id', sessaoId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const rows = (data || []) as unknown as SessaoAttachment[];
      const userIds = [...new Set(rows.map(r => r.user_id))];
      const { data: profs } = userIds.length
        ? await supabase.from('profiles').select('id, full_name').in('id', userIds)
        : { data: [] as any[] };
      const pMap = new Map((profs || []).map((p: any) => [p.id, p]));
      return Promise.all(rows.map(async r => {
        const { data: s } = await supabase.storage.from(BUCKET).createSignedUrl(r.file_url, 3600);
        return { ...r, signed_url: s?.signedUrl, profile: pMap.get(r.user_id) || null };
      }));
    },
    enabled: !!sessaoId,
  });

  const uploadFile = useMutation({
    mutationFn: async ({ sessaoId: sid, file }: { sessaoId: string; file: File }) => {
      if (!user) throw new Error('Sem usuario');
      const ext = file.name.split('.').pop() || 'bin';
      const path = `${sid}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type, upsert: false,
      });
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from('sessao_attachments' as any).insert({
        sessao_id: sid,
        user_id: user.id,
        file_url: path,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type || null,
      });
      if (insErr) throw insErr;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessao-attachments', sessaoId] }),
  });

  const deleteAttachment = useMutation({
    mutationFn: async (id: string) => {
      const att = query.data?.find(a => a.id === id);
      if (att) await supabase.storage.from(BUCKET).remove([att.file_url]);
      const { error } = await supabase.from('sessao_attachments' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessao-attachments', sessaoId] }),
  });

  return { attachments: query.data || [], isLoading: query.isLoading, uploadFile, deleteAttachment };
}
