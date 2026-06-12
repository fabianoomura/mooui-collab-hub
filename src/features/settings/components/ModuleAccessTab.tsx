import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAllModuleAccess, type ModuleAccessLevel } from '@/hooks/useModuleAccess';
import { useDepartments } from '@/hooks/useOrgSettings';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, Shield, Eye, EyeOff, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import type { AppRole } from '@/hooks/usePermissions';

const MODULES = [
  { key: 'orders', label: 'Pedidos' },
  { key: 'tickets', label: 'Tickets TI' },
  { key: 'boards', label: 'Sunday (Projetos)' },
  { key: 'speaks', label: 'Speaks (Mensagens)' },
  { key: 'docs', label: 'Papelinho (Docs)' },
  { key: 'launches', label: 'Produção' },
  { key: 'melhorias', label: 'Melhorias' },
  { key: 'programacao', label: 'Programação' },
  { key: 'newsletters', label: 'Newsletters' },
  { key: 'demandas', label: 'Demandas Marketing' },
  { key: 'sessoes', label: 'Sessões' },
  { key: 'produtos', label: 'Produtos' },
  { key: 'calendario', label: 'Calendário' },
  { key: 'salas', label: 'Salas' },
] as const;

const ROLES: AppRole[] = ['admin', 'director', 'manager', 'operator', 'member'];
const ROLE_LABELS: Record<AppRole, string> = {
  admin: 'Admin', director: 'Diretor', manager: 'Gestor', operator: 'Operador', member: 'Membro',
};

const LEVEL_LABELS: Record<ModuleAccessLevel, string> = {
  hidden: 'Oculto', view: 'Somente ver', edit: 'Editar',
};
const LEVEL_ICONS: Record<ModuleAccessLevel, typeof Eye> = {
  hidden: EyeOff, view: Eye, edit: Pencil,
};
const LEVEL_COLORS: Record<ModuleAccessLevel, string> = {
  hidden: 'text-red-500', view: 'text-amber-500', edit: 'text-emerald-500',
};

export function ModuleAccessTab({ orgId, canEdit }: { orgId: string; canEdit: boolean }) {
  const { data: rules = [], isLoading } = useAllModuleAccess();
  const { data: departments = [] } = useDepartments(orgId);
  const qc = useQueryClient();
  const { currentOrg } = useOrganization();

  const [addModule, setAddModule] = useState(MODULES[0].key);
  const [addType, setAddType] = useState<'role' | 'department'>('role');
  const [addGrantee, setAddGrantee] = useState('member');
  const [addLevel, setAddLevel] = useState<ModuleAccessLevel>('view');

  const createMut = useMutation({
    mutationFn: async (input: { module_key: string; grantee_type: string; grantee_id: string; level: string }) => {
      const { error } = await supabase.from('module_access' as any).insert({
        organization_id: orgId,
        ...input,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['module-access-all', orgId] });
      qc.invalidateQueries({ queryKey: ['module-access'] });
      toast.success('Regra de acesso criada');
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao criar regra'),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('module_access' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['module-access-all', orgId] });
      qc.invalidateQueries({ queryKey: ['module-access'] });
      toast.success('Regra removida');
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao remover'),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, level }: { id: string; level: string }) => {
      const { error } = await supabase.from('module_access' as any).update({ level }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['module-access-all', orgId] });
      qc.invalidateQueries({ queryKey: ['module-access'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Erro'),
  });

  const granteeName = (type: string, id: string) => {
    if (type === 'role') return ROLE_LABELS[id as AppRole] || id;
    if (type === 'department') {
      const dept = departments.find((d: any) => d.id === id);
      return dept?.name || id;
    }
    return id;
  };

  const moduleLabel = (key: string) => MODULES.find((m) => m.key === key)?.label || key;

  // Group rules by module
  const rulesByModule = new Map<string, typeof rules>();
  for (const rule of rules) {
    const key = (rule as any).module_key;
    if (!rulesByModule.has(key)) rulesByModule.set(key, []);
    rulesByModule.get(key)!.push(rule);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Liberações de módulo
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Por padrão todos os módulos são visíveis para toda a organização.
          Adicione regras para restringir acesso por papel ou setor.
        </p>
      </div>

      {/* Add rule form */}
      {canEdit && (
        <Card className="p-4">
          <p className="text-xs font-medium uppercase text-muted-foreground mb-3">Nova regra</p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Módulo</label>
              <Select value={addModule} onValueChange={setAddModule}>
                <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MODULES.map((m) => (
                    <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Tipo</label>
              <Select value={addType} onValueChange={(v) => {
                setAddType(v as any);
                setAddGrantee(v === 'role' ? 'member' : departments[0]?.id || '');
              }}>
                <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="role">Papel</SelectItem>
                  <SelectItem value="department">Setor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">
                {addType === 'role' ? 'Papel' : 'Setor'}
              </label>
              <Select value={addGrantee} onValueChange={setAddGrantee}>
                <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {addType === 'role'
                    ? ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)
                    : departments.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)
                  }
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Nível</label>
              <Select value={addLevel} onValueChange={(v) => setAddLevel(v as ModuleAccessLevel)}>
                <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hidden">Oculto</SelectItem>
                  <SelectItem value="view">Somente ver</SelectItem>
                  <SelectItem value="edit">Editar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm"
              className="h-9"
              disabled={!addGrantee || createMut.isPending}
              onClick={() => createMut.mutate({
                module_key: addModule,
                grantee_type: addType,
                grantee_id: addGrantee,
                level: addLevel,
              })}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />Adicionar
            </Button>
          </div>
        </Card>
      )}

      {/* Rules table */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : rules.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Nenhuma regra de acesso definida. Todos os módulos estão visíveis para a organização inteira.
        </Card>
      ) : (
        <div className="space-y-3">
          {MODULES.filter((m) => rulesByModule.has(m.key)).map((mod) => {
            const modRules = rulesByModule.get(mod.key) || [];
            return (
              <Card key={mod.key} className="p-3">
                <p className="text-sm font-medium mb-2">{mod.label}</p>
                <div className="space-y-1.5">
                  {modRules.map((rule: any) => {
                    const LevelIcon = LEVEL_ICONS[rule.level as ModuleAccessLevel];
                    return (
                      <div key={rule.id} className="flex items-center gap-2 text-sm bg-muted/40 rounded-md px-3 py-2">
                        <Badge variant="outline" className="text-[10px]">
                          {rule.grantee_type === 'role' ? 'Papel' : 'Setor'}
                        </Badge>
                        <span className="font-medium">{granteeName(rule.grantee_type, rule.grantee_id)}</span>
                        <span className="text-muted-foreground mx-1">→</span>
                        <LevelIcon className={`h-3.5 w-3.5 ${LEVEL_COLORS[rule.level as ModuleAccessLevel]}`} />
                        {canEdit ? (
                          <Select
                            value={rule.level}
                            onValueChange={(v) => updateMut.mutate({ id: rule.id, level: v })}
                          >
                            <SelectTrigger className="h-7 w-[130px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="hidden">Oculto</SelectItem>
                              <SelectItem value="view">Somente ver</SelectItem>
                              <SelectItem value="edit">Editar</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-xs">{LEVEL_LABELS[rule.level as ModuleAccessLevel]}</span>
                        )}
                        {canEdit && (
                          <button
                            onClick={() => deleteMut.mutate(rule.id)}
                            className="ml-auto p-1 hover:text-destructive transition-colors"
                            aria-label="Remover regra"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
