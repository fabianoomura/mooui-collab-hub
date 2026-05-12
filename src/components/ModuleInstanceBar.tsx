import { useEffect, useMemo, useState } from 'react';
import { Plus, FolderOpen, MoreHorizontal, Archive, Pencil } from 'lucide-react';
import {
  type ModuleKey,
  useModuleInstances,
  useCreateModuleInstance,
  useArchiveModuleInstance,
  useRenameModuleInstance,
} from '@/hooks/useModuleInstances';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useConfirm } from '@/components/ConfirmDialog';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  moduleKey: ModuleKey;
  value?: string;
  onChange: (instanceId: string) => void;
}

const PALETTE = ['#D6336C', '#2563EB', '#16A34A', '#F59E0B', '#7C3AED', '#0891B2', '#DB2777', '#65A30D'];

const STORAGE_KEY = (orgId: string, moduleKey: ModuleKey) => `mooui_instance_${orgId}_${moduleKey}`;

export function useActiveInstance(moduleKey: ModuleKey) {
  const { currentOrg } = useOrganization();
  const { data: instances = [], isLoading } = useModuleInstances(moduleKey);
  const [activeId, setActiveIdState] = useState<string | undefined>();

  useEffect(() => {
    if (!currentOrg) return;
    const saved = localStorage.getItem(STORAGE_KEY(currentOrg.id, moduleKey));
    const validSaved = instances.find(i => i.id === saved);
    if (validSaved) {
      setActiveIdState(validSaved.id);
    } else if (instances.length > 0) {
      setActiveIdState(instances[0].id);
    } else {
      setActiveIdState(undefined);
    }
  }, [currentOrg?.id, moduleKey, instances]);

  const setActive = (id: string) => {
    if (!currentOrg) return;
    localStorage.setItem(STORAGE_KEY(currentOrg.id, moduleKey), id);
    setActiveIdState(id);
  };

  const active = useMemo(() => instances.find(i => i.id === activeId), [instances, activeId]);

  return { instances, activeId, active, setActive, isLoading };
}

export function ModuleInstanceBar({ moduleKey, value, onChange }: Props) {
  const { instances, isLoading } = useModuleInstances(moduleKey);
  const create = useCreateModuleInstance();
  const archive = useArchiveModuleInstance();
  const rename = useRenameModuleInstance();
  const confirm = useConfirm();

  const [showNew, setShowNew] = useState(false);
  const [showRename, setShowRename] = useState<{ id: string; name: string } | null>(null);
  const [form, setForm] = useState({ name: '', color: PALETTE[0] });

  const handleCreate = () => {
    if (!form.name.trim()) return;
    create.mutate(
      { module_key: moduleKey, name: form.name.trim(), color: form.color },
      {
        onSuccess: (inst) => {
          toast.success('Espaço criado');
          setShowNew(false);
          setForm({ name: '', color: PALETTE[0] });
          onChange(inst.id);
        },
        onError: (e: Error) => toast.error(e.message),
      }
    );
  };

  const handleArchive = async (id: string, name: string) => {
    const ok = await confirm({
      title: `Arquivar "${name}"?`,
      description: 'Os dados não serão excluídos, apenas o espaço some da lista.',
      confirmText: 'Arquivar',
      destructive: true,
    });
    if (ok) archive.mutate(id, { onSuccess: () => toast.success('Espaço arquivado') });
  };

  const handleRename = () => {
    if (!showRename || !showRename.name.trim()) return;
    rename.mutate(
      { id: showRename.id, name: showRename.name.trim() },
      {
        onSuccess: () => {
          toast.success('Renomeado');
          setShowRename(null);
        },
      }
    );
  };

  if (isLoading) {
    return <Skeleton className="h-9 w-full mb-3" />;
  }

  return (
    <>
      <div className="flex items-center gap-1 overflow-x-auto pb-1 mb-3 border-b border-border">
        {instances.length === 0 && (
          <p className="text-xs text-muted-foreground px-2 py-1">
            Nenhum espaço ainda. Crie o primeiro
          </p>
        )}
        {instances.map((inst) => {
          const active = value === inst.id;
          return (
            <div key={inst.id} className="flex items-center group">
              <button
                onClick={() => onChange(inst.id)}
                className={cn(
                  'flex items-center gap-2 px-3 h-8 rounded-md text-sm transition-colors whitespace-nowrap',
                  active
                    ? 'bg-muted text-foreground font-medium'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                )}
              >
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: inst.color }}
                />
                <FolderOpen className="h-3.5 w-3.5 opacity-60" />
                {inst.name}
              </button>
              {active && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      aria-label="Opções"
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setShowRename({ id: inst.id, name: inst.name })}>
                      <Pencil className="h-3.5 w-3.5 mr-2" /> Renomear
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => handleArchive(inst.id, inst.name)}
                    >
                      <Archive className="h-3.5 w-3.5 mr-2" /> Arquivar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          );
        })}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-muted-foreground"
          onClick={() => setShowNew(true)}
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> Novo espaço
        </Button>
      </div>

      {/* Dialog: novo espaço */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo espaço</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nome</Label>
              <Input
                autoFocus
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Atacado, Coleção Verão…"
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
            </div>
            <div>
              <Label>Cor</Label>
              <div className="flex gap-2 flex-wrap mt-1">
                {PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm({ ...form, color: c })}
                    className={cn(
                      'h-7 w-7 rounded-full ring-offset-2 transition',
                      form.color === c && 'ring-2 ring-foreground',
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!form.name.trim() || create.isPending}>
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: renomear */}
      <Dialog open={!!showRename} onOpenChange={(o) => !o && setShowRename(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear espaço</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={showRename?.name ?? ''}
            onChange={(e) => setShowRename(showRename ? { ...showRename, name: e.target.value } : null)}
            onKeyDown={(e) => e.key === 'Enter' && handleRename()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRename(null)}>Cancelar</Button>
            <Button onClick={handleRename} disabled={!showRename?.name.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
