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

export function useLaunches(instanceId?: string) {
  const { currentOrg } = useOrganization();
  return useQuery({
    queryKey: ['launches', currentOrg?.id, instanceId ?? null],
    queryFn: async () => {
      if (!currentOrg) return [];
      let q = supabase
        .from('launches')
        .select('*')
        .eq('organization_id', currentOrg.id);
      if (instanceId) q = q.eq('instance_id', instanceId);
      const { data, error } = await q.order('created_at', { ascending: false });
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
    mutationFn: async (input: { name: string; description?: string; start_date: string; instance_id?: string | null }) => {
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

export function useReorderStages() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ launchId, orderedIds }: { launchId: string; orderedIds: string[] }) => {
      await Promise.all(orderedIds.map((id, idx) =>
        supabase.from('launch_stages').update({ position: idx }).eq('id', id)
      ));
      return launchId;
    },
    onSuccess: (launchId) => qc.invalidateQueries({ queryKey: ['launch-stages', launchId] }),
  });
}

export function useDuplicateLaunch() {
  const qc = useQueryClient();
  const { currentOrg } = useOrganization();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!currentOrg || !user) throw new Error('Sem organização');
      const { data: src } = await supabase.from('launches').select('*').eq('id', id).single();
      if (!src) throw new Error('Lançamento não encontrado');
      const { data: newLaunch, error } = await supabase.from('launches').insert({
        organization_id: currentOrg.id,
        created_by: user.id,
        name: `${src.name} (cópia)`,
        description: src.description,
        start_date: new Date().toISOString().split('T')[0],
      }).select().single();
      if (error) throw error;
      const { data: srcStages } = await supabase.from('launch_stages')
        .select('*').eq('launch_id', id).order('position');
      if (srcStages?.length) {
        await supabase.from('launch_stages').insert(
          srcStages.map((s: any) => ({
            launch_id: newLaunch.id,
            name: s.name,
            position: s.position,
            duration_days: s.duration_days,
            assignee_id: s.assignee_id,
            status: 'pending',
          }))
        );
      }
      return newLaunch;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['launches'] }),
  });
}

const DEFAULT_TEMPLATE = [
  { name: 'Briefing & moodboard', duration_days: 5 },
  { name: 'Produção', duration_days: 14 },
  { name: 'Fotos', duration_days: 7 },
  { name: 'Cadastro ERP', duration_days: 3 },
  { name: 'Site (descrição + fotos)', duration_days: 5 },
  { name: 'Lançamento', duration_days: 1 },
];

export function useSeedDefaultStages() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (launchId: string) => {
      await supabase.from('launch_stages').insert(
        DEFAULT_TEMPLATE.map((t, i) => ({
          launch_id: launchId,
          name: t.name,
          position: i,
          duration_days: t.duration_days,
          status: 'pending',
        }))
      );
      return launchId;
    },
    onSuccess: (launchId) => qc.invalidateQueries({ queryKey: ['launch-stages', launchId] }),
  });
}

