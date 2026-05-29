import { useEffect, useState } from 'react';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  useDepartments,
  useCreateDepartment,
  useDeleteDepartment,
  useOrgMembersFull,
  useUpdateMemberProfile,
  useUpdateOrgRole,
  useUpdateAppRole,
  useRemoveOrgMember,
  useCreateOrgUser,
  useDepartmentMembers,
  useAddDepartmentMember,
  useUpdateDepartmentMemberRole,
  useRemoveDepartmentMember,
  useItSupportMembers,
  useToggleItSupport,
  useResetUserPassword,
} from '@/hooks/useOrgSettings';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Trash2, Plus, UserPlus, Shield, Users as UsersIcon, Building2, Settings as SettingsIcon, User as UserIcon, Check, ChevronDown, Mail, ArrowLeft, ArrowRight, KeyRound, Wrench } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';

import { toast } from 'sonner';
import { ProfileTab } from '@/components/settings/ProfileTab';
import { useConfirm } from '@/components/ConfirmDialog';

type AppRole = 'admin' | 'manager' | 'member' | 'director' | 'operator';

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export default function SettingsPage() {
  const { currentOrg, isAdmin } = useOrganization();

  if (!currentOrg) {
    return <div className="flex items-center justify-center h-full text-muted-foreground">Selecione uma organização</div>;
  }

  return (
    <div className="container max-w-6xl mx-auto py-6 sm:py-8 px-3 sm:px-6">
      <div className="mb-6 rounded-lg border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
            <SettingsIcon className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold">Configurações</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">{currentOrg.name}</p>
          </div>
          {isAdmin && <OrgLogoUploader />}
        </div>
      </div>

      {!isAdmin && (
        <div className="mb-4 p-3 bg-muted rounded-md text-sm text-muted-foreground">
          Você está em modo somente leitura. Apenas administradores podem editar usuários, setores e permissões.
        </div>
      )}

      <Tabs defaultValue="profile" className="space-y-5">
        <TabsList className="grid h-auto w-full grid-cols-1 gap-1 rounded-lg bg-muted/60 p-1 sm:grid-cols-2 lg:grid-cols-6">
          <TabsTrigger value="profile" className="justify-start gap-2 px-3 py-2"><UserIcon className="h-4 w-4" />Meu perfil</TabsTrigger>
          {isAdmin && <TabsTrigger value="users" className="justify-start gap-2 px-3 py-2"><UsersIcon className="h-4 w-4" />Usuários</TabsTrigger>}
          {isAdmin && <TabsTrigger value="departments" className="justify-start gap-2 px-3 py-2"><Building2 className="h-4 w-4" />Setores</TabsTrigger>}
          {isAdmin && <TabsTrigger value="teams" className="justify-start gap-2 px-3 py-2"><UsersIcon className="h-4 w-4" />Equipes de setor</TabsTrigger>}
          {isAdmin && <TabsTrigger value="permissions" className="justify-start gap-2 px-3 py-2"><Shield className="h-4 w-4" />Permissões</TabsTrigger>}
          {isAdmin && <TabsTrigger value="emails" className="justify-start gap-2 px-3 py-2"><Mail className="h-4 w-4" />Emails</TabsTrigger>}
        </TabsList>

        <TabsContent value="profile" className="mt-0">
          <ProfileTab />
        </TabsContent>
        {isAdmin && (
          <>
            <TabsContent value="users" className="mt-0">
              <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
                <UsersTab orgId={currentOrg.id} canEdit={isAdmin} />
              </div>
            </TabsContent>
            <TabsContent value="departments" className="mt-0">
              <DepartmentsTab orgId={currentOrg.id} canEdit={isAdmin} />
            </TabsContent>
            <TabsContent value="teams" className="mt-0">
              <DepartmentTeamsTab orgId={currentOrg.id} canEdit={isAdmin} />
            </TabsContent>
            <TabsContent value="permissions" className="mt-0">
              <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
                <PermissionsTab orgId={currentOrg.id} canEdit={isAdmin} />
              </div>
            </TabsContent>
            <TabsContent value="emails" className="mt-0">
              <EmailsTab />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}

/* ----- Usuários ----- */
function UsersTab({ orgId, canEdit }: { orgId: string; canEdit: boolean }) {
  const { data: members = [] } = useOrgMembersFull(orgId);
  const { data: departments = [] } = useDepartments(orgId);
  const { data: deptMembers = [] } = useDepartmentMembers(orgId);
  const addDeptMember = useAddDepartmentMember();
  const removeDeptMember = useRemoveDepartmentMember();
  const updateProfile = useUpdateMemberProfile();
  const updateOrgRole = useUpdateOrgRole();
  const removeMember = useRemoveOrgMember();
  const resetPassword = useResetUserPassword();
  const confirm = useConfirm();

  const [showCreate, setShowCreate] = useState(false);
  const [resetResult, setResetResult] = useState<{ name: string; password: string } | null>(null);

  return (
    <div>
      {canEdit && (
        <div className="flex justify-end mb-4">
          <Button onClick={() => setShowCreate(true)}><UserPlus className="h-4 w-4 mr-2" />Novo usuário</Button>
        </div>
      )}

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left">
              <th className="px-4 py-2 font-medium">Usuário</th>
              <th className="px-4 py-2 font-medium">Setores</th>
              <th className="px-4 py-2 font-medium">Papel na org</th>
              <th className="px-4 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const initials = (m.full_name ?? '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
              return (
                <tr key={m.user_id} className="border-t">
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7">
                        {m.avatar_url && <AvatarImage src={m.avatar_url} alt={m.full_name ?? ''} />}
                        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                      </Avatar>
                      <div className="font-medium">{m.full_name || 'Sem nome'}</div>
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    {(() => {
                      const userDeptIds = deptMembers
                        .filter((dm) => dm.user_id === m.user_id)
                        .map((dm) => dm.department_id);
                      const userDepts = departments.filter((d) => userDeptIds.includes(d.id));
                      const toggle = async (deptId: string, deptName: string, on: boolean) => {
                        if (on) {
                          await addDeptMember.mutateAsync({ department_id: deptId, user_id: m.user_id, role: 'operator' });
                          if (userDeptIds.length === 0) {
                            updateProfile.mutate({ user_id: m.user_id, department: deptName });
                          }
                        } else {
                          const row = deptMembers.find((dm) => dm.user_id === m.user_id && dm.department_id === deptId);
                          if (row) await removeDeptMember.mutateAsync(row.id);
                          if (m.department === deptName) {
                            const remaining = userDepts.filter((d) => d.id !== deptId);
                            updateProfile.mutate({ user_id: m.user_id, department: remaining[0]?.name ?? null });
                          }
                        }
                      };
                      return (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={!canEdit}
                              className="h-8 w-48 justify-between font-normal"
                            >
                              <span className="truncate text-left flex-1">
                                {userDepts.length === 0
                                  ? <span className="text-muted-foreground">—</span>
                                  : userDepts.length === 1
                                    ? userDepts[0].name
                                    : `${userDepts[0].name} +${userDepts.length - 1}`}
                              </span>
                              <ChevronDown className="h-3.5 w-3.5 opacity-60 shrink-0" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent align="start" className="w-56 p-1">
                            {departments.length === 0 && (
                              <div className="px-2 py-3 text-xs text-muted-foreground text-center">Nenhum setor</div>
                            )}
                            {departments.map((d) => {
                              const checked = userDeptIds.includes(d.id);
                              const isPrimary = m.department === d.name;
                              return (
                                <button
                                  key={d.id}
                                  type="button"
                                  onClick={() => toggle(d.id, d.name, !checked)}
                                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-sm hover:bg-accent text-left"
                                >
                                  <div className="h-4 w-4 flex items-center justify-center">
                                    {checked && <Check className="h-3.5 w-3.5 text-primary" />}
                                  </div>
                                  <span className="flex-1 truncate">{d.name}</span>
                                  {checked && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (!isPrimary) updateProfile.mutate({ user_id: m.user_id, department: d.name });
                                      }}
                                      className={`text-[10px] px-1.5 py-0.5 rounded ${isPrimary ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}
                                      title={isPrimary ? 'Setor principal' : 'Tornar principal'}
                                    >
                                      {isPrimary ? 'principal' : 'tornar principal'}
                                    </button>
                                  )}
                                </button>
                              );
                            })}
                          </PopoverContent>
                        </Popover>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-2">
                    <Select
                      disabled={!canEdit}
                      value={m.org_role}
                      onValueChange={(v: 'admin' | 'member') => updateOrgRole.mutate({ organization_id: orgId, user_id: m.user_id, role: v })}
                    >
                      <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="member">Membro</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-2">
                    {canEdit && (
                      <div className="flex items-center gap-1 justify-end">
                        <Button
                          variant="ghost" size="icon" className="h-8 w-8"
                          title="Resetar senha"
                          disabled={resetPassword.isPending}
                          onClick={async () => {
                            const ok = await confirm({
                              title: `Resetar senha de ${m.full_name || 'usuário'}?`,
                              description: 'Será gerada uma nova senha temporária. Você poderá copiá-la e enviar à pessoa.',
                              confirmText: 'Resetar',
                            });
                            if (!ok) return;
                            try {
                              const res = await resetPassword.mutateAsync({ user_id: m.user_id, organization_id: orgId });
                              setResetResult({ name: m.full_name || 'Usuário', password: res.password });
                            } catch (e: unknown) {
                              toast.error(getErrorMessage(e, 'Erro ao resetar senha'));
                            }
                          }}
                        ><KeyRound className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                          title="Remover da organização"
                          onClick={async () => {
                            const ok = await confirm({
                              title: `Remover ${m.full_name || 'usuário'} da organização?`,
                              destructive: true,
                              confirmText: 'Remover',
                            });
                            if (!ok) return;
                            removeMember.mutate({ organization_id: orgId, user_id: m.user_id }, {
                              onSuccess: () => toast.success('Removido'),
                              onError: () => toast.error('Erro ao remover'),
                            });
                          }}
                        ><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {members.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Nenhum membro</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <CreateUserWizard
        open={showCreate}
        onClose={() => setShowCreate(false)}
        orgId={orgId}
        departments={departments}
      />

      <Dialog open={!!resetResult} onOpenChange={(o) => !o && setResetResult(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova senha temporária</DialogTitle>
            <DialogDescription>
              Compartilhe esta senha com <strong>{resetResult?.name}</strong>. Ela poderá alterá-la depois.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <Input readOnly value={resetResult?.password ?? ''} className="font-mono" />
            <Button
              variant="outline"
              onClick={() => {
                if (resetResult?.password) {
                  navigator.clipboard.writeText(resetResult.password);
                  toast.success('Senha copiada');
                }
              }}
            >Copiar</Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setResetResult(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ----- Wizard de criação de usuário ----- */
function CreateUserWizard({
  open, onClose, orgId, departments,
}: {
  open: boolean;
  onClose: () => void;
  orgId: string;
  departments: { id: string; name: string }[];
}) {
  const createUser = useCreateOrgUser();
  const addDeptMember = useAddDepartmentMember();
  const updateAppRole = useUpdateAppRole();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [data, setData] = useState({
    full_name: '',
    email: '',
    password: '',
    org_role: 'member' as 'admin' | 'member',
    app_role: 'member' as AppRole,
    selectedDeptIds: [] as string[],
    primaryDeptId: '' as string,
  });

  const reset = () => {
    setStep(1);
    setData({
      full_name: '', email: '', password: '',
      org_role: 'member', app_role: 'member',
      selectedDeptIds: [], primaryDeptId: '',
    });
  };

  const close = () => { reset(); onClose(); };

  const canNext1 = data.email.trim() && data.password.trim();

  const toggleDept = (id: string) => {
    setData((d) => {
      const has = d.selectedDeptIds.includes(id);
      const next = has ? d.selectedDeptIds.filter((x) => x !== id) : [...d.selectedDeptIds, id];
      let primary = d.primaryDeptId;
      if (has && primary === id) primary = next[0] ?? '';
      if (!has && !primary) primary = id;
      return { ...d, selectedDeptIds: next, primaryDeptId: primary };
    });
  };

  const handleFinish = async () => {
    if (!data.email || !data.password) { toast.error('Email e senha obrigatórios'); return; }
    const primaryName = departments.find((d) => d.id === data.primaryDeptId)?.name;
    try {
      const res: any = await createUser.mutateAsync({
        email: data.email,
        password: data.password,
        full_name: data.full_name,
        organization_id: orgId,
        org_role: data.org_role,
        department: primaryName,
      });
      const newUserId = res?.user_id as string | undefined;
      if (newUserId) {
        // adiciona aos demais setores
        for (const deptId of data.selectedDeptIds) {
          try {
            await addDeptMember.mutateAsync({ department_id: deptId, user_id: newUserId, role: 'operator' });
          } catch { /* ignore duplicates */ }
        }
        // permissão de app
        if (data.app_role && data.app_role !== 'member') {
          try { await updateAppRole.mutateAsync({ user_id: newUserId, role: data.app_role }); } catch { /* ignore */ }
        }
      }
      toast.success('Usuário criado!');
      close();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Erro ao criar usuário'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo usuário</DialogTitle>
          <DialogDescription>
            Passo {step} de 3 — {step === 1 ? 'Dados básicos' : step === 2 ? 'Setores' : 'Permissão'}
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-2 mb-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`h-1.5 flex-1 rounded-full ${step >= s ? 'bg-primary' : 'bg-muted'}`} />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-3">
            <div><Label>Nome completo</Label><Input value={data.full_name} onChange={(e) => setData({ ...data, full_name: e.target.value })} placeholder="Ex.: Maria Silva" /></div>
            <div><Label>Email</Label><Input type="email" value={data.email} onChange={(e) => setData({ ...data, email: e.target.value })} placeholder="maria@empresa.com" /></div>
            <div><Label>Senha temporária</Label><Input type="text" value={data.password} onChange={(e) => setData({ ...data, password: e.target.value })} placeholder="Mínimo 6 caracteres" /></div>
            <p className="text-xs text-muted-foreground">A pessoa poderá alterar a senha depois pelo login.</p>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Selecione um ou mais setores. Marque um como principal.</p>
            <div className="border rounded-md divide-y max-h-72 overflow-y-auto">
              {departments.length === 0 && (
                <div className="px-3 py-6 text-center text-sm text-muted-foreground">Nenhum setor cadastrado</div>
              )}
              {departments.map((d) => {
                const checked = data.selectedDeptIds.includes(d.id);
                const isPrimary = data.primaryDeptId === d.id;
                return (
                  <div key={d.id} className="flex items-center gap-3 px-3 py-2">
                    <Checkbox checked={checked} onCheckedChange={() => toggleDept(d.id)} />
                    <span className="flex-1 text-sm">{d.name}</span>
                    {checked && (
                      <button
                        type="button"
                        onClick={() => setData({ ...data, primaryDeptId: d.id })}
                        className={`text-[10px] px-1.5 py-0.5 rounded ${isPrimary ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}
                      >
                        {isPrimary ? 'principal' : 'tornar principal'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <div>
              <Label>Papel na organização</Label>
              <Select value={data.org_role} onValueChange={(v: 'admin' | 'member') => setData({ ...data, org_role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Membro</SelectItem>
                  <SelectItem value="admin">Admin da organização</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1">Admin pode gerenciar usuários, setores e permissões desta organização.</p>
            </div>
            <div>
              <Label>Nível de permissão no sistema</Label>
              <Select value={data.app_role} onValueChange={(v: AppRole) => setData({ ...data, app_role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin (Master)</SelectItem>
                  <SelectItem value="director">Diretor</SelectItem>
                  <SelectItem value="manager">Gerente</SelectItem>
                  <SelectItem value="operator">Operador</SelectItem>
                  <SelectItem value="member">Membro</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1">Define o que a pessoa pode acessar dentro do sistema.</p>
            </div>
          </div>
        )}

        <DialogFooter className="flex sm:justify-between gap-2">
          <div>
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={close}>Cancelar</Button>
            {step < 3 ? (
              <Button
                onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}
                disabled={step === 1 ? !canNext1 : false}
              >
                Avançar <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleFinish} disabled={createUser.isPending}>
                Criar usuário
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ----- Setores ----- */
function DepartmentsTab({ orgId, canEdit }: { orgId: string; canEdit: boolean }) {
  const { data: departments = [] } = useDepartments(orgId);
  const createDept = useCreateDepartment();
  const deleteDept = useDeleteDepartment();

  const [newDept, setNewDept] = useState('');

  return (
    <div className="max-w-2xl">
      <section className="border rounded-lg p-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" /> Setores</h3>
        {canEdit && (
          <div className="flex gap-2 mb-3">
            <Input placeholder="Novo setor" value={newDept} onChange={(e) => setNewDept(e.target.value)} onKeyDown={(e) => {
              if (e.key === 'Enter' && newDept.trim()) {
                createDept.mutate({ organization_id: orgId, name: newDept.trim() }, {
                  onSuccess: () => setNewDept(''),
                  onError: () => toast.error('Setor já existe ou erro'),
                });
              }
            }} />
            <Button size="sm" onClick={() => {
              if (!newDept.trim()) return;
              createDept.mutate({ organization_id: orgId, name: newDept.trim() }, {
                onSuccess: () => setNewDept(''),
                onError: () => toast.error('Setor já existe ou erro'),
              });
            }}><Plus className="h-4 w-4" /></Button>
          </div>
        )}
        <ul className="space-y-1">
          {departments.map((d) => (
            <li key={d.id} className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-accent">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ background: d.color }} />
                <span className="text-sm">{d.name}</span>
              </div>
              {canEdit && (
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                  onClick={() => deleteDept.mutate(d.id, { onError: () => toast.error('Erro') })}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </li>
          ))}
          {departments.length === 0 && <li className="text-sm text-muted-foreground py-3 text-center">Nenhum setor</li>}
        </ul>
      </section>
    </div>
  );
}

/* ----- Permissões (app role) ----- */
function PermissionsTab({ orgId, canEdit }: { orgId: string; canEdit: boolean }) {
  const { data: members = [] } = useOrgMembersFull(orgId);
  const updateAppRole = useUpdateAppRole();
  const memberIds = members.map((m) => m.user_id);
  const { data: itSet } = useItSupportMembers(memberIds);
  const toggleIT = useToggleItSupport();

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-4">
        Defina o nível de permissão de cada usuário no sistema. <strong>Admin</strong> tem acesso total, <strong>Gerente</strong> pode gerenciar projetos e <strong>Membro</strong> tem acesso padrão. Ative <strong>Suporte TI</strong> para quem deve receber e atender tickets de TI.
      </p>
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left">
              <th className="px-4 py-2 font-medium">Usuário</th>
              <th className="px-4 py-2 font-medium">Permissão</th>
              <th className="px-4 py-2 font-medium">Suporte TI</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const initials = (m.full_name ?? '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
              const isIT = itSet?.has(m.user_id) ?? false;
              return (
                <tr key={m.user_id} className="border-t">
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7">
                        {m.avatar_url && <AvatarImage src={m.avatar_url} alt={m.full_name ?? ''} />}
                        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{m.full_name || 'Sem nome'}</span>
                      {m.org_role === 'admin' && <Badge variant="secondary" className="text-[10px]">Admin org</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <Select
                      disabled={!canEdit}
                      value={m.app_role}
                      onValueChange={(role: AppRole) => updateAppRole.mutate({ user_id: m.user_id, role }, {
                        onSuccess: () => toast.success('Permissão atualizada'),
                        onError: () => toast.error('Erro — apenas admins do sistema podem alterar'),
                      })}
                    >
                      <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin (Master)</SelectItem>
                        <SelectItem value="director">Diretor</SelectItem>
                        <SelectItem value="manager">Gerente</SelectItem>
                        <SelectItem value="operator">Operador</SelectItem>
                        <SelectItem value="member">Membro</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={isIT}
                        disabled={!canEdit || toggleIT.isPending}
                        onCheckedChange={(v) => toggleIT.mutate({ user_id: m.user_id, enable: v }, {
                          onSuccess: () => toast.success(v ? 'Adicionado ao Suporte TI' : 'Removido do Suporte TI'),
                          onError: (e: unknown) => toast.error(getErrorMessage(e, 'Erro')),
                        })}
                      />
                      {isIT && (
                        <Badge variant="outline" className="gap-1 text-[10px]">
                          <Wrench className="h-3 w-3" /> TI
                        </Badge>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ----- Emails ----- */
function EmailsTab() {
  const { currentOrg } = useOrganization();
  const [prefs, setPrefs] = useState({
    notify_on_assignment: true,
    notify_on_deadline: true,
    notify_on_mention: true,
    notify_directors: false,
  });
  const [loaded, setLoaded] = useState(false);

  // Load existing preferences
  useEffect(() => {
    if (!currentOrg) return;
    import('@/integrations/supabase/client').then(({ supabase }) => {
      supabase.auth.getUser().then(({ data: ud }) => {
        if (!ud?.user) return;
        supabase
          .from('email_preferences' as any)
          .select('*')
          .eq('user_id', ud.user.id)
          .eq('organization_id', currentOrg.id)
          .maybeSingle()
          .then(({ data }) => {
            if (data) {
              const d = data as Record<string, any>;
              setPrefs({
                notify_on_assignment: d.notify_on_assignment ?? true,
                notify_on_deadline: d.notify_on_deadline ?? true,
                notify_on_mention: d.notify_on_mention ?? true,
                notify_directors: d.notify_directors ?? false,
              });
            }
            setLoaded(true);
          });
      });
    });
  }, [currentOrg]);

  const savePrefs = async () => {
    const { supabase } = await import('@/integrations/supabase/client');
    const { data: ud } = await supabase.auth.getUser();
    if (!ud?.user || !currentOrg) return;
    const { error } = await supabase
      .from('email_preferences' as any)
      .upsert({
        user_id: ud.user.id,
        organization_id: currentOrg.id,
        ...prefs,
      } as any, { onConflict: 'organization_id,user_id' });
    if (error) toast.error('Erro ao salvar preferências');
    else toast.success('Preferências salvas');
  };

  return (
    <div className="max-w-2xl space-y-4">
      {/* Domain config info */}
      <div className="rounded-lg border bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 shrink-0">
            <Mail className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold">Domínio de envio</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Configure um domínio próprio (ex.: <code className="text-xs bg-muted px-1 py-0.5 rounded">notify.suaempresa.com</code>) para que os e-mails do sistema sejam enviados com a identidade da sua marca.
            </p>
            <p className="text-xs text-muted-foreground mt-3 bg-muted/40 rounded p-2">
              Para ativar, configure as secrets <code className="text-[10px]">RESEND_API_KEY</code> e <code className="text-[10px]">EMAIL_FROM</code> no Supabase, e aponte os registros DNS sugeridos pelo Resend.
            </p>
          </div>
        </div>
      </div>

      {/* Email preference toggles */}
      <div className="rounded-lg border bg-card p-5 space-y-4">
        <h3 className="font-semibold">Preferências de notificação por e-mail</h3>
        <p className="text-sm text-muted-foreground">
          Escolha quais notificações você deseja receber por e-mail além das notificações no app.
        </p>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Atribuições</p>
              <p className="text-xs text-muted-foreground">Quando um pedido, tarefa ou etapa for atribuída a você</p>
            </div>
            <Switch
              checked={prefs.notify_on_assignment}
              onCheckedChange={(v) => setPrefs(p => ({ ...p, notify_on_assignment: v }))}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Prazos</p>
              <p className="text-xs text-muted-foreground">Quando um prazo estiver vencendo (24h) ou vencido</p>
            </div>
            <Switch
              checked={prefs.notify_on_deadline}
              onCheckedChange={(v) => setPrefs(p => ({ ...p, notify_on_deadline: v }))}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Menções</p>
              <p className="text-xs text-muted-foreground">Quando alguém mencionar você em comentários</p>
            </div>
            <Switch
              checked={prefs.notify_on_mention}
              onCheckedChange={(v) => setPrefs(p => ({ ...p, notify_on_mention: v }))}
            />
          </div>

          <hr className="border-border" />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Cópia para diretores</p>
              <p className="text-xs text-muted-foreground">Enviar cópia dos seus e-mails para os administradores da organização</p>
            </div>
            <Switch
              checked={prefs.notify_directors}
              onCheckedChange={(v) => setPrefs(p => ({ ...p, notify_directors: v }))}
            />
          </div>
        </div>

        <Button onClick={savePrefs} className="mt-2">Salvar preferências</Button>
      </div>

      <div className="rounded-lg border p-4 text-sm text-muted-foreground bg-muted/30">
        <p className="font-medium text-foreground mb-1">Tipos de e-mail enviados:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Pedido atribuído ou com novo comentário</li>
          <li>Etapa de lançamento pronta para você</li>
          <li>Item de checklist atribuído</li>
          <li>Prazo vencendo em 24h ou vencido</li>
          <li>Ticket com atualização de status</li>
        </ul>
      </div>
    </div>
  );
}

/* ----- Equipes de setor (gerentes/operadores multi-setor) ----- */
function DepartmentTeamsTab({ orgId, canEdit }: { orgId: string; canEdit: boolean }) {
  const { data: departments = [] } = useDepartments(orgId);
  const { data: members = [] } = useOrgMembersFull(orgId);
  const { data: deptMembers = [] } = useDepartmentMembers(orgId);
  const addMember = useAddDepartmentMember();
  const updateRole = useUpdateDepartmentMemberRole();
  const removeMember = useRemoveDepartmentMember();

  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [addUser, setAddUser] = useState('');
  const [addRole, setAddRole] = useState<'manager' | 'operator'>('operator');

  const activeDept = selectedDept ?? departments[0]?.id ?? null;
  const rows = deptMembers.filter((dm) => dm.department_id === activeDept);
  const memberMap = new Map(members.map((m) => [m.user_id, m]));
  const available = members.filter((m) => !rows.some((r) => r.user_id === m.user_id));

  return (
    <div className="grid md:grid-cols-[240px_1fr] gap-4">
      <aside className="border rounded-lg p-2 max-h-[60vh] overflow-y-auto">
        <p className="px-2 py-1.5 text-xs uppercase text-muted-foreground font-medium">Setores</p>
        <ul className="space-y-0.5">
          {departments.map((d) => (
            <li key={d.id}>
              <button
                onClick={() => setSelectedDept(d.id)}
                className={`w-full text-left px-2 py-1.5 rounded text-sm flex items-center gap-2 ${activeDept === d.id ? 'bg-accent' : 'hover:bg-accent/50'}`}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                {d.name}
                <Badge variant="secondary" className="ml-auto text-[10px]">
                  {deptMembers.filter((dm) => dm.department_id === d.id).length}
                </Badge>
              </button>
            </li>
          ))}
          {departments.length === 0 && <li className="text-xs text-muted-foreground p-2 text-center">Nenhum setor</li>}
        </ul>
      </aside>

      <section className="border rounded-lg p-4">
        {!activeDept ? (
          <p className="text-sm text-muted-foreground text-center py-8">Crie um setor primeiro.</p>
        ) : (
          <>
            <div className="mb-4">
              <h3 className="font-semibold mb-1">{departments.find((d) => d.id === activeDept)?.name}</h3>
              <p className="text-xs text-muted-foreground">Gerentes podem coordenar o setor. Operadores atuam nele. Uma pessoa pode estar em vários setores.</p>
            </div>

            {canEdit && (
              <div className="flex flex-col sm:flex-row gap-2 mb-4 p-3 bg-muted/30 rounded-md">
                <Select value={addUser} onValueChange={setAddUser}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Selecionar pessoa" /></SelectTrigger>
                  <SelectContent>
                    {available.map((m) => (
                      <SelectItem key={m.user_id} value={m.user_id}>{m.full_name || m.user_id.slice(0, 8)}</SelectItem>
                    ))}
                    {available.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">Todos já adicionados</div>}
                  </SelectContent>
                </Select>
                <Select value={addRole} onValueChange={(v: 'manager' | 'operator') => setAddRole(v)}>
                  <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manager">Gerente</SelectItem>
                    <SelectItem value="operator">Operador</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  disabled={!addUser || !activeDept}
                  onClick={() => {
                    if (!addUser || !activeDept) return;
                    addMember.mutate(
                      { department_id: activeDept, user_id: addUser, role: addRole },
                      {
                        onSuccess: () => { toast.success('Adicionado'); setAddUser(''); },
                          onError: (error: unknown) => toast.error(getErrorMessage(error, 'Erro')),
                      },
                    );
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" /> Adicionar
                </Button>
              </div>
            )}

            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-medium">Pessoa</th>
                    <th className="px-3 py-2 font-medium">Papel no setor</th>
                    <th className="px-3 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const p = memberMap.get(r.user_id);
                    const initials = (p?.full_name ?? '?').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
                    return (
                      <tr key={r.id} className="border-t">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7">
                              {p?.avatar_url && <AvatarImage src={p.avatar_url} alt="" />}
                              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                            </Avatar>
                            <span>{p?.full_name || 'Sem nome'}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <Select
                            disabled={!canEdit}
                            value={r.role}
                            onValueChange={(v: 'manager' | 'operator') => updateRole.mutate({ id: r.id, role: v }, {
                              onSuccess: () => toast.success('Atualizado'),
                              onError: () => toast.error('Erro'),
                            })}
                          >
                            <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="manager">Gerente</SelectItem>
                              <SelectItem value="operator">Operador</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-3 py-2">
                          {canEdit && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                              onClick={() => removeMember.mutate(r.id, {
                                onSuccess: () => toast.success('Removido'),
                                onError: () => toast.error('Erro'),
                              })}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && (
                    <tr><td colSpan={3} className="px-3 py-6 text-center text-muted-foreground text-sm">Nenhuma pessoa atribuída</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
