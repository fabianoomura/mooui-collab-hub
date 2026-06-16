import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';

export type CalendarEventScope = 'master' | 'sector';
export type CalendarEventCategory = 'campanha' | 'lancamento' | 'sessao' | 'feira' | 'prazo' | 'reuniao';

export interface CalendarEvent {
  id: string;
  organization_id: string;
  source_type: string;
  source_id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  sector: string | null;
  category: CalendarEventCategory;
  scope: CalendarEventScope;
  pinned_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch calendar_events for a given year, optionally filtering by scope and/or sectors.
 */
export function useCalendarEvents(opts?: {
  year?: number;
  scope?: CalendarEventScope;
  sectors?: string[];
  categories?: CalendarEventCategory[];
}) {
  const { currentOrg } = useOrganization();
  const y = opts?.year ?? new Date().getFullYear();

  return useQuery({
    queryKey: ['calendar-events', currentOrg?.id, y, opts?.scope, opts?.sectors, opts?.categories],
    queryFn: async () => {
      if (!currentOrg) return [];
      let q = supabase
        .from('calendar_events' as any)
        .select('*')
        .eq('organization_id', currentOrg.id)
        .gte('starts_at', `${y}-01-01T00:00:00`)
        .lte('starts_at', `${y}-12-31T23:59:59`);

      if (opts?.scope) q = q.eq('scope', opts.scope);
      if (opts?.sectors?.length) q = q.in('sector', opts.sectors);
      if (opts?.categories?.length) q = q.in('category', opts.categories);

      const { data, error } = await q.order('starts_at');
      if (error) throw error;
      return (data || []) as unknown as CalendarEvent[];
    },
    enabled: !!currentOrg,
  });
}

/**
 * Upsert a calendar_event (sync from source).
 * Used internally when annual_events, launches, or bookings are created/updated.
 */
export function useSyncCalendarEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      organization_id: string;
      source_type: string;
      source_id: string;
      title: string;
      description?: string | null;
      starts_at: string;
      ends_at?: string | null;
      sector?: string | null;
      category: CalendarEventCategory;
      scope: CalendarEventScope;
    }) => {
      const { data, error } = await supabase
        .from('calendar_events' as any)
        .upsert(
          {
            organization_id: input.organization_id,
            source_type: input.source_type,
            source_id: input.source_id,
            title: input.title,
            description: input.description ?? null,
            starts_at: input.starts_at,
            ends_at: input.ends_at ?? null,
            sector: input.sector ?? null,
            category: input.category,
            scope: input.scope,
          },
          { onConflict: 'organization_id,source_type,source_id' },
        )
        .select('*')
        .single();
      if (error) throw error;
      return data as unknown as CalendarEvent;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar-events'] }),
  });
}

/**
 * Delete a calendar_event by source reference (when the source item is deleted).
 */
export function useDeleteCalendarEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (opts: { source_type: string; source_id: string; organization_id: string }) => {
      const { error } = await supabase
        .from('calendar_events' as any)
        .delete()
        .eq('organization_id', opts.organization_id)
        .eq('source_type', opts.source_type)
        .eq('source_id', opts.source_id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar-events'] }),
  });
}

/**
 * Toggle "pin to master" on a calendar event.
 * Manager+ only. Sets scope to 'master' and records who pinned it.
 */
export function usePinCalendarEvent() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ id, pin }: { id: string; pin: boolean }) => {
      const { error } = await supabase
        .from('calendar_events' as any)
        .update({
          scope: pin ? 'master' : 'sector',
          pinned_by: pin ? user?.id ?? null : null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar-events'] }),
  });
}
