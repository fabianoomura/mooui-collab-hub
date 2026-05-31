import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateBooking } from '@/hooks/useRoomBookings';
import type { MeetingRoom } from '@/hooks/useMeetingRooms';
import { toast } from 'sonner';
import { format } from 'date-fns';

export function BookingDialog({
  open, onOpenChange, orgId, rooms, defaultRoomId, defaultStart,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orgId: string;
  rooms: MeetingRoom[];
  defaultRoomId?: string;
  defaultStart?: Date;
}) {
  const create = useCreateBooking();
  const [roomId, setRoomId] = useState(defaultRoomId ?? rooms[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(format(defaultStart ?? new Date(), 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState(format(defaultStart ?? new Date(), 'HH:mm'));
  const [endTime, setEndTime] = useState('');

  useEffect(() => {
    if (open) {
      setRoomId(defaultRoomId ?? rooms[0]?.id ?? '');
      const s = defaultStart ?? new Date();
      setDate(format(s, 'yyyy-MM-dd'));
      setStartTime(format(s, 'HH:mm'));
      const end = new Date(s.getTime() + 60 * 60 * 1000);
      setEndTime(format(end, 'HH:mm'));
      setTitle(''); setDescription('');
    }
  }, [open, defaultStart, defaultRoomId, rooms]);

  const submit = () => {
    if (!roomId || !title.trim()) { toast.error('Sala e título obrigatórios'); return; }
    const starts = new Date(`${date}T${startTime}`);
    const ends = new Date(`${date}T${endTime}`);
    if (ends <= starts) { toast.error('Hora de término deve ser depois do início'); return; }
    create.mutate({
      room_id: roomId, organization_id: orgId, title: title.trim(),
      description: description.trim() || undefined,
      starts_at: starts.toISOString(), ends_at: ends.toISOString(),
    }, {
      onSuccess: () => { toast.success('Reserva criada'); onOpenChange(false); },
      onError: (e: any) => toast.error(e?.message?.includes('reservado') ? 'Horário já reservado para esta sala' : 'Erro ao criar reserva'),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
        <DialogHeader><DialogTitle>Nova reserva</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Sala</Label>
            <Select value={roomId} onValueChange={setRoomId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {rooms.map(r => (
                  <SelectItem key={r.id} value={r.id}>
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: r.color }} />
                      {r.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Título</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Reunião de planejamento" /></div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div><Label>Data</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div><Label>Início</Label><Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div>
            <div><Label>Fim</Label><Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></div>
          </div>
          <div><Label>Descrição (opcional)</Label><Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={create.isPending}>Reservar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
