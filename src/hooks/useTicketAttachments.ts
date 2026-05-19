import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface TicketAttachment {
  id: string;
  ticket_id: string;
  user_id: string;
  file_name: string;
  file_url: string; // storage path inside the bucket
  file_type: string | null;
  file_size: number | null;
  created_at: string;
  signed_url?: string;
  profile?: { full_name: string | null } | null;
}

const BUCKET = 'ticket-attachments';

export function useTicketAttachments(ticketId: string | null) {
  const qc = useQueryClient();
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['ticket-attachments', ticketId],
    queryFn: async () => {
      if (!ticketId) return [] as TicketAttachment[];
      const { data, error } = await supabase
        .from('ticket_attachments')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const rows = (data || []) as TicketAttachment[];
      // sign urls + author names
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
    enabled: !!ticketId,
  });

  const uploadFile = useMutation({
    mutationFn: async ({ ticketId: tid, file }: { ticketId: string; file: File }) => {
      if (!user) throw new Error('Sem usuário');
      const ext = file.name.split('.').pop() || 'bin';
      const path = `${tid}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type, upsert: false,
      });
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from('ticket_attachments').insert({
        ticket_id: tid,
        user_id: user.id,
        file_url: path,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type || null,
      });
      if (insErr) throw insErr;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ticket-attachments', ticketId] }),
  });

  const deleteAttachment = useMutation({
    mutationFn: async (id: string) => {
      const att = query.data?.find(a => a.id === id);
      if (att) {
        await supabase.storage.from(BUCKET).remove([att.file_url]);
      }
      const { error } = await supabase.from('ticket_attachments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ticket-attachments', ticketId] }),
  });

  return {
    attachments: query.data || [],
    isLoading: query.isLoading,
    uploadFile,
    deleteAttachment,
  };
}
