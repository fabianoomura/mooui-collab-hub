import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';

export type NewsletterStatus = 'nao_iniciado' | 'em_andamento' | 'enviado';
export type NewsletterChannel = 'brasil' | 'barcelona';

export interface Newsletter {
  id: string;
  organization_id: string;
  title: string;
  scheduled_date: string | null;
  status: NewsletterStatus;
  tema: string | null;
  base: string | null;
  hora: string | null;
  titulo_email: string | null;
  open_rate: number | null;
  click_rate: number | null;
  channel: NewsletterChannel;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export function useNewsletters() {
  const { currentOrg } = useOrganization();
  return useQuery({
    queryKey: ['newsletters', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return [];
      const { data, error } = await supabase
        .from('newsletters' as any)
        .select('*')
        .eq('organization_id', currentOrg.id)
        .order('scheduled_date', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data || []) as unknown as Newsletter[];
    },
    enabled: !!currentOrg,
  });
}

export function useCreateNewsletter() {
  const { currentOrg } = useOrganization();
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      scheduled_date?: string;
      tema?: string;
      base?: string;
      hora?: string;
      titulo_email?: string;
      channel?: NewsletterChannel;
      notes?: string;
    }) => {
      if (!currentOrg || !user) throw new Error('Sem organização');
      const { data, error } = await supabase.from('newsletters' as any).insert({
        organization_id: currentOrg.id,
        created_by: user.id,
        title: input.title,
        scheduled_date: input.scheduled_date || null,
        status: 'nao_iniciado',
        tema: input.tema || null,
        base: input.base || null,
        hora: input.hora || null,
        titulo_email: input.titulo_email || null,
        channel: input.channel || 'brasil',
        notes: input.notes || null,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['newsletters'] }),
  });
}

export function useUpdateNewsletter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Newsletter> & { id: string }) => {
      const { error } = await supabase.from('newsletters' as any).update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['newsletters'] }),
  });
}

export function useDeleteNewsletter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('newsletters' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['newsletters'] }),
  });
}
