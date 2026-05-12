import { useState } from 'react';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  useDepartments,
  usePositions,
  useCreateDepartment,
  useDeleteDepartment,
  useCreatePosition,
  useDeletePosition,
  useOrgMembersFull,
  useUpdateMemberProfile,
  useUpdateOrgRole,
  useUpdateAppRole,
  useRemoveOrgMember,
  useCreateOrgUser,
} from '@/hooks/useOrgSettings';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Trash2, Plus, UserPlus, Shield, Users as UsersIcon, Building2, Settings as SettingsIcon, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';
import { ProfileTab } from '@/components/settings/ProfileTab';

export default function SettingsPage() {
  const { currentOrg, isAdmin } = useOrganization();

  if (!currentOrg) {
    return <div className="flex items-center justify-center h-full text-muted-foreground">Selecione uma organização</div>;
  }

  return (
    <div className="container max-w-6xl mx-auto py-6 sm:py-8 px-3 sm:px-4">
      <div className="mb-6 flex items-center gap-3">
        <SettingsIcon className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Configurações</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">{currentOrg.name}</p>
        </div>
      </div>

      {!isAdmin && (
        <div className="mb-4 p-3 bg-muted rounded-md text-sm text-muted-foreground">
          Você está em modo somente leitura. Apenas administradores podem editar usuários, setores e permissões.
        </div>
      )}

      <Tabs defaultValue="profile">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="profile"><UserIcon className="h-4 w-4 mr-2" />Meu perfil</TabsTrigger>
          {isAdmin && <TabsTrigger value="users"><UsersIcon className="h-4 w-4 mr-2" />Usuários</TabsTrigger>}
          {isAdmin && <TabsTrigger value="departments"><Building2 className="h-4 w-4 mr-2" />Setores & Cargos</TabsTrigger>}
          {isAdmin && <TabsTrigger value="permissions"><Shield className="h-4 w-4 mr-2" />Permissões</TabsTrigger>}
        </TabsList>

        <TabsContent value="profile" className="mt-6">
          <ProfileTab />
        </TabsContent>
        {isAdmin && (
          <>
            <TabsContent value="users" className="mt-6">
              <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
                <UsersTab orgId={currentOrg.id} canEdit={isAdmin} />
              </div>
            </TabsContent>
            <TabsContent value="departments" className="mt-6">
              <DepartmentsTab orgId={currentOrg.id} canEdit={isAdmin} />
            </TabsContent>
            <TabsContent value="permissions" className="mt-6">
              <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
                <PermissionsTab orgId={currentOrg.id} canEdit={isAdmin} />
              </div>
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
  const { data: positions = [] } = usePositions(orgId);
  const updateProfile = useUpdateMemberProfile();
  const updateOrgRole = useUpdateOrgRole();
  const removeMember = useRemoveOrgMember();
  const createUser = useCreateOrgUser();

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    email: '', password: '', full_name: '',
    department: '', position: '', org_role: 'member' as 'admin' | 'member',
  });

  const handleCreate = () => {
    if (!form.email || !form.password) { toast.error('Email e senha obrigatórios'); return; }
    createUser.mutate(
      { ...form, organization_id: orgId, department: form.department || undefined, position: form.position || undefined },
      {
        onSuccess: () => { toast.success('Usuário criado!'); setShowCreate(false); setForm({ email: '', password: '', full_name: '', department: '', position: '', org_role: 'member' }); },
        onError: (e: any) => toast.error(e?.message ?? 'Erro ao criar usuário'),
      }
    );
  };

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
              <th className="px-4 py-2 font-medium">Setor</th>
              <th className="px-4 py-2 font-medium">Cargo</th>
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
                      <Avatar className="h-7 w-7"><AvatarFallback className="text-xs">{initials}</AvatarFallback></Avatar>
                      <div className="font-medium">{m.full_name || 'Sem nome'}</div>
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <Select
                      disabled={!canEdit}
                      value={m.department ?? '__none__'}
                      onValueChange={(v) => updateProfile.mutate({ user_id: m.user_id, department: v === '__none__' ? null : v })}
                    >
                      <SelectTrigger className="h-8 w-40"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">—</SelectItem>
                        {departments.map((d) => (
                          <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-2">
                    <Select
                      disabled={!canEdit}
                      value={m.position ?? '__none__'}
                      onValueChange={(v) => updateProfile.mutate({ user_id: m.user_id, position: v === '__none__' ? null : v })}
                    >
                      <SelectTrigger className="h-8 w-40"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">—</SelectItem>
                        {positions.map((p) => (
                          <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                        onClick={() => {
                          if (!confirm(`Remover ${m.full_name || 'usuário'} da organização?`)) return;
                          removeMember.mutate({ organization_id: orgId, user_id: m.user_id }, {
                            onSuccess: () => toast.success('Removido'),
                            onError: () => toast.error('Erro ao remover'),
                          });
                        }}
                      ><Trash2 className="h-4 w-4" /></Button>
                    )}
                  </td>
                </tr>
              );
            })}
            {members.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Nenhum membro</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo usuário</DialogTitle>
            <DialogDescription>O usuário será criado já confirmado e adicionado a esta organização.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome completo</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Senha temporária</Label><Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Setor</Label>
                <Select value={form.department || '__none__'} onValueChange={(v) => setForm({ ...form, department: v === '__none__' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {departments.map((d) => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Cargo</Label>
                <Select value={form.position || '__none__'} onValueChange={(v) => setForm({ ...form, position: v === '__none__' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {positions.map((p) => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Papel na organização</Label>
              <Select value={form.org_role} onValueChange={(v: 'admin' | 'member') => setForm({ ...form, org_role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Membro</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createUser.isPending}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ----- Setores e Cargos ----- */
function DepartmentsTab({ orgId, canEdit }: { orgId: string; canEdit: boolean }) {
  const { data: departments = [] } = useDepartments(orgId);
  const { data: positions = [] } = usePositions(orgId);
  const createDept = useCreateDepartment();
  const deleteDept = useDeleteDepartment();
  const createPos = useCreatePosition();
  const deletePos = useDeletePosition();

  const [newDept, setNewDept] = useState('');
  const [newPos, setNewPos] = useState('');

  return (
    <div className="grid md:grid-cols-2 gap-6">
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

      <section className="border rounded-lg p-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2"><UsersIcon className="h-4 w-4 text-primary" /> Cargos</h3>
        {canEdit && (
          <div className="flex gap-2 mb-3">
            <Input placeholder="Novo cargo" value={newPos} onChange={(e) => setNewPos(e.target.value)} onKeyDown={(e) => {
              if (e.key === 'Enter' && newPos.trim()) {
                createPos.mutate({ organization_id: orgId, name: newPos.trim() }, {
                  onSuccess: () => setNewPos(''),
                  onError: () => toast.error('Cargo já existe ou erro'),
                });
              }
            }} />
            <Button size="sm" onClick={() => {
              if (!newPos.trim()) return;
              createPos.mutate({ organization_id: orgId, name: newPos.trim() }, {
                onSuccess: () => setNewPos(''),
                onError: () => toast.error('Cargo já existe ou erro'),
              });
            }}><Plus className="h-4 w-4" /></Button>
          </div>
        )}
        <ul className="space-y-1">
          {positions.map((p) => (
            <li key={p.id} className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-accent">
              <span className="text-sm">{p.name}</span>
              {canEdit && (
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                  onClick={() => deletePos.mutate(p.id, { onError: () => toast.error('Erro') })}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </li>
          ))}
          {positions.length === 0 && <li className="text-sm text-muted-foreground py-3 text-center">Nenhum cargo</li>}
        </ul>
      </section>
    </div>
  );
}

/* ----- Permissões (app role) ----- */
function PermissionsTab({ orgId, canEdit }: { orgId: string; canEdit: boolean }) {
  const { data: members = [] } = useOrgMembersFull(orgId);
  const updateAppRole = useUpdateAppRole();

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-4">
        Defina o nível de permissão de cada usuário no sistema. <strong>Admin</strong> tem acesso total, <strong>Manager</strong> pode gerenciar projetos e <strong>Member</strong> tem acesso padrão.
      </p>
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left">
              <th className="px-4 py-2 font-medium">Usuário</th>
              <th className="px-4 py-2 font-medium">Cargo</th>
              <th className="px-4 py-2 font-medium">Permissão</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const initials = (m.full_name ?? '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
              return (
                <tr key={m.user_id} className="border-t">
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7"><AvatarFallback className="text-xs">{initials}</AvatarFallback></Avatar>
                      <span className="font-medium">{m.full_name || 'Sem nome'}</span>
                      {m.org_role === 'admin' && <Badge variant="secondary" className="text-[10px]">Admin org</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{m.position || '—'}</td>
                  <td className="px-4 py-2">
                    <Select
                      disabled={!canEdit}
                      value={m.app_role}
                      onValueChange={(v: 'admin' | 'manager' | 'member') => updateAppRole.mutate({ user_id: m.user_id, role: v }, {
                        onSuccess: () => toast.success('Permissão atualizada'),
                        onError: () => toast.error('Erro — apenas admins do sistema podem alterar'),
                      })}
                    >
                      <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="member">Member</SelectItem>
                      </SelectContent>
                    </Select>
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
