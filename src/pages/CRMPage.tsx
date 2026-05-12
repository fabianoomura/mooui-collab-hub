import { useEffect, useMemo, useState } from 'react';
import { usePipelines, useStages, useContacts, useDeals, useCreateDeal, useUpdateDeal, useCreateContact, type Deal } from '@/hooks/useCRM';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ExternalLink, Plus, Phone, Mail, Building2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

const fmtBRL = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function CRMPage() {
  const { data: pipelines = [] } = usePipelines();
  const [activePipeline, setActivePipeline] = useState<string>();

  useEffect(() => {
    if (!activePipeline && pipelines.length) setActivePipeline(pipelines[0].id);
  }, [pipelines, activePipeline]);

  const { data: stages = [] } = useStages(activePipeline);
  const { data: deals = [] } = useDeals(activePipeline);
  const { data: contacts = [] } = useContacts();
  const createDeal = useCreateDeal();
  const updateDeal = useUpdateDeal();
  const createContact = useCreateContact();

  const [showNewDeal, setShowNewDeal] = useState(false);
  const [showNewContact, setShowNewContact] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);

  const dealsByStage = useMemo(() => {
    const map: Record<string, Deal[]> = {};
    stages.forEach((s) => (map[s.id] = []));
    deals.forEach((d) => { (map[d.stage_id] ||= []).push(d); });
    return map;
  }, [stages, deals]);

  const totalsByStage = useMemo(() => {
    const t: Record<string, number> = {};
    Object.entries(dealsByStage).forEach(([sid, ds]) => { t[sid] = ds.reduce((s, d) => s + d.value_cents, 0); });
    return t;
  }, [dealsByStage]);

  const activePipelineKind = pipelines.find((p) => p.id === activePipeline)?.kind ?? 'atacado';

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">CRM</h1>
          <p className="text-sm text-muted-foreground">Funil de vendas — atacado e arquitetos</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1 sm:flex-initial" onClick={() => setShowNewContact(true)}>
            <UserPlus className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Novo </span>contato
          </Button>
          <Button size="sm" className="flex-1 sm:flex-initial" onClick={() => setShowNewDeal(true)} disabled={!activePipeline || !stages.length}>
            <Plus className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Novo </span>negócio
          </Button>
        </div>
      </div>

      <Tabs value={activePipeline} onValueChange={setActivePipeline}>
        <TabsList className="w-full sm:w-auto overflow-x-auto">
          {pipelines.map((p) => (
            <TabsTrigger key={p.id} value={p.id} className="text-xs sm:text-sm">
              {p.name} <Badge variant="secondary" className="ml-2 capitalize hidden sm:inline-flex">{p.kind}</Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        {pipelines.map((p) => (
          <TabsContent key={p.id} value={p.id} className="mt-4">
            <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 -mx-3 px-3 sm:mx-0 sm:px-0">
              {stages.map((stage) => (
                <div key={stage.id} className="w-[260px] sm:min-w-[280px] sm:w-auto flex-shrink-0">
                  <div className="flex items-center justify-between mb-2 px-1">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: stage.color }} />
                      <span className="text-sm font-medium">{stage.name}</span>
                      <Badge variant="outline" className="text-[10px]">{dealsByStage[stage.id]?.length ?? 0}</Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">{fmtBRL(totalsByStage[stage.id] ?? 0)}</span>
                  </div>
                  <div className="space-y-2 min-h-[100px]">
                    {dealsByStage[stage.id]?.map((d) => {
                      const c = contacts.find((x) => x.id === d.contact_id);
                      return (
                        <Card
                          key={d.id} className="p-3 cursor-pointer hover:shadow-md transition-shadow"
                          onClick={() => setEditingDeal(d)}
                        >
                          <div className="font-medium text-sm">{d.title}</div>
                          {c && (
                            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                              <Building2 className="h-3 w-3" /> {c.company || c.name}
                            </div>
                          )}
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-sm font-semibold text-primary">{fmtBRL(d.value_cents)}</span>
                            {d.shopify_draft_order_name && (
                              <Badge variant="outline" className="text-[10px]">
                                {d.shopify_draft_order_name}
                              </Badge>
                            )}
                          </div>
                          {d.shopify_draft_order_url && (
                            <a
                              href={d.shopify_draft_order_url} target="_blank" rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-[11px] text-primary mt-1 flex items-center gap-1 hover:underline"
                            >
                              Rascunho Shopify <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* New deal dialog */}
      <DealDialog
        open={showNewDeal} onClose={() => setShowNewDeal(false)}
        stages={stages} contacts={contacts.filter((c) => c.kind === activePipelineKind)}
        onSubmit={(payload) => {
          createDeal.mutate(
            { ...payload, pipeline_id: activePipeline! },
            { onSuccess: () => { setShowNewDeal(false); toast.success('Negócio criado'); } }
          );
        }}
      />

      {/* Edit deal dialog */}
      <DealDialog
        open={!!editingDeal} onClose={() => setEditingDeal(null)}
        stages={stages} contacts={contacts}
        initial={editingDeal ?? undefined}
        onSubmit={(payload) => {
          if (!editingDeal) return;
          updateDeal.mutate(
            { id: editingDeal.id, ...payload },
            { onSuccess: () => { setEditingDeal(null); toast.success('Negócio atualizado'); } }
          );
        }}
      />

      {/* New contact dialog */}
      <Dialog open={showNewContact} onOpenChange={setShowNewContact}>
        <DialogContent>
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

function DealDialog({
  open, onClose, stages, contacts, initial, onSubmit,
}: {
  open: boolean; onClose: () => void;
  stages: Array<{ id: string; name: string }>; contacts: Array<{ id: string; name: string; company: string | null }>;
  initial?: Deal;
  onSubmit: (p: any) => void;
}) {
  const [title, setTitle] = useState('');
  const [stageId, setStageId] = useState('');
  const [contactId, setContactId] = useState<string>('');
  const [value, setValue] = useState('');
  const [draftName, setDraftName] = useState('');
  const [draftUrl, setDraftUrl] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) {
      setTitle(initial?.title ?? '');
      setStageId(initial?.stage_id ?? stages[0]?.id ?? '');
      setContactId(initial?.contact_id ?? '');
      setValue(initial ? String(initial.value_cents / 100) : '');
      setDraftName(initial?.shopify_draft_order_name ?? '');
      setDraftUrl(initial?.shopify_draft_order_url ?? '');
      setOrderNumber(initial?.shopify_order_number ?? '');
      setNotes(initial?.notes ?? '');
    }
  }, [open, initial, stages]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{initial ? 'Editar negócio' : 'Novo negócio'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Título</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
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
            <Select value={contactId} onValueChange={setContactId}>
              <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
              <SelectContent>
                {contacts.map((c) => <SelectItem key={c.id} value={c.id}>{c.company || c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Rascunho Shopify (#)</Label><Input value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="#D1042" /></div>
            <div><Label>Pedido Shopify (#)</Label><Input value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} placeholder="#10287" /></div>
          </div>
          <div><Label>Link do rascunho</Label><Input value={draftUrl} onChange={(e) => setDraftUrl(e.target.value)} placeholder="https://admin.shopify.com/..." /></div>
          <div><Label>Notas</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
        <div><Label>Tipo</Label>
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="atacado">Atacado</SelectItem>
              <SelectItem value="arquiteto">Arquiteto</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
      </div>
      <div><Label>Empresa</Label><Input value={company} onChange={(e) => setCompany(e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Email</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div><Label>Telefone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
      </div>
      <div><Label>CNPJ/CPF</Label><Input value={doc} onChange={(e) => setDoc(e.target.value)} /></div>
      <DialogFooter>
        <Button onClick={() => onSubmit({ name, company, email, phone, document: doc, kind })} disabled={!name}>Criar</Button>
      </DialogFooter>
    </div>
  );
}
