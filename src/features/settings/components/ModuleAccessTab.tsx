import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAllModuleAccess, type ModuleAccessLevel } from '@/hooks/useModuleAccess';
import { usePermissionAuditLog, writePermissionAudit } from '@/hooks/usePermissionAudit';
import { useDepartments, useDepartmentMembers, useOrgMembersFull } from '@/hooks/useOrgSettings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, Shield, Eye, EyeOff, Pencil, History, Download, Wand2, Search, Upload, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import type { AppRole } from '@/hooks/usePermissions';

const MODULES = [
  { key: 'speaks', label: 'Speaks (Mensagens)' },
  { key: 'docs', label: 'Papelinho (Docs)' },
  { key: 'salas', label: 'Salas' },
  { key: 'equipe', label: 'Equipe' },
  { key: 'boards', label: 'Sunday (Projetos)' },
  { key: 'acoes_mensais', label: 'Ações Mensais' },
  { key: 'calendario', label: 'Calendário' },
  { key: 'marketing', label: 'Marketing' },
  { key: 'programacao', label: 'Programação' },
  { key: 'newsletters', label: 'Newsletters' },
  { key: 'demandas', label: 'Demandas Marketing' },
  { key: 'conteudo', label: 'Conteúdo' },
  { key: 'sessoes', label: 'Sessões' },
  { key: 'design', label: 'Design' },
  { key: 'produtos', label: 'Produtos' },
  { key: 'launches', label: 'Lançamentos' },
  { key: 'checklists', label: 'Checagens' },
  { key: 'producao', label: 'Boards Produção' },
  { key: 'melhorias', label: 'Melhorias' },
  { key: 'tickets', label: 'Tickets TI' },
  { key: 'comercial', label: 'Comercial' },
  { key: 'orders', label: 'Pedidos' },
  { key: 'financeiro', label: 'Financeiro' },
  { key: 'internacional', label: 'Internacional' },
  { key: 'configuracoes', label: 'Configurações' },
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

const CRITICAL_ACTIONS = [
  { area: 'Usuarios', action: 'Criar, suspender, reativar ou excluir usuario', role: 'Admin org ativo', guard: 'Edge Function, RLS e auditoria' },
  { area: 'Permissoes', action: 'Alterar papel global ou Suporte TI', role: 'Admin', guard: 'RLS em user_roles e auditoria' },
  { area: 'Liberacoes', action: 'Criar, editar ou remover regra de modulo', role: 'Admin org ativo', guard: 'RLS em module_access e auditoria' },
  { area: 'Camadas', action: 'Adicionar/remover pessoa em setor ou mudar papel no setor', role: 'Admin org ativo', guard: 'RLS em department_members e auditoria' },
  { area: 'Boards', action: 'Excluir entidades principais e subitens sensiveis', role: 'Manager+', guard: 'has_min_role(manager) nas policies' },
  { area: 'Automacoes', action: 'Configurar lembretes e automacoes de Data Acao', role: 'Editor do modulo/board', guard: 'module_access + preferencias do board' },
] as const;

type AccessPreset = {
  id: string;
  label: string;
  description: string;
  entries: Array<{
    module_key: string;
    grantee_type: 'role';
    grantee_id: AppRole;
    level: ModuleAccessLevel;
  }>;
};

const BOARD_MODULE_KEYS = [
  'boards',
  'acoes_mensais',
  'marketing',
  'programacao',
  'newsletters',
  'demandas',
  'conteudo',
  'sessoes',
  'design',
  'produtos',
  'launches',
  'checklists',
  'producao',
  'melhorias',
] as const;

const ACCESS_PRESETS: AccessPreset[] = [
  {
    id: 'operators_edit_boards',
    label: 'Operacao edita boards',
    description: 'Operadores editam boards de rotina; membros ficam em consulta nos mesmos modulos.',
    entries: [
      ...BOARD_MODULE_KEYS.map((module_key) => ({ module_key, grantee_type: 'role' as const, grantee_id: 'operator' as const, level: 'edit' as const })),
      ...BOARD_MODULE_KEYS.map((module_key) => ({ module_key, grantee_type: 'role' as const, grantee_id: 'member' as const, level: 'view' as const })),
    ],
  },
  {
    id: 'members_read_only',
    label: 'Membros somente consulta',
    description: 'Membros podem visualizar os modulos principais, sem editar.',
    entries: MODULES
      .filter((module) => module.key !== 'configuracoes')
      .map((module) => ({ module_key: module.key, grantee_type: 'role' as const, grantee_id: 'member' as const, level: 'view' as const })),
  },
  {
    id: 'sensitive_admin_only',
    label: 'Gestao e financeiro restritos',
    description: 'Configuracoes e Financeiro ficam ocultos para membros, operadores e gestores.',
    entries: ['configuracoes', 'financeiro'].flatMap((module_key) =>
      (['member', 'operator', 'manager'] as const).map((role) => ({
        module_key,
        grantee_type: 'role' as const,
        grantee_id: role,
        level: 'hidden' as const,
      })),
    ),
  },
];

export function ModuleAccessTab({ orgId, canEdit }: { orgId: string; canEdit: boolean }) {
  const { data: rules = [], isLoading } = useAllModuleAccess();
  const { data: auditRows = [], isLoading: auditLoading } = usePermissionAuditLog(canEdit ? orgId : undefined);
  const { data: departments = [] } = useDepartments(orgId);
  const { data: deptMembers = [] } = useDepartmentMembers(orgId);
  const { data: members = [] } = useOrgMembersFull(orgId);
  const qc = useQueryClient();
  const importInputRef = useRef<HTMLInputElement>(null);

  const [addModule, setAddModule] = useState<string>(MODULES[0].key);
  const [addType, setAddType] = useState<'role' | 'department' | 'user'>('role');
  const [addGrantee, setAddGrantee] = useState('member');
  const [addLevel, setAddLevel] = useState<ModuleAccessLevel>('view');
  const [auditSearch, setAuditSearch] = useState('');
  const [auditEntityFilter, setAuditEntityFilter] = useState('all');
  const [auditActionFilter, setAuditActionFilter] = useState('all');
  const [presetId, setPresetId] = useState(ACCESS_PRESETS[0].id);
  const [simulateUserId, setSimulateUserId] = useState('');

  const validModuleKeys = new Set(MODULES.map((module) => module.key));
  const validLevels = new Set(['hidden', 'view', 'edit']);
  const validTypes = new Set(['role', 'department', 'user']);

  const invalidateAccess = () => {
    qc.invalidateQueries({ queryKey: ['module-access-all', orgId] });
    qc.invalidateQueries({ queryKey: ['module-access'] });
  };

  const logAccessAudit = (input: {
    action: string;
    before_state?: Record<string, unknown> | null;
    after_state?: Record<string, unknown> | null;
    entity_id?: string | null;
    target_user_id?: string | null;
    metadata?: Record<string, unknown>;
  }) => {
    void writePermissionAudit({
      organization_id: orgId,
      entity_type: 'module_access',
      entity_id: input.entity_id,
      target_user_id: input.target_user_id,
      action: input.action,
      before_state: input.before_state,
      after_state: input.after_state,
      metadata: input.metadata,
    })
      .then(() => qc.invalidateQueries({ queryKey: ['permission-audit-log', orgId] }))
      .catch((error) => console.warn('Permission audit write failed', error));
  };

  const createMut = useMutation({
    mutationFn: async (input: { module_key: string; grantee_type: string; grantee_id: string; level: string }) => {
      const { data, error } = await supabase
        .from('module_access' as any)
        .insert({
          organization_id: orgId,
          ...input,
        })
        .select('*')
        .single();
      if (error) throw error;
      return data as Record<string, unknown>;
    },
    onSuccess: (row) => {
      invalidateAccess();
      logAccessAudit({
        action: 'create',
        after_state: row,
        entity_id: String(row.id ?? ''),
        target_user_id: row.grantee_type === 'user' ? String(row.grantee_id) : null,
        metadata: {
          module_key: row.module_key,
          grantee_type: row.grantee_type,
          level: row.level,
        },
      });
      toast.success('Regra de acesso criada');
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao criar regra'),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { data: before } = await supabase
        .from('module_access' as any)
        .select('*')
        .eq('id', id)
        .maybeSingle();
      const { error } = await supabase.from('module_access' as any).delete().eq('id', id);
      if (error) throw error;
      return (before || { id }) as Record<string, unknown>;
    },
    onSuccess: (before, id) => {
      invalidateAccess();
      logAccessAudit({
        action: 'delete',
        before_state: before,
        entity_id: String(before.id ?? id),
        target_user_id: before.grantee_type === 'user' ? String(before.grantee_id) : null,
        metadata: {
          module_key: before.module_key,
          grantee_type: before.grantee_type,
          level: before.level,
        },
      });
      toast.success('Regra removida');
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao remover'),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, level }: { id: string; level: string }) => {
      const { data: before } = await supabase
        .from('module_access' as any)
        .select('*')
        .eq('id', id)
        .maybeSingle();
      const { data: after, error } = await supabase
        .from('module_access' as any)
        .update({ level })
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      return {
        before: before as Record<string, unknown> | null,
        after: after as Record<string, unknown>,
      };
    },
    onSuccess: ({ before, after }) => {
      invalidateAccess();
      logAccessAudit({
        action: 'update_level',
        before_state: before,
        after_state: after,
        entity_id: String(after.id ?? before?.id ?? ''),
        target_user_id: after.grantee_type === 'user' ? String(after.grantee_id) : null,
        metadata: {
          module_key: after.module_key,
          grantee_type: after.grantee_type,
          from_level: before?.level,
          to_level: after.level,
        },
      });
    },
    onError: (e: any) => toast.error(e?.message || 'Erro'),
  });

  const applyPresetMut = useMutation({
    mutationFn: async (preset: AccessPreset) => {
      const rows = preset.entries.map((entry) => ({
        organization_id: orgId,
        ...entry,
      }));
      const { data, error } = await supabase
        .from('module_access' as any)
        .upsert(rows, { onConflict: 'organization_id,module_key,grantee_type,grantee_id' })
        .select('*');
      if (error) throw error;
      return { preset, rows: (data || []) as Record<string, unknown>[] };
    },
    onSuccess: ({ preset, rows }) => {
      invalidateAccess();
      logAccessAudit({
        action: 'apply_preset',
        after_state: {
          preset_id: preset.id,
          preset_label: preset.label,
          rules_applied: rows.length,
        },
        metadata: {
          preset_id: preset.id,
          modules: Array.from(new Set(preset.entries.map((entry) => entry.module_key))),
          roles: Array.from(new Set(preset.entries.map((entry) => entry.grantee_id))),
        },
      });
      toast.success(`Preset aplicado: ${preset.label}`);
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao aplicar preset'),
  });

  const importRulesMut = useMutation({
    mutationFn: async (rows: Array<{ module_key: string; grantee_type: string; grantee_id: string; level: string }>) => {
      const payload = rows.map((row) => ({ organization_id: orgId, ...row }));
      const { data, error } = await supabase
        .from('module_access' as any)
        .upsert(payload, { onConflict: 'organization_id,module_key,grantee_type,grantee_id' })
        .select('*');
      if (error) throw error;
      return (data || []) as Record<string, unknown>[];
    },
    onSuccess: (rows) => {
      invalidateAccess();
      logAccessAudit({
        action: 'import_rules',
        after_state: { imported_rules: rows.length },
        metadata: {
          modules: Array.from(new Set(rows.map((row) => row.module_key))),
          grantee_types: Array.from(new Set(rows.map((row) => row.grantee_type))),
        },
      });
      toast.success(`${rows.length} regra${rows.length === 1 ? '' : 's'} importada${rows.length === 1 ? '' : 's'}`);
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao importar regras'),
  });

  const exportAccessRules = () => {
    const payload = {
      version: 1,
      organization_id: orgId,
      exported_at: new Date().toISOString(),
      rules: rules.map((rule: any) => ({
        module_key: rule.module_key,
        module_label: moduleLabel(rule.module_key),
        grantee_type: rule.grantee_type,
        grantee_id: rule.grantee_id,
        grantee_label: granteeName(rule.grantee_type, rule.grantee_id),
        level: rule.level,
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `liberacoes-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (file: File) => {
    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw) as { rules?: unknown };
      const importedRules = Array.isArray(parsed.rules) ? parsed.rules : Array.isArray(parsed) ? parsed : [];
      const rows = importedRules.map((rule: any) => ({
        module_key: String(rule.module_key || ''),
        grantee_type: String(rule.grantee_type || ''),
        grantee_id: String(rule.grantee_id || ''),
        level: String(rule.level || ''),
      }));
      const invalid = rows.find((row) =>
        !validModuleKeys.has(row.module_key as any)
        || !validTypes.has(row.grantee_type)
        || !row.grantee_id
        || !validLevels.has(row.level),
      );
      if (invalid) {
        toast.error('Arquivo possui regra invalida');
        return;
      }
      if (rows.length === 0) {
        toast.error('Arquivo sem regras para importar');
        return;
      }
      importRulesMut.mutate(rows);
    } catch (error) {
      console.warn('Rule import failed', error);
      toast.error('Nao foi possivel ler o JSON');
    }
  };

  const granteeName = (type: string, id: string) => {
    if (type === 'role') return ROLE_LABELS[id as AppRole] || id;
    if (type === 'department') {
      const dept = departments.find((d: any) => d.id === id);
      return dept?.name || id;
    }
    if (type === 'user') {
      const member = members.find((m: any) => m.user_id === id);
      return member?.full_name || member?.email || id;
    }
    return id;
  };

  const moduleLabel = (key: string) => MODULES.find((m) => m.key === key)?.label || key;
  const selectedPreset = ACCESS_PRESETS.find((preset) => preset.id === presetId) || ACCESS_PRESETS[0];
  const simulatedMember = members.find((member: any) => member.user_id === simulateUserId) || members[0] || null;
  const simulatedDeptIds = simulatedMember
    ? deptMembers.filter((deptMember) => deptMember.user_id === simulatedMember.user_id).map((deptMember) => deptMember.department_id)
    : [];
  const simulatedAccess = MODULES.map((mod) => {
    if (!simulatedMember) {
      return { module: mod, level: 'hidden' as ModuleAccessLevel, source: 'Sem usuario' };
    }
    if (simulatedMember.org_role === 'admin' || simulatedMember.app_role === 'admin') {
      return { module: mod, level: 'edit' as ModuleAccessLevel, source: 'Admin' };
    }

    const moduleRules = rules.filter((rule: any) => rule.module_key === mod.key);
    if (moduleRules.length === 0) {
      return { module: mod, level: 'edit' as ModuleAccessLevel, source: 'Padrao org' };
    }

    const userRule = moduleRules.find((rule: any) => rule.grantee_type === 'user' && rule.grantee_id === simulatedMember.user_id);
    if (userRule) return { module: mod, level: userRule.level as ModuleAccessLevel, source: 'Regra usuario' };

    const deptRule = moduleRules.find((rule: any) => rule.grantee_type === 'department' && simulatedDeptIds.includes(rule.grantee_id));
    if (deptRule) return { module: mod, level: deptRule.level as ModuleAccessLevel, source: 'Regra setor' };

    const roleRule = moduleRules.find((rule: any) => rule.grantee_type === 'role' && rule.grantee_id === simulatedMember.app_role);
    if (roleRule) return { module: mod, level: roleRule.level as ModuleAccessLevel, source: 'Regra papel' };

    return { module: mod, level: 'hidden' as ModuleAccessLevel, source: 'Sem regra aplicavel' };
  });

  const auditStateLabel = (state?: Record<string, unknown> | null) => {
    if (!state) return 'Regra removida';
    const presetLabel = typeof state.preset_label === 'string' ? state.preset_label : '';
    const rulesApplied = typeof state.rules_applied === 'number' ? state.rules_applied : null;
    if (presetLabel) return `${presetLabel} (${rulesApplied ?? 0} regras)`;
    const importedRules = typeof state.imported_rules === 'number' ? state.imported_rules : null;
    if (importedRules !== null) return `${importedRules} regras importadas`;
    const moduleKey = typeof state.module_key === 'string' ? state.module_key : '';
    const granteeType = typeof state.grantee_type === 'string' ? state.grantee_type : '';
    const granteeId = typeof state.grantee_id === 'string' ? state.grantee_id : '';
    const level = typeof state.level === 'string' ? state.level : '';
    if (moduleKey) {
      const target = granteeType && granteeId ? granteeName(granteeType, granteeId) : '';
      const levelLabel = LEVEL_LABELS[level as ModuleAccessLevel] || level;
      return [moduleLabel(moduleKey), target, levelLabel].filter(Boolean).join(' - ');
    }

    const fullName = typeof state.full_name === 'string' ? state.full_name : '';
    const email = typeof state.email === 'string' ? state.email : '';
    const userId = typeof state.user_id === 'string' ? state.user_id : '';
    const departmentName = typeof state.department_name === 'string' ? state.department_name : '';
    const role = typeof state.role === 'string' ? state.role : '';
    const appRole = typeof state.app_role === 'string' ? state.app_role : '';
    const orgRole = typeof state.org_role === 'string' ? state.org_role : '';
    const status = typeof state.status === 'string' ? state.status : '';

    if (departmentName) return [departmentName, fullName || userId, role].filter(Boolean).join(' - ');
    if (appRole) return [fullName || email || userId, `app: ${appRole}`].filter(Boolean).join(' - ');
    if (orgRole) return [fullName || email || userId, `org: ${orgRole}`].filter(Boolean).join(' - ');
    if (status) return [fullName || email || userId, status].filter(Boolean).join(' - ');
    if (state.password_reset) return 'Senha resetada';
    return fullName || email || userId || 'Registro de permissao';
  };

  const auditActionLabel = (action: string) => {
    if (action === 'create') return 'Criada';
    if (action === 'delete') return 'Removida';
    if (action === 'update_level') return 'Nivel alterado';
    if (action === 'apply_preset') return 'Preset aplicado';
    if (action === 'import_rules') return 'Regras importadas';
    if (action === 'create_user') return 'Usuario criado';
    if (action === 'delete_user') return 'Usuario excluido';
    if (action === 'remove_org_member') return 'Usuario removido';
    if (action === 'suspend_user') return 'Usuario suspenso';
    if (action === 'reactivate_user') return 'Usuario reativado';
    if (action === 'reset_password') return 'Senha resetada';
    if (action === 'update_org_role') return 'Papel org alterado';
    if (action === 'update_app_role') return 'Permissao alterada';
    if (action === 'add_department_member') return 'Setor adicionado';
    if (action === 'remove_department_member') return 'Setor removido';
    if (action === 'update_department_role') return 'Papel setor alterado';
    if (action === 'enable_it_support') return 'Suporte TI ativado';
    if (action === 'disable_it_support') return 'Suporte TI removido';
    return action;
  };

  const auditEntityLabel = (entity: string) => {
    if (entity === 'module_access') return 'Liberacoes';
    if (entity === 'organization_user') return 'Usuarios';
    if (entity === 'organization_member') return 'Membros';
    if (entity === 'department_member') return 'Camadas de setor';
    if (entity === 'user_role') return 'Permissoes';
    return entity;
  };

  const auditRowLabel = (row: (typeof auditRows)[number]) => {
    const state = row.after_state || row.before_state;
    const stateLabel = auditStateLabel(state);
    return [auditActionLabel(row.action), auditEntityLabel(row.entity_type), stateLabel, row.entity_id]
      .filter(Boolean)
      .join(' ');
  };

  const auditEntityOptions = Array.from(new Set(auditRows.map((row) => row.entity_type))).sort();
  const auditActionOptions = Array.from(new Set(auditRows.map((row) => row.action))).sort();
  const filteredAuditRows = auditRows.filter((row) => {
    const matchesEntity = auditEntityFilter === 'all' || row.entity_type === auditEntityFilter;
    const matchesAction = auditActionFilter === 'all' || row.action === auditActionFilter;
    const q = auditSearch.trim().toLowerCase();
    const matchesSearch = !q || auditRowLabel(row).toLowerCase().includes(q);
    return matchesEntity && matchesAction && matchesSearch;
  });

  const exportAuditCsv = () => {
    const escapeCsv = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = filteredAuditRows.map((row) => [
      row.created_at,
      auditEntityLabel(row.entity_type),
      auditActionLabel(row.action),
      row.target_user_id ?? '',
      auditStateLabel(row.before_state),
      auditStateLabel(row.after_state),
      row.entity_id ?? '',
    ]);
    const csv = [
      ['data', 'tipo', 'acao', 'usuario_alvo', 'antes', 'depois', 'entidade'].map(escapeCsv).join(','),
      ...rows.map((row) => row.map(escapeCsv).join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `auditoria-permissoes-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Group rules by module
  const rulesByModule = new Map<string, typeof rules>();
  for (const rule of rules) {
    const key = (rule as any).module_key;
    if (!rulesByModule.has(key)) rulesByModule.set(key, []);
    rulesByModule.get(key)!.push(rule);
  }

  const memberIdsByDepartment = new Map<string, number>();
  for (const dept of departments) memberIdsByDepartment.set(dept.id, 0);
  for (const deptMember of deptMembers) {
    memberIdsByDepartment.set(deptMember.department_id, (memberIdsByDepartment.get(deptMember.department_id) || 0) + 1);
  }
  const deptIdsByMember = new Map<string, number>();
  for (const deptMember of deptMembers) {
    deptIdsByMember.set(deptMember.user_id, (deptIdsByMember.get(deptMember.user_id) || 0) + 1);
  }
  const knownDeptIds = new Set(departments.map((dept) => dept.id));
  const knownMemberIds = new Set(members.map((member: any) => member.user_id));
  const diagnostics: Array<{ severity: 'danger' | 'warning' | 'info'; title: string; detail: string }> = [];

  for (const rule of rules as any[]) {
    if (!validModuleKeys.has(rule.module_key)) {
      diagnostics.push({ severity: 'warning', title: 'Modulo desconhecido', detail: `${rule.module_key} possui regra cadastrada mas nao esta no catalogo atual.` });
    }
    if (rule.grantee_type === 'department' && !knownDeptIds.has(rule.grantee_id)) {
      diagnostics.push({ severity: 'warning', title: 'Setor inexistente', detail: `${moduleLabel(rule.module_key)} aponta para um setor que nao existe mais.` });
    }
    if (rule.grantee_type === 'user' && !knownMemberIds.has(rule.grantee_id)) {
      diagnostics.push({ severity: 'warning', title: 'Usuario inexistente', detail: `${moduleLabel(rule.module_key)} aponta para um usuario fora da organizacao.` });
    }
    if (rule.grantee_type === 'role' && rule.grantee_id === 'admin' && rule.level !== 'edit') {
      diagnostics.push({ severity: 'info', title: 'Regra ineficaz para admin', detail: `${moduleLabel(rule.module_key)} tem regra ${LEVEL_LABELS[rule.level as ModuleAccessLevel]} para Admin, mas admin sempre resolve como Editar.` });
    }
  }

  for (const module of MODULES) {
    const moduleRules = (rulesByModule.get(module.key) || []) as any[];
    if (moduleRules.length > 0) {
      const hasNonAdminEditor = moduleRules.some((rule) => rule.level === 'edit' && !(rule.grantee_type === 'role' && rule.grantee_id === 'admin'));
      if (!hasNonAdminEditor && module.key !== 'configuracoes' && module.key !== 'financeiro') {
        diagnostics.push({ severity: 'info', title: 'Modulo sem editor operacional', detail: `${module.label} possui regras, mas nenhuma regra de edicao para papel, setor ou usuario nao-admin.` });
      }
    }
  }

  for (const sensitiveKey of ['configuracoes', 'financeiro']) {
    const looseRule = ((rulesByModule.get(sensitiveKey) || []) as any[]).find(
      (rule) => rule.grantee_type === 'role'
        && ['member', 'operator', 'manager'].includes(rule.grantee_id)
        && rule.level !== 'hidden',
    );
    if (looseRule) {
      diagnostics.push({ severity: 'danger', title: 'Modulo sensivel liberado', detail: `${moduleLabel(sensitiveKey)} esta ${LEVEL_LABELS[looseRule.level as ModuleAccessLevel]} para ${granteeName('role', looseRule.grantee_id)}.` });
    }
  }

  for (const dept of departments) {
    if ((memberIdsByDepartment.get(dept.id) || 0) === 0) {
      diagnostics.push({ severity: 'info', title: 'Setor sem pessoas', detail: `${dept.name} existe como camada, mas nao possui membros.` });
    }
  }
  for (const member of members as any[]) {
    if (member.status !== 'suspended' && member.org_role !== 'admin' && (deptIdsByMember.get(member.user_id) || 0) === 0) {
      diagnostics.push({ severity: 'warning', title: 'Usuario sem camada', detail: `${member.full_name || member.email || member.user_id} nao pertence a nenhum setor.` });
    }
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
                const nextType = v as 'role' | 'department' | 'user';
                setAddType(nextType);
                setAddGrantee(
                  nextType === 'role'
                    ? 'member'
                    : nextType === 'department'
                      ? departments[0]?.id || ''
                      : (members[0] as any)?.user_id || ''
                );
              }}>
                <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="role">Papel</SelectItem>
                  <SelectItem value="department">Setor</SelectItem>
                  <SelectItem value="user">Usuário</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">
                {addType === 'role' ? 'Papel' : addType === 'department' ? 'Setor' : 'Usuário'}
              </label>
              <Select value={addGrantee} onValueChange={setAddGrantee}>
                <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {addType === 'role'
                    ? ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)
                    : addType === 'department'
                      ? departments.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)
                      : members.map((m: any) => (
                        <SelectItem key={m.user_id} value={m.user_id}>
                          {m.full_name || m.email || m.user_id.slice(0, 8)}
                        </SelectItem>
                      ))
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

      {canEdit && (
        <Card className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-primary" />
            <div>
              <p className="text-sm font-semibold">Presets de permissao</p>
              <p className="text-xs text-muted-foreground">Aplique conjuntos comuns de regras por papel sem apagar regras existentes.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Preset</label>
              <Select value={presetId} onValueChange={setPresetId}>
                <SelectTrigger className="h-9 w-[260px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACCESS_PRESETS.map((preset) => (
                    <SelectItem key={preset.id} value={preset.id}>{preset.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm"
              className="h-9"
              disabled={applyPresetMut.isPending}
              onClick={() => applyPresetMut.mutate(selectedPreset)}
            >
              <Wand2 className="h-3.5 w-3.5 mr-1" />Aplicar preset
            </Button>
          </div>
          <div className="mt-3 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{selectedPreset.label}</span>
            <span className="mx-1">-</span>
            {selectedPreset.description}
            <span className="ml-2 text-foreground">({selectedPreset.entries.length} regras)</span>
          </div>
        </Card>
      )}

      {canEdit && (
        <Card className="p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Download className="h-4 w-4 text-primary" />
              <div>
                <p className="text-sm font-semibold">Backup de liberacoes</p>
                <p className="text-xs text-muted-foreground">Exporte ou importe regras em JSON para mover configuracoes entre ambientes.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="h-8 gap-1.5" disabled={rules.length === 0} onClick={exportAccessRules}>
                <Download className="h-3.5 w-3.5" /> Exportar JSON
              </Button>
              <Button variant="outline" size="sm" className="h-8 gap-1.5" disabled={importRulesMut.isPending} onClick={() => importInputRef.current?.click()}>
                <Upload className="h-3.5 w-3.5" /> Importar JSON
              </Button>
              <input
                ref={importInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleImportFile(file);
                  event.target.value = '';
                }}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Importacao usa a chave unica de modulo, tipo e alvo: regras existentes sao atualizadas, novas regras sao criadas.
          </p>
        </Card>
      )}

      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-primary" />
            <div>
              <p className="text-sm font-semibold">Diagnostico de liberacoes e camadas</p>
              <p className="text-xs text-muted-foreground">Sinais para revisar antes de publicar ou mexer em permissoes sensiveis.</p>
            </div>
          </div>
          <Badge variant={diagnostics.length === 0 ? 'secondary' : 'outline'} className="text-[10px]">
            {diagnostics.length === 0 ? 'Sem alertas' : `${diagnostics.length} alerta${diagnostics.length === 1 ? '' : 's'}`}
          </Badge>
        </div>
        {diagnostics.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum conflito ou ponto de atencao detectado nas regras atuais.</p>
        ) : (
          <div className="divide-y rounded-md border">
            {diagnostics.slice(0, 12).map((item, index) => (
              <div key={`${item.title}-${index}`} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                <Badge
                  variant={item.severity === 'danger' ? 'destructive' : 'outline'}
                  className={`text-[10px] ${item.severity === 'warning' ? 'border-amber-500/60 text-amber-700' : ''}`}
                >
                  {item.severity === 'danger' ? 'critico' : item.severity === 'warning' ? 'atencao' : 'info'}
                </Badge>
                <span className="font-medium">{item.title}</span>
                <span className="min-w-0 flex-1 text-muted-foreground">{item.detail}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" />
            <div>
              <p className="text-sm font-semibold">Simulador de acesso</p>
              <p className="text-xs text-muted-foreground">Mostra o nivel efetivo por usuario, considerando regra de usuario, setor, papel e padrao.</p>
            </div>
          </div>
          <Select value={simulateUserId || simulatedMember?.user_id || ''} onValueChange={setSimulateUserId}>
            <SelectTrigger className="h-9 w-[240px]"><SelectValue placeholder="Selecionar usuario" /></SelectTrigger>
            <SelectContent>
              {members.map((member: any) => (
                <SelectItem key={member.user_id} value={member.user_id}>
                  {member.full_name || member.email || member.user_id.slice(0, 8)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {simulatedMember ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {simulatedAccess.map(({ module, level, source }) => {
              const LevelIcon = LEVEL_ICONS[level];
              return (
                <div key={module.key} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                  <LevelIcon className={`h-3.5 w-3.5 ${LEVEL_COLORS[level]}`} />
                  <span className="min-w-0 flex-1 truncate">{module.label}</span>
                  <Badge variant={level === 'hidden' ? 'destructive' : 'outline'} className="text-[10px]">
                    {LEVEL_LABELS[level]}
                  </Badge>
                  <span className="w-20 truncate text-[10px] text-muted-foreground" title={source}>{source}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum usuario disponivel para simular.</p>
        )}
      </Card>

      <Card className="p-4">
        <div className="mb-3">
          <p className="text-sm font-semibold">Matriz de acoes criticas</p>
          <p className="text-xs text-muted-foreground">Referencia operacional para revisar permissoes, camadas e liberacoes.</p>
        </div>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Area</th>
                <th className="px-3 py-2 font-medium">Acao critica</th>
                <th className="px-3 py-2 font-medium">Nivel esperado</th>
                <th className="px-3 py-2 font-medium">Protecao atual</th>
              </tr>
            </thead>
            <tbody>
              {CRITICAL_ACTIONS.map((item) => (
                <tr key={`${item.area}-${item.action}`} className="border-t">
                  <td className="px-3 py-2">
                    <Badge variant="secondary" className="text-[10px]">{item.area}</Badge>
                  </td>
                  <td className="px-3 py-2">{item.action}</td>
                  <td className="px-3 py-2">{item.role}</td>
                  <td className="px-3 py-2 text-muted-foreground">{item.guard}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

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
                          {rule.grantee_type === 'role' ? 'Papel' : rule.grantee_type === 'department' ? 'Setor' : 'Usuário'}
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

      {canEdit && (
        <Card className="p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              <div>
                <p className="text-sm font-semibold">Auditoria recente</p>
                <p className="text-xs text-muted-foreground">Ultimas mudancas em liberacoes, permissoes e usuarios.</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              disabled={filteredAuditRows.length === 0}
              onClick={exportAuditCsv}
            >
              <Download className="h-3.5 w-3.5" /> Exportar CSV
            </Button>
          </div>
          <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_180px_190px]">
            <Input
              value={auditSearch}
              onChange={(event) => setAuditSearch(event.target.value)}
              placeholder="Buscar na auditoria"
              className="h-8"
            />
            <Select value={auditEntityFilter} onValueChange={setAuditEntityFilter}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {auditEntityOptions.map((entity) => (
                  <SelectItem key={entity} value={entity}>{auditEntityLabel(entity)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={auditActionFilter} onValueChange={setAuditActionFilter}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as acoes</SelectItem>
                {auditActionOptions.map((action) => (
                  <SelectItem key={action} value={action}>{auditActionLabel(action)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {auditLoading ? (
            <p className="text-sm text-muted-foreground">Carregando auditoria...</p>
          ) : filteredAuditRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum registro encontrado.</p>
          ) : (
            <div className="divide-y rounded-md border">
              {filteredAuditRows.slice(0, 20).map((row) => {
                const state = row.after_state || row.before_state;
                return (
                  <div key={row.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                    <Badge variant="outline" className="text-[10px]">{auditActionLabel(row.action)}</Badge>
                    <Badge variant="secondary" className="text-[10px]">{auditEntityLabel(row.entity_type)}</Badge>
                    <span className="min-w-0 flex-1 truncate">{auditStateLabel(state)}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(row.created_at).toLocaleString('pt-BR')}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
