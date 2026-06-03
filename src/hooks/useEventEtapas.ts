import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type EventEtapaStatus = 'pendente' | 'em_andamento' | 'concluida';

export interface EventEtapa {
  id: string;
  event_id: string;
  etapa_key: string;
  title: string;
  status: EventEtapaStatus;
  responsavel: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export const defaultEventEtapas = [
  { etapa_key: 'briefing', title: 'Briefing', position: 1 },
  { etapa_key: 'conteudo', title: 'Conteudo', position: 2 },
  { etapa_key: 'criativos', title: 'Criativos', position: 3 },
  { etapa_key: 'revisao', title: 'Revisao', position: 4 },
  { etapa_key: 'publicacao', title: 'Publicacao', position: 5 },
];

export function useEventEtapas(eventId: string | null) {
  return useQuery({
    queryKey: ['event-etapas', eventId],
    queryFn: async () => {
      if (!eventId) return [];
      const { data, error } = await supabase
        .from('annual_event_etapas' as any)
        .select('*')
        .eq('event_id', eventId)
        .order('position', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as EventEtapa[];
    },
    enabled: !!eventId,
  });
}

export function useSeedEventEtapas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (eventId: string) => {
      const rows = defaultEventEtapas.map((etapa) => ({
        event_id: eventId,
        ...etapa,
        status: 'pendente',
      }));
      const { error } = await supabase
        .from('annual_event_etapas' as any)
        .upsert(rows, { onConflict: 'event_id,etapa_key' });
      if (error) throw error;
    },
    onSuccess: (_d, eventId) => qc.invalidateQueries({ queryKey: ['event-etapas', eventId] }),
  });
}

export function useUpdateEventEtapa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, event_id, ...patch }: Partial<EventEtapa> & { id: string; event_id: string }) => {
      const { error } = await supabase.from('annual_event_etapas' as any).update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['event-etapas', vars.event_id] }),
  });
}
