import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MeetingRoom {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  capacity: number | null;
  color: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export function useMeetingRooms(orgId?: string) {
  return useQuery({
    queryKey: ['meeting-rooms', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meeting_rooms')
        .select('*')
        .eq('organization_id', orgId!)
        .order('name', { ascending: true });
      if (error) throw error;
      return data as MeetingRoom[];
    },
  });
}

export function useCreateMeetingRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { organization_id: string; name: string; description?: string; capacity?: number; color?: string; }) => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) throw new Error('Não autenticado');
      const { data, error } = await supabase.from('meeting_rooms').insert({
        ...input, created_by: uid, color: input.color ?? '#D6336C',
      }).select().single();
      if (error) throw error;
      return data as MeetingRoom;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['meeting-rooms', v.organization_id] }),
  });
}

export function useUpdateMeetingRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<MeetingRoom> & { id: string }) => {
      const { data, error } = await supabase.from('meeting_rooms').update(patch).eq('id', id).select().single();
      if (error) throw error;
      return data as MeetingRoom;
    },
    onSuccess: (d) => qc.invalidateQueries({ queryKey: ['meeting-rooms', d.organization_id] }),
  });
}

export function useDeleteMeetingRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('meeting_rooms').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meeting-rooms'] }),
  });
}
