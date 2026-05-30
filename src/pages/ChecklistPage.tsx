import { useEffect, useMemo, useState } from 'react';
import {
  useChecklists, useChecklistItems, useTemplates,
  useCreateChecklistFromTemplate, useUpdateChecklistItem, useSaveAsTemplate,
} from '@/hooks/useChecklists';
import { useLaunches } from '@/hooks/useLaunches';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Plus, CheckCircle2, Circle, MinusCircle, AlertOctagon, FileText, Save,
  ListChecks, Filter,
} from 'lucide-react';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';
import { PageHeader } from '@/components/PageHeader';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ModuleInstanceBar, useActiveInstance } from '@/components/ModuleInstanceBar';
import { AssigneePicker } from '@/components/AssigneePicker';
import { usePermissions } from '@/hooks/usePermissions';

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

type FilterKey = 'all' | 'pending' | 'overdue' | 'blocked';

export default function ChecklistPage() {
  const { activeId: activeInstance, setActive: setActiveInstance } = useActiveInstance('checagens');
  const { data: checklists = [], isLoading: clLoading } = useChecklists(activeInstance);
  const { data: launches = [] } = useLaunches();
  const { data: templates = [] } = useTemplates();
  const [activeId, setActiveId] = useState<string>();
  const [showNew, setShowNew] = useState(false);
  const [showSaveTpl, setShowSaveTpl] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('all');
  const { canDo } = usePermissions();

  useEffect(() => {
    if (!activeId && checklists.length) setActiveId(checklists[0].id);
  }, [checklists, activeId]);

  const { data: items = [], isLoading: itemsLoading } = useChecklistItems(activeId);
  const updateItem = useUpdateChecklistItem();
  const createCl = useCreateChecklistFromTemplate();
  const saveTpl = useSaveAsTemplate();

  const today = new Date().toISOString().split('T')[0];

  const filteredItems = useMemo(() => {
    if (filter === 'all') return items;
    if (filter === 'pending') return items.filter((i) => i.status === 'pending');
    if (filter === 'blocked') return items.filter((i) => i.status === 'blocked');
    if (filter === 'overdue') return items.filter((i) => i.due_date && i.due_date < today && i.status !== 'done' && i.status !== 'na');
    return items;
  }, [items, filter, today]);

  const grouped = useMemo(() => {
    const g: Record<string, typeof items> = {};
    filteredItems.forEach((i) => { (g[i.category] ||= []).push(i); });
    return g;
  }, [filteredItems]);

  const progress = useMemo(() => {
    if (!items.length) return 0;
    const done = items.filter((i) => i.status === 'done' || i.status === 'na').length;
    return Math.round((done / items.length) * 100);
  }, [items]);

  const counts = useMemo(() => ({
    all: items.length,
    pending: items.filter((i) => i.status === 'pending').length,
    overdue: items.filter((i) => i.due_date && i.due_date < today && i.status !== 'done' && i.status !== 'na').length,
    blocked: items.filter((i) => i.status === 'blocked').length,
  }), [items, today]);

  const active = checklists.find((c) => c.id === activeId);
  const launch = launches.find((l) => l.id === active?.launch_id);

  const ChecklistsSidebar = (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold">Checagens</h2>
        <Button size="sm" onClick={() => { setShowNew(true); setDrawerOpen(false); }}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {clLoading ? (
        <>
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </>
      ) : (
        <>
          {checklists.map((c) => {
            const l = launches.find((x) => x.id === c.launch_id);
            return (
              <Card
                key={c.id}
                className={cn(
                  'p-3 cursor-pointer transition-all hover:border-primary/50',
                  activeId === c.id && 'border-primary bg-primary/5',
                )}
                onClick={() => { setActiveId(c.id); setDrawerOpen(false); }}
              >
                <div className="font-medium text-sm">{c.name}</div>
                {l && <div className="text-xs text-muted-foreground mt-1 truncate">📦 {l.name}</div>}
                {c.expected_arrival_date && (
                  <div className="text-xs text-muted-foreground">
                    Chegada: {new Date(c.expected_arrival_date).toLocaleDateString('pt-BR')}
                  </div>
                )}
              </Card>
            );
          })}
          {!checklists.length && <p className="text-sm text-muted-foreground">Nenhuma checagem ainda.</p>}
        </>
      )}

      <div className="pt-4">
        <h3 className="text-xs uppercase text-muted-foreground mb-2">Templates ({templates.length})</h3>
        {templates.map((t) => (
          <div key={t.id} className="text-sm flex items-center gap-2 py-1">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" /> {t.name}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        crumbs={[{ label: 'Início', to: '/' }, { label: 'Check Lançamentos' }]}
        title="Check Lançamentos"
        subtitle="Itens para validar no Shopify antes de publicar um lançamento"
        actions={
          <>
            <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="lg:hidden">
                  <ListChecks className="h-4 w-4 mr-2" /> Trocar checagem
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[300px] overflow-y-auto">
                <SheetHeader><SheetTitle>Checagens</SheetTitle></SheetHeader>
                <div className="mt-4">{ChecklistsSidebar}</div>
              </SheetContent>
            </Sheet>
            <Button size="sm" onClick={() => setShowNew(true)}>
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Nova checagem</span>
            </Button>
          </>
        }
      />

      <ModuleInstanceBar
        moduleKey="checagens"
        value={activeInstance}
        onChange={setActiveInstance}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Sidebar (desktop only) */}
        <aside className="hidden lg:block lg:col-span-3">{ChecklistsSidebar}</aside>

        {/* Main */}
        <div className="lg:col-span-9 space-y-4 min-w-0">
          {!active ? (
            checklists.length === 0 && !clLoading ? (
              <Card className="p-10 text-center">
                <ListChecks className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />
                <p className="text-sm text-muted-foreground mb-4">Nenhuma checagem criada ainda</p>
                <Button onClick={() => setShowNew(true)}>
                  <Plus className="h-4 w-4 mr-2" /> Criar primeira checagem
                </Button>
              </Card>
            ) : (
              <p className="text-sm text-muted-foreground">Selecione uma checagem.</p>
            )
          ) : (
            <>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg sm:text-xl font-semibold break-words">{active.name}</h2>
                  {launch && <p className="text-sm text-muted-foreground">Lançamento: <strong>{launch.name}</strong></p>}
                  {active.expected_arrival_date && (
                    <p className="text-sm text-muted-foreground">
                      Chegada prevista: {new Date(active.expected_arrival_date).toLocaleDateString('pt-BR')}
                    </p>
                  )}
                </div>
                {canDo('manage_templates') && (
                  <Button variant="outline" size="sm" onClick={() => setShowSaveTpl(true)}>
                    <Save className="h-4 w-4 mr-2" /> Salvar como template
                  </Button>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Progresso</span>
                  <span className="font-medium">{progress}%</span>
                </div>
                <Progress value={progress} />
              </div>

              {/* Filter chips */}
              <div className="flex items-center gap-2 flex-wrap">
                <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                {([
                  ['all', `Todos · ${counts.all}`],
                  ['pending', `Pendentes · ${counts.pending}`],
                  ['overdue', `Atrasadas · ${counts.overdue}`],
                  ['blocked', `Bloqueadas · ${counts.blocked}`],
                ] as Array<[FilterKey, string]>).map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setFilter(k)}
                    className={cn(
                      'text-xs px-2.5 py-1 rounded-full border transition-colors',
                      filter === k
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border hover:bg-muted/50 text-muted-foreground'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {itemsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
                </div>
              ) : Object.keys(grouped).length === 0 ? (
                <Card className="p-10 text-center text-sm text-muted-foreground">
                  Nenhum item com este filtro.
                </Card>
              ) : (
                <div className="space-y-3">
                  {Object.entries(grouped).map(([cat, list]) => (
                    <Card key={cat} className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className={`h-2 w-2 rounded-full ${CATS[cat]?.color ?? 'bg-slate-500'}`} />
                        <h3 className="font-semibold">{CATS[cat]?.label ?? cat}</h3>
                        <Badge variant="outline">{list.length}</Badge>
                      </div>
                      <div className="space-y-1">
                        {list.map((it) => {
                          const overdue = it.due_date && it.due_date < today && it.status !== 'done' && it.status !== 'na';
                          const dueToday = it.due_date === today && it.status !== 'done' && it.status !== 'na';
                          return (
                            <div
                              key={it.id}
                              className={cn(
                                'flex items-center gap-3 py-1.5 px-2 rounded transition-colors group',
                                'hover:bg-muted/40',
                                overdue && 'bg-destructive/5',
                                dueToday && 'bg-amber-500/10',
                              )}
                            >
                              <button
                                onClick={() => updateItem.mutate({
                                  id: it.id, status: NEXT_STATUS[it.status],
                                  completed_at: NEXT_STATUS[it.status] === 'done' ? new Date().toISOString() : null,
                                })}
                                aria-label="Alternar status"
                              >
                                {STATUS_ICON[it.status as keyof typeof STATUS_ICON] ?? STATUS_ICON.pending}
                              </button>
                              <span className={cn(
                                'flex-1 text-sm min-w-0 break-words',
                                it.status === 'done' && 'line-through text-muted-foreground',
                              )}>
                                {it.label}
                              </span>
                              <AssigneePicker
                                value={it.assignee_id}
                                onChange={(uid) => updateItem.mutate({ id: it.id, assignee_id: uid })}
                              />
                              {it.due_date && (
                                <span className={cn(
                                  'text-xs',
                                  overdue ? 'text-destructive font-medium' : dueToday ? 'text-amber-600 font-medium' : 'text-muted-foreground',
                                )}>
                                  {new Date(it.due_date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
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
      <div><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} autoFocus /></div>
      <div>
        <Label>Lançamento (opcional)</Label>
        <Select value={launchId || 'none'} onValueChange={(v) => setLaunchId(v === 'none' ? '' : v)}>
          <SelectTrigger><SelectValue placeholder="Sem lançamento" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">— Sem lançamento —</SelectItem>
            {launches.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Template (opcional)</Label>
        <Select value={tplId || 'none'} onValueChange={(v) => setTplId(v === 'none' ? '' : v)}>
          <SelectTrigger><SelectValue placeholder="Sem template (em branco)" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">— Sem template —</SelectItem>
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
      <div><Label>Nome do template</Label><Input value={n} onChange={(e) => setN(e.target.value)} autoFocus /></div>
      <DialogFooter>
        <Button onClick={() => onSubmit(n)} disabled={!n}>Salvar</Button>
      </DialogFooter>
    </div>
  );
}
