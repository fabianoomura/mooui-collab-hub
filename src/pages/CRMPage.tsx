import { useEffect, useMemo, useState } from 'react';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import {
  usePipelines, useStages, useContacts, useDeals, useCreateDeal, useUpdateDeal,
  useCreateContact, useDeleteDeal, type Deal,
} from '@/hooks/useCRM';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  ExternalLink, Plus, Building2, UserPlus, Search, Trash2, Flame, Snowflake, Briefcase,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { useConfirm } from '@/components/ConfirmDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ModuleInstanceBar, useActiveInstance } from '@/components/ModuleInstanceBar';
import { AssigneePicker, useOrgMembers } from '@/components/AssigneePicker';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const fmtBRL = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const HOT_THRESHOLD_CENTS = 500_000; // R$ 5k+
const COLD_DAYS = 14;

export default function CRMPage() {
  const { activeId: activeInstance, setActive: setActiveInstance } = useActiveInstance('crm');
  const { data: pipelines = [], isLoading: pipesLoading } = usePipelines(activeInstance);
  const [activePipeline, setActivePipeline] = useState<string>();

  useEffect(() => {
    setActivePipeline(pipelines[0]?.id);
  }, [pipelines]);

  const { data: stages = [] } = useStages(activePipeline);
  const { data: deals = [], isLoading: dealsLoading } = useDeals(activePipeline);
  const { data: contacts = [] } = useContacts();
  const createDeal = useCreateDeal();
  const updateDeal = useUpdateDeal();
  const createContact = useCreateContact();
  const deleteDeal = useDeleteDeal();
  const confirm = useConfirm();

  const [showNewDeal, setShowNewDeal] = useState(false);
  const [showNewContact, setShowNewContact] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [search, setSearch] = useState('');

  const filteredDeals = useMemo(() => {
    if (!search.trim()) return deals;
    const q = search.toLowerCase();
    return deals.filter((d) => {
      const c = contacts.find((x) => x.id === d.contact_id);
      return d.title.toLowerCase().includes(q)
        || c?.name.toLowerCase().includes(q)
        || c?.company?.toLowerCase().includes(q)
        || d.shopify_draft_order_name?.toLowerCase().includes(q)
        || d.shopify_order_number?.toLowerCase().includes(q);
    });
  }, [deals, search, contacts]);

  const dealsByStage = useMemo(() => {
    const map: Record<string, Deal[]> = {};
    stages.forEach((s) => (map[s.id] = []));
    filteredDeals.forEach((d) => { (map[d.stage_id] ||= []).push(d); });
    return map;
  }, [stages, filteredDeals]);

  const totalsByStage = useMemo(() => {
    const t: Record<string, number> = {};
    Object.entries(dealsByStage).forEach(([sid, ds]) => { t[sid] = ds.reduce((s, d) => s + d.value_cents, 0); });
    return t;
  }, [dealsByStage]);

  const activePipelineKind = pipelines.find((p) => p.id === activePipeline)?.kind ?? 'atacado';
  const totalValue = filteredDeals.reduce((s, d) => s + d.value_cents, 0);

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const dealId = result.draggableId;
    const newStageId = result.destination.droppableId;
    const deal = deals.find((d) => d.id === dealId);
    if (!deal || deal.stage_id === newStageId) return;
    const stageName = stages.find((s) => s.id === newStageId)?.name ?? '';
    updateDeal.mutate({ id: dealId, stage_id: newStageId }, {
      onSuccess: () => toast.success(`Movido para ${stageName}`),
      onError: (e: any) => toast.error(e.message),
    });
  };

  const askDelete = async (deal: Deal) => {
    const ok = await confirm({
      title: `Excluir "${deal.title}"?`,
      description: 'Esta ação não pode ser desfeita.',
      confirmText: 'Excluir', destructive: true,
    });
    if (ok) {
      deleteDeal.mutate(deal.id, {
        onSuccess: () => { toast.success('Negócio excluído'); setEditingDeal(null); },
      });
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        crumbs={[{ label: 'Início', to: '/' }, { label: 'CRM' }]}
        title="CRM"
        subtitle={`Funil de vendas — ${filteredDeals.length} negócio${filteredDeals.length === 1 ? '' : 's'} · ${fmtBRL(totalValue)}`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setShowNewContact(true)}>
              <UserPlus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Novo contato</span>
            </Button>
            <Button size="sm" onClick={() => setShowNewDeal(true)} disabled={!activePipeline || !stages.length}>
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Novo negócio</span>
            </Button>
          </>
        }
      />

      <ModuleInstanceBar
        moduleKey="crm"
        value={activeInstance}
        onChange={setActiveInstance}
      />

      {pipesLoading ? (
        <div className="flex gap-2"><Skeleton className="h-9 w-32" /><Skeleton className="h-9 w-32" /></div>
      ) : (
        <Tabs value={activePipeline} onValueChange={setActivePipeline}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <TabsList className="w-full sm:w-auto">
              {pipelines.map((p) => (
                <TabsTrigger key={p.id} value={p.id} className="flex-1 sm:flex-initial">
                  {p.name}
                  <Badge variant="secondary" className="ml-2 capitalize hidden sm:inline-flex">{p.kind}</Badge>
                </TabsTrigger>
              ))}
            </TabsList>
            <div className="relative w-full sm:w-72">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar negócio, contato, pedido…"
                className="pl-8 h-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {pipelines.map((p) => (
            <TabsContent key={p.id} value={p.id} className="mt-4">
              {dealsLoading ? (
                <div className="flex gap-3 overflow-x-auto pb-4">
                  {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-64 w-[280px] flex-shrink-0" />)}
                </div>
              ) : (
                <DragDropContext onDragEnd={onDragEnd}>
                  <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 -mx-3 px-3 sm:mx-0 sm:px-0">
                    {stages.map((stage) => {
                      const list = dealsByStage[stage.id] ?? [];
                      const total = totalsByStage[stage.id] ?? 0;
                      return (
                        <div key={stage.id} className="w-[280px] flex-shrink-0">
                          <div className="flex items-center justify-between mb-2 px-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="h-2 w-2 rounded-full shrink-0" style={{ background: stage.color }} />
                              <span className="text-sm font-medium truncate">{stage.name}</span>
                              <Badge variant="outline" className="text-[10px] shrink-0">{list.length}</Badge>
                            </div>
                            <span className="text-xs text-muted-foreground shrink-0">{fmtBRL(total)}</span>
                          </div>
                          <Droppable droppableId={stage.id}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                className={`space-y-2 min-h-[120px] rounded-md p-1 transition-colors ${
                                  snapshot.isDraggingOver ? 'bg-primary/5 ring-1 ring-primary/30' : ''
                                }`}
                              >
                                {list.map((d, idx) => (
                                  <DealCard key={d.id} deal={d} index={idx} contacts={contacts} onClick={() => setEditingDeal(d)} />
                                ))}
                                {provided.placeholder}
                                {list.length === 0 && !snapshot.isDraggingOver && (
                                  <div className="text-center text-xs text-muted-foreground py-6 italic border border-dashed border-border/50 rounded-md">
                                    Arraste um negócio aqui
                                  </div>
                                )}
                              </div>
                            )}
                          </Droppable>
                        </div>
                      );
                    })}
                  </div>
                </DragDropContext>
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}

      {/* Deal sheet (edit) */}
      <Sheet open={!!editingDeal} onOpenChange={(o) => !o && setEditingDeal(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {editingDeal && (
            <DealEditor
              deal={editingDeal}
              stages={stages}
              contacts={contacts}
              onClose={() => setEditingDeal(null)}
              onSave={(payload) => updateDeal.mutate({ id: editingDeal.id, ...payload }, {
                onSuccess: () => { setEditingDeal(null); toast.success('Negócio atualizado'); },
              })}
              onDelete={() => askDelete(editingDeal)}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* New deal dialog */}
      <Dialog open={showNewDeal} onOpenChange={setShowNewDeal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo negócio</DialogTitle></DialogHeader>
          <DealForm
            stages={stages}
            contacts={contacts.filter((c) => c.kind === activePipelineKind)}
            onSubmit={(payload) => {
              createDeal.mutate(
                { ...payload, pipeline_id: activePipeline! },
                { onSuccess: () => { setShowNewDeal(false); toast.success('Negócio criado'); } }
              );
            }}
          />
        </DialogContent>
      </Dialog>

      {/* New contact dialog */}
      <Dialog open={showNewContact} onOpenChange={setShowNewContact}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo contato</DialogTitle></DialogHeader>
          <ContactForm
            defaultKind={activePipelineKind}
            onSubmit={(c) => {
              createContact.mutate(c, {
                onSuccess: () => { setShowNewContact(false); toast.success('Contato criado'); },
              });
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DealCard({
  deal, index, contacts, onClick,
}: { deal: Deal; index: number; contacts: any[]; onClick: () => void }) {
  const c = contacts.find((x) => x.id === deal.contact_id);
  const isHot = deal.value_cents >= HOT_THRESHOLD_CENTS;
  // "Frio" = sem update há > COLD_DAYS — usamos created_at como aproximação
  const updatedAt = (deal as any).updated_at ?? (deal as any).created_at;
  const daysStale = updatedAt
    ? Math.floor((Date.now() - new Date(updatedAt).getTime()) / 86_400_000) : 0;
  const isCold = !isHot && daysStale > COLD_DAYS;

  return (
    <Draggable draggableId={deal.id} index={index}>
      {(provided, snapshot) => (
        <Card
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={onClick}
          className={`p-3 cursor-pointer hover:shadow-md transition-shadow ${
            snapshot.isDragging ? 'shadow-lg ring-2 ring-primary/40 rotate-1' : ''
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="font-medium text-sm flex-1 min-w-0 truncate">{deal.title}</div>
            {isHot && <Flame className="h-3.5 w-3.5 text-orange-500 shrink-0" aria-label="Negócio quente" />}
            {isCold && <Snowflake className="h-3.5 w-3.5 text-sky-500 shrink-0" aria-label="Sem movimento" />}
          </div>
          {c && (
            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1 truncate">
              <Building2 className="h-3 w-3 shrink-0" />
              <span className="truncate">{c.company || c.name}</span>
            </div>
          )}
          <div className="flex items-center justify-between mt-2 gap-2">
            <span className="text-sm font-semibold text-primary">{fmtBRL(deal.value_cents)}</span>
            <div className="flex items-center gap-1">
              {deal.shopify_order_number && (
                <Badge variant="default" className="text-[10px]">{deal.shopify_order_number}</Badge>
              )}
              {!deal.shopify_order_number && deal.shopify_draft_order_name && (
                <Badge variant="outline" className="text-[10px]">{deal.shopify_draft_order_name}</Badge>
              )}
            </div>
          </div>
          {deal.shopify_draft_order_url && (
            <a
              href={deal.shopify_draft_order_url} target="_blank" rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-[11px] text-primary mt-1 flex items-center gap-1 hover:underline"
            >
              Rascunho Shopify <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {isCold && (
            <div className="text-[10px] text-muted-foreground mt-1">{daysStale}d sem movimento</div>
          )}
        </Card>
      )}
    </Draggable>
  );
}

function DealEditor({
  deal, stages, contacts, onClose, onSave, onDelete,
}: {
  deal: Deal;
  stages: Array<{ id: string; name: string }>;
  contacts: any[];
  onClose: () => void;
  onSave: (p: any) => void;
  onDelete: () => void;
}) {
  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-primary" />
          Editar negócio
        </SheetTitle>
        <SheetDescription>Atualize informações ou mova entre estágios.</SheetDescription>
      </SheetHeader>
      <div className="mt-4">
        <DealForm
          stages={stages}
          contacts={contacts}
          initial={deal}
          onSubmit={onSave}
          onCancel={onClose}
          onDelete={onDelete}
        />
      </div>
    </>
  );
}

function DealForm({
  stages, contacts, initial, onSubmit, onCancel, onDelete,
}: {
  stages: Array<{ id: string; name: string }>;
  contacts: Array<{ id: string; name: string; company: string | null }>;
  initial?: Deal;
  onSubmit: (p: any) => void;
  onCancel?: () => void;
  onDelete?: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [stageId, setStageId] = useState(initial?.stage_id ?? stages[0]?.id ?? '');
  const [contactId, setContactId] = useState<string>(initial?.contact_id ?? '');
  const [value, setValue] = useState(initial ? String(initial.value_cents / 100) : '');
  const [draftName, setDraftName] = useState(initial?.shopify_draft_order_name ?? '');
  const [draftUrl, setDraftUrl] = useState(initial?.shopify_draft_order_url ?? '');
  const [orderNumber, setOrderNumber] = useState(initial?.shopify_order_number ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');

  return (
    <div className="space-y-3">
      <div><Label>Título</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus /></div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Estágio</Label>
          <Select value={stageId} onValueChange={setStageId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Valor (R$)</Label>
          <Input type="number" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
      </div>
      <div>
        <Label>Contato</Label>
        <Select value={contactId || 'none'} onValueChange={(v) => setContactId(v === 'none' ? '' : v)}>
          <SelectTrigger><SelectValue placeholder="Sem contato" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">— Sem contato —</SelectItem>
            {contacts.map((c) => <SelectItem key={c.id} value={c.id}>{c.company || c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Rascunho Shopify (#)</Label>
          <Input value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="#D1042" />
        </div>
        <div>
          <Label>Pedido Shopify (#)</Label>
          <Input value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} placeholder="#10287" />
        </div>
      </div>
      <div>
        <Label>Link do rascunho</Label>
        <Input value={draftUrl} onChange={(e) => setDraftUrl(e.target.value)} placeholder="https://admin.shopify.com/..." />
      </div>
      <div><Label>Notas</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} /></div>
      <DialogFooter className="gap-2 sm:justify-between flex-row pt-2">
        {onDelete ? (
          <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={onDelete}>
            <Trash2 className="h-4 w-4 mr-1" /> Excluir
          </Button>
        ) : <span />}
        <div className="flex gap-2">
          {onCancel && <Button variant="outline" onClick={onCancel}>Cancelar</Button>}
          <Button onClick={() => onSubmit({
            title, stage_id: stageId, contact_id: contactId || null,
            value_cents: Math.round((parseFloat(value) || 0) * 100),
            shopify_draft_order_name: draftName || null,
            shopify_draft_order_url: draftUrl || null,
            shopify_order_number: orderNumber || null,
            notes: notes || null,
          })} disabled={!title || !stageId}>
            Salvar
          </Button>
        </div>
      </DialogFooter>
    </div>
  );
}

function ContactForm({ defaultKind, onSubmit }: { defaultKind: string; onSubmit: (c: any) => void }) {
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [doc, setDoc] = useState('');
  const [kind, setKind] = useState(defaultKind);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Tipo</Label>
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="atacado">Atacado</SelectItem>
              <SelectItem value="arquiteto">Arquiteto</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} autoFocus /></div>
      </div>
      <div><Label>Empresa</Label><Input value={company} onChange={(e) => setCompany(e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Email</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div><Label>Telefone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
      </div>
      <div><Label>CNPJ/CPF</Label><Input value={doc} onChange={(e) => setDoc(e.target.value)} /></div>
      <DialogFooter>
        <Button onClick={() => onSubmit({ name, company, email, phone, document: doc, kind })} disabled={!name}>
          Criar
        </Button>
      </DialogFooter>
    </div>
  );
}
