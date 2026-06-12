import { useMemo, useState } from 'react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useMeetingRooms, useRoomBookings, useDeleteBooking, type RoomBooking } from '@/features/rooms';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Settings2, Trash2, Users } from 'lucide-react';
import { addDays, startOfWeek, format, isSameDay, startOfDay, startOfMonth, endOfMonth, addMonths } from 'date-fns';
import { useIsMobile } from '@/hooks/use-mobile';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ptBR } from 'date-fns/locale';
import { ManageRoomsDialog } from '@/components/rooms/ManageRoomsDialog';
import { BookingDialog } from '@/components/rooms/BookingDialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useConfirm } from '@/components/ConfirmDialog';

const HOURS = Array.from({ length: 12 }, (_, i) => i + 8); // 8h..19h


export default function RoomsPage() {
  const { currentOrg, isAdmin } = useOrganization();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { data: rooms = [] } = useMeetingRooms(currentOrg?.id);
  const confirm = useConfirm();
  const [roomId, setRoomId] = useState<string>('__all__');
  const [view, setView] = useState<'month' | 'week' | 'day'>(isMobile ? 'day' : 'month');
  const [weekStart, setWeekStart] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [day, setDay] = useState<Date>(startOfDay(new Date()));
  const [month, setMonth] = useState<Date>(startOfMonth(new Date()));
  const [showManage, setShowManage] = useState(false);
  const [showBooking, setShowBooking] = useState(false);
  const [presetStart, setPresetStart] = useState<Date | undefined>();
  const [presetRoom, setPresetRoom] = useState<string | undefined>();

  const range = useMemo(
    () => view === 'week'
      ? { from: weekStart, to: addDays(weekStart, 7) }
      : view === 'day'
        ? { from: day, to: addDays(day, 1) }
        : { from: startOfMonth(month), to: addDays(endOfMonth(month), 1) },
    [view, weekStart, day, month],
  );
  const { data: bookings = [] } = useRoomBookings(currentOrg?.id, roomId === '__all__' ? undefined : roomId, range);
  const delBooking = useDeleteBooking();


  const userIds = useMemo(() => [...new Set(bookings.map(b => b.user_id))], [bookings]);
  const { data: profiles = [] } = useQuery({
    queryKey: ['booking-profiles', userIds.sort().join(',')],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id,full_name,avatar_url').in('id', userIds);
      if (error) throw error;
      return data as { id: string; full_name: string | null; avatar_url: string | null }[];
    },
  });
  const profileMap = useMemo(() => Object.fromEntries(profiles.map(p => [p.id, p])), [profiles]);
  const roomMap = useMemo(() => Object.fromEntries(rooms.map(r => [r.id, r])), [rooms]);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  if (!currentOrg) {
    return <div className="flex items-center justify-center h-full text-muted-foreground">Selecione uma organização</div>;
  }

  return (
    <div className="container max-w-7xl mx-auto py-4 sm:py-6 px-3 sm:px-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5 text-primary" />
          <h1 className="text-xl sm:text-2xl font-bold">Salas de Reunião</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={roomId} onValueChange={setRoomId}>
            <SelectTrigger className="w-full sm:w-44 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas as salas</SelectItem>
              {rooms.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => setShowManage(true)}>
              <Settings2 className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Gerenciar salas</span>
            </Button>
          )}
          <Button size="sm" onClick={() => { setPresetStart(undefined); setPresetRoom(roomId === '__all__' ? undefined : roomId); setShowBooking(true); }}
            disabled={rooms.length === 0}>
            <Plus className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">Nova reserva</span>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => {
            if (view === 'week') setWeekStart(addDays(weekStart, -7));
            else if (view === 'day') setDay(addDays(day, -1));
            else setMonth(addMonths(month, -1));
          }}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-0">
            {view === 'week'
              ? `${format(weekStart, "d 'de' MMM", { locale: ptBR })} – ${format(addDays(weekStart, 6), "d 'de' MMM yyyy", { locale: ptBR })}`
              : view === 'day'
                ? format(day, "EEEE, d 'de' MMM", { locale: ptBR })
                : format(month, "MMMM 'de' yyyy", { locale: ptBR })}
          </span>
          <Button variant="ghost" size="icon" onClick={() => {
            if (view === 'week') setWeekStart(addDays(weekStart, 7));
            else if (view === 'day') setDay(addDays(day, 1));
            else setMonth(addMonths(month, 1));
          }}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => {
            setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
            setDay(startOfDay(new Date()));
            setMonth(startOfMonth(new Date()));
          }}>Hoje</Button>
        </div>
        <Tabs value={view} onValueChange={(v) => setView(v as 'month' | 'week' | 'day')}>
          <TabsList className="h-8">
            <TabsTrigger value="month" className="text-xs px-3">Resumo</TabsTrigger>
            <TabsTrigger value="day" className="text-xs px-3">Dia</TabsTrigger>
            <TabsTrigger value="week" className="text-xs px-3">Semana</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>


      {rooms.length === 0 ? (
        <div className="border rounded-lg p-8 text-center text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-2 opacity-40" />
          <p className="mb-3">Nenhuma sala cadastrada ainda.</p>
          {isAdmin && <Button onClick={() => setShowManage(true)}>Cadastrar primeira sala</Button>}
        </div>
      ) : view === 'month' ? (
        <MonthResumo
          month={month}
          setMonth={setMonth}
          bookings={bookings}
          roomMap={roomMap}
          onPickDay={(d) => { setDay(startOfDay(d)); setView('day'); }}
        />
      ) : view === 'week' ? (
        <div className="border rounded-lg overflow-x-auto bg-card">
          <div className="min-w-[700px]">
            <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b bg-muted/30">
              <div />
              {days.map(d => (
                <div key={d.toISOString()} className={`p-2 text-center text-xs ${isSameDay(d, new Date()) ? 'bg-primary/10' : ''}`}>
                  <div className="font-medium uppercase">{format(d, 'EEE', { locale: ptBR })}</div>
                  <div className="text-muted-foreground">{format(d, 'd/MM')}</div>
                </div>
              ))}
            </div>
            {HOURS.map(h => (
              <div key={h} className="grid grid-cols-[60px_repeat(7,1fr)] border-b last:border-b-0 min-h-[60px]">
                <div className="text-[10px] text-muted-foreground p-1 text-right pr-2 border-r">{h}:00</div>
                {days.map(d => {
                  const slotStart = new Date(d); slotStart.setHours(h, 0, 0, 0);
                  const slotEnd = new Date(d); slotEnd.setHours(h + 1, 0, 0, 0);
                  const cellBookings = bookings.filter(b => {
                    const s = new Date(b.starts_at), e = new Date(b.ends_at);
                    return s < slotEnd && e > slotStart && isSameDay(s, d) && s.getHours() === h;
                  });
                  return (
                    <div key={d.toISOString() + h} className="border-r last:border-r-0 p-0.5 relative cursor-pointer hover:bg-accent/30"
                      onClick={() => { setPresetStart(slotStart); setPresetRoom(roomId === '__all__' ? undefined : roomId); setShowBooking(true); }}>
                      {cellBookings.map(b => (
                        <BookingBlock
                          key={b.id} booking={b}
                          room={roomMap[b.room_id]}
                          profile={profileMap[b.user_id]}
                          canDelete={isAdmin || b.user_id === user?.id}
                          onDelete={async () => {
                            const ok = await confirm({ title: 'Excluir esta reserva?', destructive: true, confirmText: 'Excluir' });
                            if (!ok) return;
                            delBooking.mutate({ id: b.id, organization_id: currentOrg?.id }, {
                              onSuccess: () => toast.success('Reserva excluída'),
                              onError: () => toast.error('Sem permissão'),
                            });
                          }}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="border rounded-lg bg-card overflow-hidden">
          {HOURS.map(h => {
            const slotStart = new Date(day); slotStart.setHours(h, 0, 0, 0);
            const slotEnd = new Date(day); slotEnd.setHours(h + 1, 0, 0, 0);
            const cellBookings = bookings.filter(b => {
              const s = new Date(b.starts_at);
              return s < slotEnd && new Date(b.ends_at) > slotStart && isSameDay(s, day) && s.getHours() === h;
            });
            return (
              <div key={h} className="grid grid-cols-[48px_1fr] border-b last:border-b-0 min-h-[56px]">
                <div className="text-[10px] text-muted-foreground p-1 text-right pr-2 border-r pt-1.5">{h}:00</div>
                <div
                  className="p-1.5 cursor-pointer hover:bg-accent/30 space-y-1"
                  onClick={() => { setPresetStart(slotStart); setPresetRoom(roomId === '__all__' ? undefined : roomId); setShowBooking(true); }}
                >
                  {cellBookings.length === 0 && <div className="h-full" />}
                  {cellBookings.map(b => (
                    <BookingBlock
                      key={b.id} booking={b}
                      room={roomMap[b.room_id]}
                      profile={profileMap[b.user_id]}
                      canDelete={isAdmin || b.user_id === user?.id}
                      onDelete={async () => {
                        const ok = await confirm({ title: 'Excluir esta reserva?', destructive: true, confirmText: 'Excluir' });
                        if (!ok) return;
                        delBooking.mutate({ id: b.id, organization_id: currentOrg?.id }, {
                          onSuccess: () => toast.success('Reserva excluída'),
                          onError: () => toast.error('Sem permissão'),
                        });
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ManageRoomsDialog open={showManage} onOpenChange={setShowManage} orgId={currentOrg.id} />
      <BookingDialog
        open={showBooking}
        onOpenChange={setShowBooking}
        orgId={currentOrg.id}
        rooms={rooms}
        defaultRoomId={presetRoom}
        defaultStart={presetStart}
      />
    </div>
  );
}

function BookingBlock({ booking, room, profile, canDelete, onDelete }: {
  booking: RoomBooking;
  room?: { name: string; color: string };
  profile?: { full_name: string | null; avatar_url: string | null };
  canDelete: boolean;
  onDelete: () => void;
}) {
  const initials = (profile?.full_name ?? '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const start = format(new Date(booking.starts_at), 'HH:mm');
  const end = format(new Date(booking.ends_at), 'HH:mm');
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className="block w-full text-left rounded text-[10px] px-1.5 py-1 mb-0.5 truncate text-white"
          style={{ background: room?.color ?? 'hsl(var(--primary))' }}
        >
          <span className="font-semibold">{start}</span> {booking.title}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64">
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">{booking.title}</h4>
          <p className="text-xs text-muted-foreground">{room?.name} · {start} – {end}</p>
          {booking.description && <p className="text-sm">{booking.description}</p>}
          <div className="flex items-center gap-2 pt-1">
            <Avatar className="h-6 w-6">
              {profile?.avatar_url && <AvatarImage src={profile.avatar_url} />}
              <AvatarFallback className="text-[9px]">{initials}</AvatarFallback>
            </Avatar>
            <span className="text-xs">{profile?.full_name ?? 'Usuário'}</span>
          </div>
          {canDelete && (
            <Button size="sm" variant="ghost" className="w-full text-destructive" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5 mr-1" />Excluir reserva
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function MonthResumo({
  month, setMonth, bookings, roomMap, onPickDay,
}: {
  month: Date;
  setMonth: (d: Date) => void;
  bookings: RoomBooking[];
  roomMap: Record<string, { name: string; color: string }>;
  onPickDay: (d: Date) => void;
}) {
  // Group bookings by yyyy-mm-dd of local start
  const byDay = useMemo(() => {
    const m: Record<string, RoomBooking[]> = {};
    bookings.forEach((b) => {
      const k = format(new Date(b.starts_at), 'yyyy-MM-dd');
      (m[k] ||= []).push(b);
    });
    return m;
  }, [bookings]);

  const bookedDates = useMemo(
    () => Object.keys(byDay).map((k) => new Date(k + 'T00:00:00')),
    [byDay],
  );

  const dayList = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, list]) => ({ key: k, date: new Date(k + 'T00:00:00'), list }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-4">
      <div className="border rounded-lg bg-card p-2 flex justify-center">
        <Calendar
          mode="single"
          month={month}
          onMonthChange={setMonth}
          locale={ptBR}
          weekStartsOn={1}
          modifiers={{ booked: bookedDates }}
          modifiersClassNames={{
            booked: 'relative font-semibold text-primary after:content-[""] after:absolute after:left-1/2 after:-translate-x-1/2 after:bottom-1 after:h-1 after:w-1 after:rounded-full after:bg-primary',
          }}
          onDayClick={(d) => onPickDay(d)}
        />
      </div>

      <div className="border rounded-lg bg-card p-3 overflow-hidden">
        <h3 className="text-sm font-semibold mb-2">
          Reservas em {format(month, "MMMM 'de' yyyy", { locale: ptBR })}
        </h3>
        {dayList.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Nenhuma reserva neste mês.
          </p>
        ) : (
          <ul className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {dayList.map(({ key, date, list }) => (
              <li key={key}>
                <button
                  onClick={() => onPickDay(date)}
                  className="w-full text-left rounded-md border p-2 hover:bg-accent/40 transition-colors"
                >
                  <div className="text-xs font-medium uppercase text-muted-foreground mb-1">
                    {format(date, "EEE, d 'de' MMM", { locale: ptBR })} · {list.length} {list.length === 1 ? 'reserva' : 'reservas'}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {list.slice(0, 4).map((b) => (
                      <span
                        key={b.id}
                        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-white"
                        style={{ background: roomMap[b.room_id]?.color ?? 'hsl(var(--primary))' }}
                      >
                        {format(new Date(b.starts_at), 'HH:mm')} · {b.title}
                      </span>
                    ))}
                    {list.length > 4 && (
                      <span className="text-[10px] text-muted-foreground">+{list.length - 4}</span>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

