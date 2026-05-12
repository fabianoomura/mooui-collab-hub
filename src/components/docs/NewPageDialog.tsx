import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDepartments } from '@/hooks/useOrgSettings';
import { IconPicker } from './IconPicker';

export function NewPageDialog({
  open, onOpenChange, orgId, onCreate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  orgId: string;
  onCreate: (input: { title: string; icon: string; department_id: string | null }) => void;
}) {
  const { data: departments = [] } = useDepartments(orgId);
  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState('📄');
  const [deptId, setDeptId] = useState<string>('__none__');

  const submit = () => {
    onCreate({
      title: title.trim() || 'Sem título',
      icon,
      department_id: deptId === '__none__' ? null : deptId,
    });
    setTitle(''); setIcon('📄'); setDeptId('__none__');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova página</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="flex items-end gap-3">
            <div>
              <Label className="mb-2 block">Ícone</Label>
              <IconPicker value={icon} onChange={setIcon} />
            </div>
            <div className="flex-1">
              <Label htmlFor="np-title">Título</Label>
              <Input id="np-title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()} placeholder="Ex.: Manual de processos" />
            </div>
          </div>
          <div>
            <Label>Setor</Label>
            <Select value={deptId} onValueChange={setDeptId}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sem setor</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Crie novos setores em Configurações → Setores & Cargos.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit}>Criar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
