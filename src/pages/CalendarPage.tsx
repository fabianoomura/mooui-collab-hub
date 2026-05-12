import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { useAnnualEvents, useCreateAnnualEvent, useUpdateAnnualEvent, useDeleteAnnualEvent, type AnnualEvent } from '@/hooks/useAnnualEvents';
import { toast } from 'sonner';

const CATEGORIES = [
  { value: 'lancamento', label: 'Lançamento', color: '#D6336C' },
  { value: 'acao', label: 'Ação', color: '#2563EB' },
  { value: 'marco', label: 'Marco', color: '#16A34A' },
  { value: 'data', label: 'Data importante', color: '#F59E0B' },
];
const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export default function CalendarPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', description: '', category: 'acao', start_date: '', end_date: '' });

  const { data: events = [], isLoading } = useAnnualEvents(year);
  const createEvt = useCreateAnnualEvent();
  const updateEvt = useUpdateAnnualEvent();
  const deleteEvt = useDeleteAnnualEvent();

  const byMonth = useMemo(() => {
    const map: Record<number, AnnualEvent[]> = {};
    for (let i = 0; i < 12; i++) map[i] = [];
    events.forEach(e => {
      const m = new Date(e.start_date + 'T00:00:00').getMonth();
      map[m].push(e);
    });
    return map;
  }, [events]);

  const openNew = (monthIdx?: number) => {
    const m = monthIdx ?? new Date().getMonth();
    const dd = String(new Date().getDate()).padStart(2, '0');
    const mm = String(m + 1).padStart(2, '0');
    setEditingId(null);
    setForm({ title: '', description: '', category: 'acao', start_date: `${year}-${mm}-${dd}`, end_date: '' });
    setOpen(true);
  };

  const openEdit = (e: AnnualEvent) => {
    setEditingId(e.id);
    setForm({
      title: e.title,
      description: e.description || '',
      category: e.category,
      start_date: e.start_date,
      end_date: e.end_date || '',
    });
    setOpen(true);
  };

  const handleSave = () => {
    if (!form.title.trim() || !form.start_date) return;
    const cat = CATEGORIES.find(c => c.value === form.category)!;
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      category: form.category,
      color: cat.color,
      start_date: form.start_date,
      end_date: form.end_date || null,
    };
    if (editingId) {
      updateEvt.mutate({ id: editingId, ...payload }, {
        onSuccess: () => { toast.success('Evento atualizado'); setOpen(false); },
        onError: (e: any) => toast.error(e.message),
      });
    } else {
      createEvt.mutate({ ...payload, project_id: null }, {
        onSuccess: () => { toast.success('Evento criado'); setOpen(false); },
        onError: (e: any) => toast.error(e.message),
      });
    }
  };

  const handleDelete = () => {
    if (!editingId) return;
    if (!confirm('Excluir este evento?')) return;
    deleteEvt.mutate(editingId, {
      onSuccess: () => { toast.success('Evento excluído'); setOpen(false); },
      onError: (e: any) => toast.error(e.message),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Calendário Anual</h1>
          <p className="text-muted-foreground text-sm mt-1">Planejamento de lançamentos, ações e datas-chave</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setYear(y => y - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-lg font-semibold w-16 text-center">{year}</span>
          <Button variant="outline" size="icon" onClick={() => setYear(y => y + 1)}><ChevronRight className="h-4 w-4" /></Button>
          <Button onClick={() => openNew()} className="ml-2"><Plus className="h-4 w-4 mr-1" /> Novo evento</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {MONTHS.map((m, i) => (
          <Card key={m} className="p-4 min-h-[180px] flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">{m}</h3>
              <button onClick={() => openNew(i)} className="text-muted-foreground hover:text-primary">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-1.5 flex-1">
              {byMonth[i].length === 0 && !isLoading && (
                <p className="text-xs text-muted-foreground italic">Sem eventos</p>
              )}
              {byMonth[i].map(e => (
                <button
                  key={e.id}
                  onClick={() => openEdit(e)}
                  className="group w-full flex items-start gap-2 p-2 rounded-md bg-muted/40 hover:bg-muted text-xs text-left transition-colors"
                >
                  <div className="h-2 w-2 rounded-full mt-1 shrink-0" style={{ backgroundColor: e.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{e.title}</div>
                    <div className="text-muted-foreground">
                      {new Date(e.start_date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                      {e.end_date && ` → ${new Date(e.end_date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo evento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Título</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                        {c.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Data início</Label>
                <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </div>
              <div>
                <Label>Data fim (opcional)</Label>
                <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!form.title.trim() || createEvt.isPending}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
