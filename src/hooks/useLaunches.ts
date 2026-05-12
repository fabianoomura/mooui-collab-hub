import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';

export type Launch = {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  start_date: string;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type LaunchStage = {
  id: string;
  launch_id: string;
  name: string;
  position: number;
  duration_days: number;
  assignee_id: string | null;
  planned_start: string | null;
  planned_end: string | null;
  actual_end: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

const addDays = (date: string, days: number): string => {
  const d = new Date(date + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

/** Recalcula planned_start/end de cada etapa em ordem.
 *  - 1ª etapa: começa em launch.start_date
 *  - próximas: começam no max(planned_end_anterior, actual_end_anterior) + 1 dia útil-corrido
 *  Se uma etapa tem actual_end > planned_end (atraso), as seguintes são empurradas.
 */
export function recalcStageDates(launchStart: string, stages: LaunchStage[]): LaunchStage[] {
  const sorted = [...stages].sort((a, b) => a.position - b.position);
  let cursor = launchStart;
  return sorted.map((s, i) => {
    const planned_start = i === 0 ? cursor : addDays(cursor, 1);
    const planned_end = addDays(planned_start, Math.max(0, s.duration_days - 1));
    const effectiveEnd = s.actual_end && s.actual_end > planned_end ? s.actual_end : planned_end;
    cursor = effectiveEnd;
    return { ...s, planned_start, planned_end };
  });
}

export function useLaunches() {
  const { currentOrg } = useOrganization();
  return useQuery({
    queryKey: ['launches', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return [];
      const { data, error } = await supabase
        .from('launches')
        .select('*')
        .eq('organization_id', currentOrg.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Launch[];
    },
    enabled: !!currentOrg,
  });
}

export function useLaunch(id: string | undefined) {
  return useQuery({
    queryKey: ['launch', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase.from('launches').select('*').eq('id', id).single();
      if (error) throw error;
      return data as Launch;
    },
    enabled: !!id,
  });
}

export function useLaunchStages(launchId: string | undefined) {
  return useQuery({
    queryKey: ['launch-stages', launchId],
    queryFn: async () => {
      if (!launchId) return [];
      const { data, error } = await supabase
        .from('launch_stages')
        .select('*')
        .eq('launch_id', launchId)
        .order('position');
      if (error) throw error;
      return (data || []) as LaunchStage[];
    },
    enabled: !!launchId,
  });
}

export function useCreateLaunch() {
  const qc = useQueryClient();
  const { currentOrg } = useOrganization();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { name: string; description?: string; start_date: string }) => {
      if (!currentOrg || !user) throw new Error('Sem organização');
      const { data, error } = await supabase.from('launches').insert({
        ...input,
        organization_id: currentOrg.id,
        created_by: user.id,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['launches'] }),
  });
}

export function useDeleteLaunch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('launches').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['launches'] }),
  });
}

export function useUpsertStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (stage: Partial<LaunchStage> & { launch_id: string; name: string; position: number; duration_days: number }) => {
      if (stage.id) {
        const { data, error } = await supabase.from('launch_stages').update(stage).eq('id', stage.id).select().single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase.from('launch_stages').insert(stage).select().single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['launch-stages', vars.launch_id] }),
  });
}

export function useDeleteStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; launch_id: string }) => {
      const { error } = await supabase.from('launch_stages').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['launch-stages', vars.launch_id] }),
  });
}

export function usePersistRecalc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ launchId, stages }: { launchId: string; stages: LaunchStage[] }) => {
      // Persiste planned_start/end recalculados
      await Promise.all(stages.map(s =>
        supabase.from('launch_stages')
          .update({ planned_start: s.planned_start, planned_end: s.planned_end })
          .eq('id', s.id)
      ));
      return launchId;
    },
    onSuccess: (launchId) => qc.invalidateQueries({ queryKey: ['launch-stages', launchId] }),
  });
}
