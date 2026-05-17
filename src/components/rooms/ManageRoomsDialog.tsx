import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, Plus } from 'lucide-react';
import {
  useMeetingRooms, useCreateMeetingRoom, useDeleteMeetingRoom, useUpdateMeetingRoom,
} from '@/hooks/useMeetingRooms';
import { toast } from 'sonner';
import { useConfirm } from '@/components/ConfirmDialog';

const COLORS = ['#D6336C', '#7C3AED', '#2563EB', '#059669', '#EA580C', '#DC2626'];

export function ManageRoomsDialog({ open, onOpenChange, orgId }: { open: boolean; onOpenChange: (v: boolean) => void; orgId: string }) {
  const { data: rooms = [] } = useMeetingRooms(orgId);
  const create = useCreateMeetingRoom();
  const del = useDeleteMeetingRoom();
  const upd = useUpdateMeetingRoom();
  const confirm = useConfirm();
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState(4);
  const [color, setColor] = useState(COLORS[0]);

  const submit = () => {
    if (!name.trim()) return;
    create.mutate({ organization_id: orgId, name: name.trim(), capacity, color }, {
      onSuccess: () => { setName(''); setCapacity(4); toast.success('Sala criada'); },
      onError: () => toast.error('Erro ao criar sala'),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Gerenciar salas</DialogTitle></DialogHeader>

        <div className="space-y-3 border rounded-md p-3 bg-muted/30">
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2"><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sala Azul" /></div>
            <div><Label>Capacidade</Label><Input type="number" min={1} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} /></div>
            <div>
              <Label>Cor</Label>
              <div className="flex gap-1 mt-2">
                {COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setColor(c)}
                    className={`h-6 w-6 rounded-full border-2 ${color === c ? 'border-foreground' : 'border-transparent'}`}
                    style={{ background: c }} />
                ))}
              </div>
            </div>
          </div>
          <Button size="sm" onClick={submit} className="w-full"><Plus className="h-4 w-4 mr-1" />Adicionar sala</Button>
        </div>

        <ul className="space-y-1 max-h-60 overflow-auto">
          {rooms.map(r => (
            <li key={r.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent">
              <span className="h-3 w-3 rounded-full" style={{ background: r.color }} />
              <Input defaultValue={r.name} className="h-7 flex-1" onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== r.name) upd.mutate({ id: r.id, name: v });
              }} />
              <span className="text-xs text-muted-foreground">{r.capacity} pess.</span>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                onClick={async () => {
                  const ok = await confirm({ title: `Excluir "${r.name}"?`, destructive: true, confirmText: 'Excluir' });
                  if (ok) del.mutate(r.id);
                }}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
          {rooms.length === 0 && <li className="text-sm text-muted-foreground text-center py-4">Nenhuma sala cadastrada</li>}
        </ul>

        <DialogFooter><Button onClick={() => onOpenChange(false)}>Fechar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
