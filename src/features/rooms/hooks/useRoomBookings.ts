import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

async function syncBookingToCalendar(booking: any) {
  await supabase.from('calendar_events' as any).upsert({
    organization_id: booking.organization_id,
    source_type: 'booking',
    source_id: booking.id,
    title: booking.title,
    description: booking.description ?? null,
    starts_at: booking.starts_at,
    ends_at: booking.ends_at,
    sector: null,
    category: 'reuniao',
    scope: 'sector',
  }, { onConflict: 'organization_id,source_type,source_id' });
}

export interface RoomBooking {
  id: string;
  room_id: string;
  organization_id: string;
  user_id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  created_at: string;
  updated_at: string;
}

export function useRoomBookings(orgId?: string, roomId?: string, range?: { from: Date; to: Date }) {
  return useQuery({
    queryKey: ['room-bookings', orgId, roomId, range?.from.toISOString(), range?.to.toISOString()],
    enabled: !!orgId,
    queryFn: async () => {
      let q = supabase.from('meeting_room_bookings').select('*').eq('organization_id', orgId!);
      if (roomId) q = q.eq('room_id', roomId);
      if (range) q = q.gte('starts_at', range.from.toISOString()).lte('starts_at', range.to.toISOString());
      const { data, error } = await q.order('starts_at', { ascending: true });
      if (error) throw error;
      return data as RoomBooking[];
    },
  });
}

export function useCreateBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { room_id: string; organization_id: string; title: string; description?: string; starts_at: string; ends_at: string; }) => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) throw new Error('Não autenticado');
      const { data, error } = await supabase.from('meeting_room_bookings').insert({ ...input, user_id: uid }).select().single();
      if (error) throw error;
      return data as RoomBooking;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['room-bookings'] });
      if (data) syncBookingToCalendar(data).then(() => qc.invalidateQueries({ queryKey: ['calendar-events'] }));
    },
  });
}

export function useDeleteBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, organization_id }: { id: string; organization_id?: string }) => {
      if (organization_id) {
        await supabase.from('calendar_events' as any).delete()
          .eq('source_type', 'booking').eq('source_id', id).eq('organization_id', organization_id);
      }
      const { error } = await supabase.from('meeting_room_bookings').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['room-bookings'] });
      qc.invalidateQueries({ queryKey: ['calendar-events'] });
    },
  });
}
