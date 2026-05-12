import { useEffect, useMemo, useState } from 'react';
import { useChecklists, useChecklistItems, useTemplates, useCreateChecklistFromTemplate, useUpdateChecklistItem, useSaveAsTemplate } from '@/hooks/useChecklists';
import { useLaunches } from '@/hooks/useLaunches';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, CheckCircle2, Circle, MinusCircle, AlertOctagon, FileText, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';

const CATS: Record<string, { label: string; color: string }> = {
  geral: { label: 'Geral', color: 'bg-slate-500' },
  chegada: { label: 'Chegada', color: 'bg-blue-500' },
  fotos: { label: 'Fotos', color: 'bg-purple-500' },
  descricao: { label: 'Descrição', color: 'bg-amber-500' },
  erp: { label: 'ERP', color: 'bg-orange-500' },
  site: { label: 'Site', color: 'bg-pink-500' },
  colecao: { label: 'Coleção', color: 'bg-green-500' },
};

const STATUS_ICON = {
  pending: <Circle className="h-4 w-4 text-muted-foreground" />,
  done: <CheckCircle2 className="h-4 w-4 text-green-600" />,
  na: <MinusCircle className="h-4 w-4 text-muted-foreground" />,
  blocked: <AlertOctagon className="h-4 w-4 text-red-600" />,
};
const NEXT_STATUS: Record<string, string> = { pending: 'done', done: 'na', na: 'blocked', blocked: 'pending' };

export default function ChecklistPage() {
  const { data: checklists = [] } = useChecklists();
  const { data: launches = [] } = useLaunches();
  const { data: templates = [] } = useTemplates();
  const [activeId, setActiveId] = useState<string>();
  const [showNew, setShowNew] = useState(false);
  const [showSaveTpl, setShowSaveTpl] = useState(false);

  useEffect(() => {
    if (!activeId && checklists.length) setActiveId(checklists[0].id);
  }, [checklists, activeId]);

  const { data: items = [] } = useChecklistItems(activeId);
  const updateItem = useUpdateChecklistItem();
  const createCl = useCreateChecklistFromTemplate();
  const saveTpl = useSaveAsTemplate();

  const grouped = useMemo(() => {
    const g: Record<string, typeof items> = {};
    items.forEach((i) => { (g[i.category] ||= []).push(i); });
    return g;
  }, [items]);

  const progress = useMemo(() => {
    if (!items.length) return 0;
    const done = items.filter((i) => i.status === 'done' || i.status === 'na').length;
    return Math.round((done / items.length) * 100);
  }, [items]);

  const active = checklists.find((c) => c.id === activeId);
  const launch = launches.find((l) => l.id === active?.launch_id);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* Sidebar */}
      <div className="lg:col-span-3 space-y-2">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">Checagens</h2>
          <Button size="sm" onClick={() => setShowNew(true)}><Plus className="h-4 w-4" /></Button>
        </div>
        <div className="flex lg:block gap-2 overflow-x-auto lg:overflow-visible -mx-3 px-3 lg:mx-0 lg:px-0 pb-2 lg:pb-0">
        {checklists.map((c) => {
          const l = launches.find((x) => x.id === c.launch_id);
          return (
            <Card
              key={c.id}
              className={`p-3 cursor-pointer shrink-0 w-[220px] lg:w-auto ${activeId === c.id ? 'border-primary' : ''}`}
              onClick={() => setActiveId(c.id)}
            >
              <div className="font-medium text-sm">{c.name}</div>
              {l && <div className="text-xs text-muted-foreground mt-1">📦 {l.name}</div>}
              {c.expected_arrival_date && (
                <div className="text-xs text-muted-foreground">Chegada: {new Date(c.expected_arrival_date).toLocaleDateString('pt-BR')}</div>
              )}
            </Card>
          );
        })}
        {!checklists.length && <p className="text-sm text-muted-foreground">Nenhuma checagem ainda.</p>}
        </div>

        <div className="pt-2 lg:pt-4 hidden lg:block">
          <h3 className="text-xs uppercase text-muted-foreground mb-2">Templates ({templates.length})</h3>
          {templates.map((t) => (
            <div key={t.id} className="text-sm flex items-center gap-2 py-1">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" /> {t.name}
            </div>
          ))}
        </div>
      </div>

      {/* Main */}
      <div className="lg:col-span-9 space-y-4 min-w-0">
        {active ? (
          <>
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-semibold">{active.name}</h1>
                {launch && <p className="text-sm text-muted-foreground">Lançamento: <strong>{launch.name}</strong></p>}
                {active.expected_arrival_date && (
                  <p className="text-sm text-muted-foreground">
                    Chegada prevista: {new Date(active.expected_arrival_date).toLocaleDateString('pt-BR')}
                  </p>
                )}
              </div>
              <Button variant="outline" onClick={() => setShowSaveTpl(true)}>
                <Save className="h-4 w-4 mr-2" /> Salvar como template
              </Button>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Progresso</span>
                <span className="font-medium">{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>

            <div className="space-y-4">
              {Object.entries(grouped).map(([cat, list]) => (
                <Card key={cat} className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`h-2 w-2 rounded-full ${CATS[cat]?.color ?? 'bg-slate-500'}`} />
                    <h3 className="font-semibold">{CATS[cat]?.label ?? cat}</h3>
                    <Badge variant="outline">{list.length}</Badge>
                  </div>
                  <div className="space-y-1">
                    {list.map((it) => (
                      <div key={it.id} className="flex items-center gap-3 py-1.5 hover:bg-muted/40 rounded px-2 group">
                        <button
                          onClick={() => updateItem.mutate({
                            id: it.id, status: NEXT_STATUS[it.status],
                            completed_at: NEXT_STATUS[it.status] === 'done' ? new Date().toISOString() : null,
                          })}
                        >
                          {STATUS_ICON[it.status as keyof typeof STATUS_ICON] ?? STATUS_ICON.pending}
                        </button>
                        <span className={`flex-1 text-sm ${it.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
                          {it.label}
                        </span>
                        {it.due_date && (
                          <span className="text-xs text-muted-foreground">
                            {new Date(it.due_date).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center text-muted-foreground py-20">
            Selecione ou crie uma checagem.
          </div>
        )}
      </div>

      {/* New checklist */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova checagem</DialogTitle></DialogHeader>
          <NewChecklistForm
            launches={launches} templates={templates}
            onSubmit={(p) => createCl.mutate(p, {
              onSuccess: (cl) => { setActiveId(cl.id); setShowNew(false); toast.success('Checagem criada'); },
            })}
          />
        </DialogContent>
      </Dialog>

      {/* Save as template */}
      <Dialog open={showSaveTpl} onOpenChange={setShowSaveTpl}>
        <DialogContent>
          <DialogHeader><DialogTitle>Salvar como template</DialogTitle></DialogHeader>
          <SaveTemplateForm
            onSubmit={(name) => saveTpl.mutate({ checklistId: activeId!, name }, {
              onSuccess: () => { setShowSaveTpl(false); toast.success('Template salvo'); },
            })}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NewChecklistForm({ launches, templates, onSubmit }: any) {
  const [name, setName] = useState('');
  const [launchId, setLaunchId] = useState<string>('');
  const [tplId, setTplId] = useState<string>('');
  const [arr, setArr] = useState('');
  return (
    <div className="space-y-3">
      <div><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div>
        <Label>Lançamento (opcional)</Label>
        <Select value={launchId} onValueChange={setLaunchId}>
          <SelectTrigger><SelectValue placeholder="Sem lançamento" /></SelectTrigger>
          <SelectContent>
            {launches.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Template (opcional)</Label>
        <Select value={tplId} onValueChange={setTplId}>
          <SelectTrigger><SelectValue placeholder="Sem template (em branco)" /></SelectTrigger>
          <SelectContent>
            {templates.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div><Label>Chegada prevista</Label><Input type="date" value={arr} onChange={(e) => setArr(e.target.value)} /></div>
      <DialogFooter>
        <Button onClick={() => onSubmit({
          name, launchId: launchId || undefined, templateId: tplId || undefined,
          expected_arrival_date: arr || undefined,
        })} disabled={!name}>Criar</Button>
      </DialogFooter>
    </div>
  );
}

function SaveTemplateForm({ onSubmit }: { onSubmit: (name: string) => void }) {
  const [n, setN] = useState('');
  return (
    <div className="space-y-3">
      <div><Label>Nome do template</Label><Input value={n} onChange={(e) => setN(e.target.value)} /></div>
      <DialogFooter>
        <Button onClick={() => onSubmit(n)} disabled={!n}>Salvar</Button>
      </DialogFooter>
    </div>
  );
}
