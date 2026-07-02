import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { FixedColumnKey } from '@/features/boards/constants';

export type BoardCustomGroup = {
  key: string;
  label: string;
  color: string;
};

export type BoardPreferences = {
  pinned_task_ids?: string[];
  hidden_dynamic_column_ids?: string[];
  group_names?: Record<string, string>;
  group_colors?: Record<string, string>;
  custom_groups?: BoardCustomGroup[];
  group_order?: string[];
  fixed_column_order?: FixedColumnKey[];
  fixed_column_labels?: Partial<Record<FixedColumnKey, string>>;
  date_reminder_days?: number;
  dynamic_column_filters?: Record<string, string>;
  dynamic_group_column_id?: string | null;
};

type BoardPreferencesRow = {
  preferences: BoardPreferences | null;
};

const db = supabase as any;

function normalizePreferences(value: unknown): BoardPreferences {
  if (!value || typeof value !== 'object') return {};
  const raw = value as Record<string, unknown>;
  return {
    pinned_task_ids: Array.isArray(raw.pinned_task_ids) ? raw.pinned_task_ids.filter((id): id is string => typeof id === 'string') : undefined,
    hidden_dynamic_column_ids: Array.isArray(raw.hidden_dynamic_column_ids) ? raw.hidden_dynamic_column_ids.filter((id): id is string => typeof id === 'string') : undefined,
    group_names: raw.group_names && typeof raw.group_names === 'object' ? raw.group_names as Record<string, string> : undefined,
    group_colors: raw.group_colors && typeof raw.group_colors === 'object' ? raw.group_colors as Record<string, string> : undefined,
    custom_groups: Array.isArray(raw.custom_groups) ? raw.custom_groups.filter((group): group is BoardCustomGroup => {
      const candidate = group as Partial<BoardCustomGroup>;
      return typeof candidate.key === 'string' && typeof candidate.label === 'string' && typeof candidate.color === 'string';
    }) : undefined,
    group_order: Array.isArray(raw.group_order) ? raw.group_order.filter((key): key is string => typeof key === 'string') : undefined,
    fixed_column_order: Array.isArray(raw.fixed_column_order) ? raw.fixed_column_order.filter((key): key is FixedColumnKey => typeof key === 'string') : undefined,
    fixed_column_labels: raw.fixed_column_labels && typeof raw.fixed_column_labels === 'object' ? raw.fixed_column_labels as Partial<Record<FixedColumnKey, string>> : undefined,
    date_reminder_days: typeof raw.date_reminder_days === 'number' ? raw.date_reminder_days : undefined,
    dynamic_column_filters: raw.dynamic_column_filters && typeof raw.dynamic_column_filters === 'object' ? raw.dynamic_column_filters as Record<string, string> : undefined,
    dynamic_group_column_id: typeof raw.dynamic_group_column_id === 'string' || raw.dynamic_group_column_id === null ? raw.dynamic_group_column_id : undefined,
  };
}

export function useBoardPreferences(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['board-preferences', projectId, user?.id],
    queryFn: async () => {
      if (!projectId || !user) return null;
      const { data, error } = await db
        .from('board_preferences')
        .select('preferences')
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return normalizePreferences((data as BoardPreferencesRow).preferences);
    },
    enabled: !!projectId && !!user,
  });

  const updatePreferences = useMutation({
    mutationFn: async (patch: BoardPreferences) => {
      if (!projectId || !user) throw new Error('Missing project or user');
      const previous = query.data || {};
      const preferences = normalizePreferences({ ...previous, ...patch });
      const { error } = await db
        .from('board_preferences')
        .upsert({
          project_id: projectId,
          user_id: user.id,
          preferences,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'project_id,user_id' });
      if (error) throw error;
      return preferences;
    },
    onSuccess: (preferences) => {
      queryClient.setQueryData(['board-preferences', projectId, user?.id], preferences);
    },
  });

  return {
    preferences: query.data,
    isLoading: query.isLoading,
    updatePreferences,
  };
}
