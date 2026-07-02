import { useEffect, useState } from 'react';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  useDepartments,
  useCreateDepartment,
  useDeleteDepartment,
  useOrgMembersFull,
  useUpdateMemberProfile,
  useUpdateOrgRole,
  useUpdateOrgMemberStatus,
  useUpdateAppRole,
  useRemoveOrgMember,
  useDeleteOrgUser,
  useCreateOrgUser,
  useDepartmentMembers,
  useAddDepartmentMember,
  useUpdateDepartmentMemberRole,
  useRemoveDepartmentMember,
  useItSupportMembers,
  useToggleItSupport,
  useResetUserPassword,
  useResendOrgInvite,
  useUpdateOrgMemberAccess,
} from '@/hooks/useOrgSettings';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { Trash2, Plus, UserPlus, Shield, Users as UsersIcon, Building2, Settings as SettingsIcon, User as UserIcon, Check, ChevronDown, Mail, ArrowLeft, ArrowRight, KeyRound, Wrench, Pencil, Lock, UserCheck, UserX, Send, CalendarClock } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';

import { toast } from 'sonner';
import { ProfileTab, ModuleAccessTab } from '@/features/settings';
import { useConfirm } from '@/components/ConfirmDialog';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { writePermissionAudit } from '@/hooks/usePermissionAudit';

function OrgLogoUploader() {
  const { currentOrg } = useOrganization();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  if (!currentOrg) return null;

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Envie um arquivo de imagem');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Máx. 2MB');
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const path = `org-logos/${currentOrg.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
      const { error: updErr } = await supabase
        .from('organizations')
        .update({ logo_url: pub.publicUrl } as any)
        .eq('id', currentOrg.id);
      if (updErr) throw updErr;
      await qc.invalidateQueries({ queryKey: ['organizations'] });
      toast.success('Logo atualizada');
    } catch (e) {
      toast.error(getErrorMessage(e, 'Falha ao enviar logo'));
    } finally {
      setUploading(false);
    }
  };

  const removeLogo = async () => {
    try {
      const { error } = await supabase
        .from('organizations')
        .update({ logo_url: null } as any)
        .eq('id', currentOrg.id);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ['organizations'] });
      toast.success('Logo removida');
    } catch (e) {
      toast.error(getErrorMessage(e, 'Falha ao remover'));
    }
  };

  return (
    <div className="flex items-center gap-2">
      {currentOrg.logo_url && (
        <img
          src={currentOrg.logo_url}
          alt={currentOrg.name}
          className="h-10 w-10 rounded-md object-cover border"
        />
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = '';
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={uploading}
        onClick={() => fileRef.current?.click()}
      >
        {uploading ? 'Enviando…' : currentOrg.logo_url ? 'Trocar logo' : 'Enviar logo'}
      </Button>
      {currentOrg.logo_url && (
        <Button type="button" variant="ghost" size="sm" onClick={removeLogo}>
          Remover
        </Button>
      )}
    </div>
  );
}

type AppRole = 'admin' | 'manager' | 'member' | 'director' | 'operator';
type UserStatusFilter = 'all' | 'active' | 'pending_invite' | 'invite_expired' | 'access_expiring' | 'access_expired' | 'suspended' | 'with_risk';
type UserRoleFilter = 'all' | 'admin' | 'director' | 'manager' | 'operator' | 'member';
type UserRiskFilter = 'all' | 'danger' | 'warning' | 'info' | 'none';
type UserSortKey = 'risk' | 'name' | 'status' | 'role' | 'department' | 'last_seen' | 'access';

const APP_ROLE_LABELS: Record<AppRole, string> = {
  admin: 'Admin',
  director: 'Diretor',
  manager: 'Manager',
  operator: 'Operador',
  member: 'Membro',
};

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const auditPermissionChange = (input: Parameters<typeof writePermissionAudit>[0]) => {
  void writePermissionAudit(input).catch((error) => console.warn('Permission audit write failed', error));
};

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
        <TabsList className="grid h-auto w-full grid-cols-1 gap-1 rounded-lg bg-muted/60 p-1 sm:grid-cols-2 lg:grid-cols-7">
          <TabsTrigger value="profile" className="justify-start gap-2 px-3 py-2"><UserIcon className="h-4 w-4" />Meu perfil</TabsTrigger>
          {isAdmin && <TabsTrigger value="users" className="justify-start gap-2 px-3 py-2"><UsersIcon className="h-4 w-4" />Usuários</TabsTrigger>}
          {isAdmin && <TabsTrigger value="departments" className="justify-start gap-2 px-3 py-2"><Building2 className="h-4 w-4" />Setores</TabsTrigger>}
          {isAdmin && <TabsTrigger value="teams" className="justify-start gap-2 px-3 py-2"><UsersIcon className="h-4 w-4" />Equipes de setor</TabsTrigger>}
          {isAdmin && <TabsTrigger value="permissions" className="justify-start gap-2 px-3 py-2"><Shield className="h-4 w-4" />Permissões</TabsTrigger>}
          {isAdmin && <TabsTrigger value="access" className="justify-start gap-2 px-3 py-2"><Lock className="h-4 w-4" />Liberações</TabsTrigger>}
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
            <TabsContent value="access" className="mt-0">
              <ModuleAccessTab orgId={currentOrg.id} canEdit={isAdmin} />
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
  const { user } = useAuth();
  const { data: members = [] } = useOrgMembersFull(orgId);
  const { data: departments = [] } = useDepartments(orgId);
  const { data: deptMembers = [] } = useDepartmentMembers(orgId);
  const addDeptMember = useAddDepartmentMember();
  const removeDeptMember = useRemoveDepartmentMember();
  const updateProfile = useUpdateMemberProfile();
  const updateOrgRole = useUpdateOrgRole();
  const updateMemberStatus = useUpdateOrgMemberStatus();
  const removeMember = useRemoveOrgMember();
  const deleteUser = useDeleteOrgUser();
  const resetPassword = useResetUserPassword();
  const resendInvite = useResendOrgInvite();
  const updateAccess = useUpdateOrgMemberAccess();
  const confirm = useConfirm();

  const [showCreate, setShowCreate] = useState(false);
  const [resetTarget, setResetTarget] = useState<{ userId: string; name: string } | null>(null);
  const [editTarget, setEditTarget] = useState<{ userId: string; name: string } | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<{
    userId: string;
    name: string;
    orgRole: string;
    appRole: string;
    status: string;
  } | null>(null);
  const [accessTarget, setAccessTarget] = useState<{
    userId: string;
    name: string;
    currentExpiresAt: string | null;
  } | null>(null);
  const [editName, setEditName] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [suspendReason, setSuspendReason] = useState('');
  const [blockAuth, setBlockAuth] = useState(false);
  const [accessDate, setAccessDate] = useState('');
  const [bulkResending, setBulkResending] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<UserStatusFilter>('all');
  const [roleFilter, setRoleFilter] = useState<UserRoleFilter>('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState<UserRiskFilter>('all');
  const [sortBy, setSortBy] = useState<UserSortKey>('risk');

  const openEditUser = (userId: string, fullName: string | null) => {
    setEditTarget({ userId, name: fullName || '' });
    setEditName(fullName || '');
  };

  const dateInputValue = (value: string | null) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
  };

  const nowMs = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const activeAdminCount = members.filter((member) => {
    if (member.org_role !== 'admin' || member.status !== 'active') return false;
    return !member.access_expires_at || new Date(member.access_expires_at).getTime() > nowMs;
  }).length;
  const pendingInviteMembers = members.filter((member) =>
    member.status !== 'suspended' && !!member.invited_at && !member.invite_accepted_at,
  );
  const expiredInviteMembers = pendingInviteMembers.filter((member) =>
    !!member.invite_expires_at && new Date(member.invite_expires_at).getTime() < nowMs,
  );
  const accessExpiredMembers = members.filter((member) =>
    member.status === 'active' && !!member.access_expires_at && new Date(member.access_expires_at).getTime() <= nowMs,
  );
  const accessExpiringSoonMembers = members.filter((member) => {
    if (member.status !== 'active' || !member.access_expires_at) return false;
    const expiresAt = new Date(member.access_expires_at).getTime();
    return expiresAt > nowMs && expiresAt <= nowMs + weekMs;
  });
  const deptCountByUser = new Map<string, number>();
  deptMembers.forEach((deptMember) => {
    deptCountByUser.set(deptMember.user_id, (deptCountByUser.get(deptMember.user_id) || 0) + 1);
  });
  const getTime = (value: string | null) => {
    if (!value) return null;
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? null : time;
  };
  const getMemberDeptIds = (userId: string) =>
    deptMembers.filter((deptMember) => deptMember.user_id === userId).map((deptMember) => deptMember.department_id);
  const getMemberDeptNames = (userId: string) => {
    const userDeptIds = getMemberDeptIds(userId);
    return departments.filter((department) => userDeptIds.includes(department.id)).map((department) => department.name);
  };
  const getMemberStatusKey = (member: (typeof members)[number]): Exclude<UserStatusFilter, 'all' | 'with_risk'> => {
    const accessMs = getTime(member.access_expires_at);
    const inviteMs = getTime(member.invite_expires_at);
    const hasPendingInvite = member.status !== 'suspended' && !!member.invited_at && !member.invite_accepted_at;

    if (member.status === 'suspended') return 'suspended';
    if (accessMs !== null && accessMs <= nowMs) return 'access_expired';
    if (hasPendingInvite && inviteMs !== null && inviteMs < nowMs) return 'invite_expired';
    if (hasPendingInvite) return 'pending_invite';
    if (accessMs !== null && accessMs > nowMs && accessMs <= nowMs + weekMs) return 'access_expiring';
    return 'active';
  };
  const allUserRiskRows = members.map((member) => {
    const risks: Array<{ label: string; tone: 'danger' | 'warning' | 'info' }> = [];
    const memberAccessMs = getTime(member.access_expires_at);
    const memberInviteExpired = getTime(member.invite_expires_at) !== null && getTime(member.invite_expires_at)! < nowMs;
    const memberAccessExpired = memberAccessMs !== null && memberAccessMs <= nowMs;
    const memberAccessSoon = memberAccessMs !== null && memberAccessMs > nowMs && memberAccessMs <= nowMs + weekMs;
    const memberPendingInvite = member.status !== 'suspended' && !!member.invited_at && !member.invite_accepted_at;

    if (memberPendingInvite) risks.push({ label: memberInviteExpired ? 'convite vencido' : 'convite pendente', tone: memberInviteExpired ? 'danger' : 'warning' });
    if (memberAccessExpired) risks.push({ label: 'acesso expirado', tone: 'danger' });
    else if (memberAccessSoon) risks.push({ label: 'acesso vence em breve', tone: 'warning' });
    if (member.status === 'active' && member.org_role !== 'admin' && (deptCountByUser.get(member.user_id) || 0) === 0) {
      risks.push({ label: 'sem camada/setor', tone: 'warning' });
    }
    if (member.status === 'suspended' && !member.auth_blocked_at) risks.push({ label: 'suspenso sem bloqueio global', tone: 'info' });

    return { member, risks };
  });
  const riskByUser = new Map(allUserRiskRows.map((row) => [row.member.user_id, row.risks]));
  const riskToneRank = { danger: 3, warning: 2, info: 1 } as const;
  const getRiskScore = (userId: string) =>
    Math.max(0, ...(riskByUser.get(userId) ?? []).map((risk) => riskToneRank[risk.tone]));
  const getDisplayName = (member: (typeof members)[number]) =>
    (member.full_name || member.email || 'Usuario').toLocaleLowerCase('pt-BR');
  const statusSortRank: Record<Exclude<UserStatusFilter, 'all' | 'with_risk'>, number> = {
    access_expired: 0,
    invite_expired: 1,
    pending_invite: 2,
    access_expiring: 3,
    suspended: 4,
    active: 5,
  };
  const roleSortRank: Record<UserRoleFilter, number> = {
    admin: 0,
    director: 1,
    manager: 2,
    operator: 3,
    member: 4,
    all: 5,
  };
  const visibleMembers = members
    .filter((member) => {
      const risks = riskByUser.get(member.user_id) ?? [];
      const statusKey = getMemberStatusKey(member);
      const search = userSearch.trim().toLocaleLowerCase('pt-BR');
      const deptIds = getMemberDeptIds(member.user_id);
      const deptNames = getMemberDeptNames(member.user_id);
      const matchesSearch = !search || [
        member.full_name,
        member.email,
        member.department,
        member.org_role,
        member.app_role,
        ...deptNames,
      ].some((value) => (value || '').toLocaleLowerCase('pt-BR').includes(search));
      const matchesStatus =
        statusFilter === 'all'
        || (statusFilter === 'with_risk' ? risks.length > 0 : statusKey === statusFilter);
      const matchesRole =
        roleFilter === 'all' || member.org_role === roleFilter || member.app_role === roleFilter;
      const matchesDepartment =
        departmentFilter === 'all'
        || (departmentFilter === 'none' ? deptIds.length === 0 : deptIds.includes(departmentFilter));
      const matchesRisk =
        riskFilter === 'all'
        || (riskFilter === 'none' ? risks.length === 0 : risks.some((risk) => risk.tone === riskFilter));
      return matchesSearch && matchesStatus && matchesRole && matchesDepartment && matchesRisk;
    })
    .sort((a, b) => {
      const nameCompare = getDisplayName(a).localeCompare(getDisplayName(b), 'pt-BR');
      if (sortBy === 'risk') return getRiskScore(b.user_id) - getRiskScore(a.user_id) || statusSortRank[getMemberStatusKey(a)] - statusSortRank[getMemberStatusKey(b)] || nameCompare;
      if (sortBy === 'status') return statusSortRank[getMemberStatusKey(a)] - statusSortRank[getMemberStatusKey(b)] || getRiskScore(b.user_id) - getRiskScore(a.user_id) || nameCompare;
      if (sortBy === 'role') return roleSortRank[a.app_role] - roleSortRank[b.app_role] || nameCompare;
      if (sortBy === 'department') return getMemberDeptNames(a.user_id).join(', ').localeCompare(getMemberDeptNames(b.user_id).join(', '), 'pt-BR') || nameCompare;
      if (sortBy === 'last_seen') return (getTime(b.last_seen_at) || 0) - (getTime(a.last_seen_at) || 0) || nameCompare;
      if (sortBy === 'access') return (getTime(a.access_expires_at) || Number.MAX_SAFE_INTEGER) - (getTime(b.access_expires_at) || Number.MAX_SAFE_INTEGER) || nameCompare;
      return nameCompare;
    });
  const userRiskRows = allUserRiskRows.filter((row) => row.risks.length > 0);
  const hasActiveUserFilters =
    !!userSearch.trim()
    || statusFilter !== 'all'
    || roleFilter !== 'all'
    || departmentFilter !== 'all'
    || riskFilter !== 'all'
    || sortBy !== 'risk';
  const resetUserFilters = () => {
    setUserSearch('');
    setStatusFilter('all');
    setRoleFilter('all');
    setDepartmentFilter('all');
    setRiskFilter('all');
    setSortBy('risk');
  };

  const handleBulkResendInvites = async () => {
    if (pendingInviteMembers.length === 0) return;
    setBulkResending(true);
    let sent = 0;
    let failed = 0;
    try {
      for (const member of pendingInviteMembers) {
        try {
          const result = await resendInvite.mutateAsync({
            organization_id: orgId,
            user_id: member.user_id,
            redirect_to: `${window.location.origin}/login`,
          });
          sent += 1;
          auditPermissionChange({
            organization_id: orgId,
            target_user_id: member.user_id,
            entity_type: 'organization_user',
            entity_id: member.user_id,
            action: 'resend_invite_bulk',
            before_state: { invite_last_sent_at: member.invite_last_sent_at, invite_expires_at: member.invite_expires_at },
            after_state: { invite_expires_at: result.invite_expires_at },
            metadata: { method: result.method },
          });
        } catch (error) {
          failed += 1;
          console.warn('Bulk invite resend failed', error);
        }
      }
      if (sent) toast.success(`${sent} convite${sent > 1 ? 's' : ''} reenviado${sent > 1 ? 's' : ''}`);
      if (failed) toast.error(`${failed} convite${failed > 1 ? 's' : ''} nao foi${failed > 1 ? 'ram' : ''} reenviado${failed > 1 ? 's' : ''}`);
    } finally {
      setBulkResending(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 text-xs">
          {expiredInviteMembers.length > 0 && (
            <Badge variant="outline" className="border-destructive/40 text-destructive">
              {expiredInviteMembers.length} convite{expiredInviteMembers.length > 1 ? 's' : ''} vencido{expiredInviteMembers.length > 1 ? 's' : ''}
            </Badge>
          )}
          {accessExpiringSoonMembers.length > 0 && (
            <Badge variant="outline" className="border-amber-500/60 text-amber-700">
              {accessExpiringSoonMembers.length} acesso{accessExpiringSoonMembers.length > 1 ? 's' : ''} vence{accessExpiringSoonMembers.length > 1 ? 'm' : ''} em 7 dias
            </Badge>
          )}
          {accessExpiredMembers.length > 0 && (
            <Badge variant="destructive">
              {accessExpiredMembers.length} acesso{accessExpiredMembers.length > 1 ? 's' : ''} expirado{accessExpiredMembers.length > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        {canEdit && (
          <div className="flex flex-wrap justify-end gap-2">
            {pendingInviteMembers.length > 0 && (
              <Button
                variant="outline"
                disabled={bulkResending || resendInvite.isPending}
                onClick={handleBulkResendInvites}
              >
                <Send className="h-4 w-4 mr-2" />
                Reenviar pendentes ({pendingInviteMembers.length})
              </Button>
            )}
            <Button onClick={() => setShowCreate(true)}><UserPlus className="h-4 w-4 mr-2" />Novo usuário</Button>
          </div>
        )}
      </div>

      {userRiskRows.length > 0 && (
        <div className="mb-4 rounded-lg border bg-card p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">Checklist de usuarios</p>
              <p className="text-xs text-muted-foreground">Pontos que merecem ajuste em convite, validade, camada ou bloqueio.</p>
            </div>
            <Badge variant="outline" className="text-[10px]">
              {userRiskRows.length} pessoa{userRiskRows.length === 1 ? '' : 's'}
            </Badge>
          </div>
          <div className="divide-y rounded-md border">
            {userRiskRows.slice(0, 6).map(({ member, risks }) => {
              const memberPendingInvite = member.status !== 'suspended' && !!member.invited_at && !member.invite_accepted_at;
              return (
                <div key={member.user_id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                  <span className="min-w-[160px] flex-1 font-medium">{member.full_name || member.email || 'Usuario'}</span>
                  <div className="flex flex-wrap gap-1">
                    {risks.map((risk) => (
                      <Badge
                        key={risk.label}
                        variant={risk.tone === 'danger' ? 'destructive' : 'outline'}
                        className={`text-[10px] ${risk.tone === 'warning' ? 'border-amber-500/60 text-amber-700' : ''}`}
                      >
                        {risk.label}
                      </Badge>
                    ))}
                  </div>
                  {canEdit && (
                    <div className="ml-auto flex items-center gap-1">
                      {memberPendingInvite && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1.5"
                          disabled={resendInvite.isPending}
                          onClick={() => {
                            resendInvite.mutate(
                              { organization_id: orgId, user_id: member.user_id, redirect_to: `${window.location.origin}/login` },
                              {
                                onSuccess: (result) => {
                                  auditPermissionChange({
                                    organization_id: orgId,
                                    target_user_id: member.user_id,
                                    entity_type: 'organization_user',
                                    entity_id: member.user_id,
                                    action: 'resend_invite',
                                    before_state: { invite_last_sent_at: member.invite_last_sent_at, invite_expires_at: member.invite_expires_at },
                                    after_state: { invite_expires_at: result.invite_expires_at },
                                    metadata: { method: result.method, source: 'user_checklist' },
                                  });
                                  toast.success('Convite reenviado');
                                },
                                onError: (e: unknown) => toast.error(getErrorMessage(e, 'Erro ao reenviar convite')),
                              },
                            );
                          }}
                        >
                          <Send className="h-3.5 w-3.5" /> Reenviar
                        </Button>
                      )}
                      {member.status !== 'suspended' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1.5"
                          disabled={updateAccess.isPending}
                          onClick={() => {
                            setAccessTarget({
                              userId: member.user_id,
                              name: member.full_name || member.email || 'Usuario',
                              currentExpiresAt: member.access_expires_at,
                            });
                            setAccessDate(dateInputValue(member.access_expires_at));
                          }}
                        >
                          <CalendarClock className="h-3.5 w-3.5" /> Validade
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mb-4 rounded-lg border bg-card p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">Operacao de usuarios</p>
            <p className="text-xs text-muted-foreground">Filtre por risco, status, papel e setor para revisar acessos.</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              {visibleMembers.length}/{members.length} usuario{members.length === 1 ? '' : 's'}
            </Badge>
            {hasActiveUserFilters && (
              <Button variant="ghost" size="sm" className="h-8" onClick={resetUserFilters}>
                Limpar
              </Button>
            )}
          </div>
        </div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-6">
          <Input
            value={userSearch}
            onChange={(event) => setUserSearch(event.target.value)}
            placeholder="Buscar nome, email ou setor"
            className="h-9 xl:col-span-2"
          />
          <Select value={statusFilter} onValueChange={(value: UserStatusFilter) => setStatusFilter(value)}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="with_risk">Com risco</SelectItem>
              <SelectItem value="active">Ativo regular</SelectItem>
              <SelectItem value="pending_invite">Convite pendente</SelectItem>
              <SelectItem value="invite_expired">Convite vencido</SelectItem>
              <SelectItem value="access_expiring">Acesso vence em breve</SelectItem>
              <SelectItem value="access_expired">Acesso vencido</SelectItem>
              <SelectItem value="suspended">Suspenso</SelectItem>
            </SelectContent>
          </Select>
          <Select value={roleFilter} onValueChange={(value: UserRoleFilter) => setRoleFilter(value)}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Papel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os papeis</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="director">Diretor</SelectItem>
              <SelectItem value="manager">Manager</SelectItem>
              <SelectItem value="operator">Operador</SelectItem>
              <SelectItem value="member">Membro</SelectItem>
            </SelectContent>
          </Select>
          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Setor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os setores</SelectItem>
              <SelectItem value="none">Sem setor</SelectItem>
              {departments.map((department) => (
                <SelectItem key={department.id} value={department.id}>{department.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={riskFilter} onValueChange={(value: UserRiskFilter) => setRiskFilter(value)}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Risco" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os riscos</SelectItem>
              <SelectItem value="danger">Critico</SelectItem>
              <SelectItem value="warning">Atencao</SelectItem>
              <SelectItem value="info">Informativo</SelectItem>
              <SelectItem value="none">Sem risco</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(value: UserSortKey) => setSortBy(value)}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Ordenar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="risk">Ordenar por risco</SelectItem>
              <SelectItem value="status">Ordenar por status</SelectItem>
              <SelectItem value="role">Ordenar por papel</SelectItem>
              <SelectItem value="department">Ordenar por setor</SelectItem>
              <SelectItem value="last_seen">Ordenar por ultimo acesso</SelectItem>
              <SelectItem value="access">Ordenar por validade</SelectItem>
              <SelectItem value="name">Ordenar por nome</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left">
              <th className="px-4 py-2 font-medium">Usuário</th>
              <th className="px-4 py-2 font-medium">Setores</th>
              <th className="px-4 py-2 font-medium">Papel na org</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {visibleMembers.map((m) => {
              const initials = (m.full_name ?? '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
              const isCurrentUser = m.user_id === user?.id;
              const isLastAdmin = m.org_role === 'admin' && m.status === 'active' && activeAdminCount <= 1;
              const canDeleteUser = canEdit && !isCurrentUser && !isLastAdmin;
              const isSuspended = m.status === 'suspended';
              const hasPendingInvite = !isSuspended && !!m.invited_at && !m.invite_accepted_at;
              const inviteAccepted = !isSuspended && !!m.invite_accepted_at;
              const inviteExpired = !!m.invite_expires_at && new Date(m.invite_expires_at).getTime() < nowMs;
              const accessExpiresAtMs = m.access_expires_at ? new Date(m.access_expires_at).getTime() : null;
              const accessExpired = !!accessExpiresAtMs && accessExpiresAtMs <= nowMs;
              const accessExpiringSoon = !!accessExpiresAtMs && accessExpiresAtMs > nowMs && accessExpiresAtMs <= nowMs + weekMs;
              const accessDaysLeft = accessExpiresAtMs ? Math.max(0, Math.ceil((accessExpiresAtMs - nowMs) / (24 * 60 * 60 * 1000))) : null;
              const canChangeStatus = canEdit && !isCurrentUser && !isLastAdmin;
              return (
                <tr key={m.user_id} className={`border-t ${isSuspended ? 'bg-muted/30 text-muted-foreground' : ''}`}>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7">
                        {m.avatar_url && <AvatarImage src={m.avatar_url} alt={m.full_name ?? ''} />}
                        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                      </Avatar>
                      <button
                        type="button"
                        disabled={!canEdit}
                        className="min-w-0 flex-1 text-left disabled:cursor-default"
                        onClick={() => openEditUser(m.user_id, m.full_name)}
                        title={canEdit ? 'Editar usuário' : undefined}
                      >
                        <div className="font-medium truncate">{m.full_name || 'Sem nome'}</div>
                        {m.email && <div className="text-xs text-muted-foreground truncate">{m.email}</div>}
                      </button>
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          title="Editar nome"
                          onClick={() => openEditUser(m.user_id, m.full_name)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
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
                          auditPermissionChange({
                            organization_id: orgId,
                            target_user_id: m.user_id,
                            entity_type: 'department_member',
                            entity_id: `${deptId}:${m.user_id}`,
                            action: 'add_department_member',
                            before_state: null,
                            after_state: { department_id: deptId, department_name: deptName, user_id: m.user_id, role: 'operator' },
                          });
                          if (userDeptIds.length === 0) {
                            updateProfile.mutate({ user_id: m.user_id, department: deptName });
                          }
                        } else {
                          const row = deptMembers.find((dm) => dm.user_id === m.user_id && dm.department_id === deptId);
                          if (row) {
                            await removeDeptMember.mutateAsync(row.id);
                            auditPermissionChange({
                              organization_id: orgId,
                              target_user_id: m.user_id,
                              entity_type: 'department_member',
                              entity_id: row.id,
                              action: 'remove_department_member',
                              before_state: { department_id: deptId, department_name: deptName, user_id: m.user_id, role: row.role },
                              after_state: null,
                            });
                          }
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
                      onValueChange={(v: 'admin' | 'member') => updateOrgRole.mutate(
                        { organization_id: orgId, user_id: m.user_id, role: v },
                        {
                          onSuccess: () => auditPermissionChange({
                            organization_id: orgId,
                            target_user_id: m.user_id,
                            entity_type: 'organization_member',
                            entity_id: `${orgId}:${m.user_id}`,
                            action: 'update_org_role',
                            before_state: { user_id: m.user_id, org_role: m.org_role },
                            after_state: { user_id: m.user_id, org_role: v },
                          }),
                        },
                      )}
                    >
                      <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="member">Membro</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      Permissao: {APP_ROLE_LABELS[m.app_role]}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-col gap-1">
                      <Badge
                        variant={isSuspended || accessExpired ? 'destructive' : hasPendingInvite ? 'outline' : 'secondary'}
                        className="w-fit text-[10px]"
                      >
                        {isSuspended ? 'Suspenso' : accessExpired ? 'Acesso vencido' : hasPendingInvite ? 'Convite pendente' : 'Ativo'}
                      </Badge>
                      {hasPendingInvite && m.invite_expires_at && (
                        <span className={`text-[10px] ${inviteExpired ? 'text-destructive' : 'text-muted-foreground'}`}>
                          convite {inviteExpired ? 'expirou' : 'expira'} em {new Date(m.invite_expires_at).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                      {inviteAccepted && (
                        <span className="text-[10px] text-muted-foreground">
                          convite aceito em {new Date(m.invite_accepted_at!).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                      {m.first_seen_at && (
                        <span className="text-[10px] text-muted-foreground">
                          primeiro acesso {new Date(m.first_seen_at).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                      {m.last_seen_at && (
                        <span className="text-[10px] text-muted-foreground">
                          ultimo acesso {new Date(m.last_seen_at).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                      {m.access_expires_at && (
                        <Badge
                          variant={accessExpired ? 'destructive' : 'outline'}
                          className={`w-fit text-[10px] ${accessExpiringSoon ? 'border-amber-500/60 text-amber-700' : ''}`}
                        >
                          {accessExpired
                            ? 'acesso expirado'
                            : accessExpiringSoon
                              ? `vence em ${accessDaysLeft} dia${accessDaysLeft === 1 ? '' : 's'}`
                              : `acesso ate ${new Date(m.access_expires_at).toLocaleDateString('pt-BR')}`}
                        </Badge>
                      )}
                      {isSuspended && m.suspended_at && (
                        <span className="text-[10px] text-muted-foreground">
                          desde {new Date(m.suspended_at).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                      {m.auth_blocked_at && (
                        <Badge variant="outline" className="w-fit text-[10px] border-destructive/40 text-destructive">
                          login bloqueado
                        </Badge>
                      )}
                      {isSuspended && m.suspension_reason && (
                        <span className="max-w-[180px] truncate text-[10px] text-muted-foreground" title={m.suspension_reason}>
                          {m.suspension_reason}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    {canEdit && (
                      <div className="flex items-center gap-1 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5"
                          title="Editar usuário"
                          onClick={() => openEditUser(m.user_id, m.full_name)}
                        >
                          <Pencil className="h-3.5 w-3.5" /> Editar
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="h-8 w-8"
                          title="Resetar senha"
                          disabled={resetPassword.isPending}
                          onClick={() => {
                            setNewPwd('');
                            setResetTarget({ userId: m.user_id, name: m.full_name || 'Usuário' });
                          }}
                        ><KeyRound className="h-4 w-4" /></Button>
                        {hasPendingInvite && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Reenviar convite"
                            disabled={resendInvite.isPending}
                            onClick={() => {
                              resendInvite.mutate(
                                { organization_id: orgId, user_id: m.user_id, redirect_to: `${window.location.origin}/login` },
                                {
                                  onSuccess: (result) => {
                                    auditPermissionChange({
                                      organization_id: orgId,
                                      target_user_id: m.user_id,
                                      entity_type: 'organization_user',
                                      entity_id: m.user_id,
                                      action: 'resend_invite',
                                      before_state: { invite_last_sent_at: m.invite_last_sent_at, invite_expires_at: m.invite_expires_at },
                                      after_state: { invite_expires_at: result.invite_expires_at },
                                      metadata: { method: result.method },
                                    });
                                    toast.success('Convite reenviado');
                                  },
                                  onError: (e: unknown) => toast.error(getErrorMessage(e, 'Erro ao reenviar convite')),
                                },
                              );
                            }}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant={accessExpired || accessExpiringSoon ? 'outline' : 'ghost'}
                          size="icon"
                          className="h-8 w-8"
                          title={accessExpired ? 'Renovar acesso' : accessExpiringSoon ? 'Acesso perto de vencer' : 'Configurar validade do acesso'}
                          disabled={updateAccess.isPending || isSuspended}
                          onClick={() => {
                            setAccessTarget({
                              userId: m.user_id,
                              name: m.full_name || m.email || 'Usuario',
                              currentExpiresAt: m.access_expires_at,
                            });
                            setAccessDate(dateInputValue(m.access_expires_at));
                          }}
                        >
                          <CalendarClock className="h-4 w-4" />
                        </Button>
                        <Button
                          variant={isSuspended ? 'outline' : 'ghost'}
                          size="sm"
                          className="h-8 gap-1.5"
                          disabled={!canChangeStatus || updateMemberStatus.isPending}
                          title={isCurrentUser ? 'Voce nao pode alterar seu proprio usuario' : isLastAdmin ? 'Nao e possivel suspender o ultimo admin ativo' : isSuspended ? 'Reativar usuario' : 'Suspender usuario'}
                          onClick={() => {
                            if (!isSuspended) {
                              setSuspendReason('');
                              setBlockAuth(false);
                              setSuspendTarget({
                                userId: m.user_id,
                                name: m.full_name || m.email || 'Usuario',
                                orgRole: m.org_role,
                                appRole: m.app_role,
                                status: m.status,
                              });
                              return;
                            }
                            updateMemberStatus.mutate(
                              { organization_id: orgId, user_id: m.user_id, status: 'active', unblock_auth: true },
                              {
                                onSuccess: (result) => {
                                  auditPermissionChange({
                                    organization_id: orgId,
                                    target_user_id: m.user_id,
                                    entity_type: 'organization_member',
                                    entity_id: `${orgId}:${m.user_id}`,
                                    action: 'reactivate_user',
                                    before_state: {
                                      user_id: m.user_id,
                                      status: m.status,
                                      org_role: m.org_role,
                                      app_role: m.app_role,
                                    },
                                    after_state: {
                                      user_id: m.user_id,
                                      status: 'active',
                                      org_role: m.org_role,
                                      app_role: m.app_role,
                                    },
                                    metadata: { auth_unblocked: !!result?.auth_unblocked },
                                  });
                                  toast.success(result?.auth_unblocked ? 'Usuario reativado e login desbloqueado' : 'Usuario reativado');
                                },
                                onError: (e: unknown) => toast.error(getErrorMessage(e, 'Erro ao alterar status')),
                              },
                            );
                          }}
                        >
                          {isSuspended ? <UserCheck className="h-3.5 w-3.5" /> : <UserX className="h-3.5 w-3.5" />}
                          {isSuspended ? 'Reativar' : 'Suspender'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5 border-destructive/40 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                          disabled={!canDeleteUser || deleteUser.isPending || removeMember.isPending}
                          title={isCurrentUser ? 'Voce nao pode excluir seu proprio usuario' : isLastAdmin ? 'Nao e possivel excluir o ultimo admin' : 'Excluir usuario'}
                          onClick={async () => {
                            const ok = await confirm({
                              title: `Excluir ${m.full_name || 'usuario'}?`,
                              destructive: true,
                              description: 'O usuario sera removido da organizacao, dos setores e das permissoes. Se a funcao administrativa estiver publicada, a conta de login tambem sera excluida.',
                              confirmText: 'Excluir usuario',
                            });
                            if (!ok) return;
                            deleteUser.mutate({ organization_id: orgId, user_id: m.user_id }, {
                              onSuccess: (result: any) => {
                                auditPermissionChange({
                                  organization_id: orgId,
                                  target_user_id: m.user_id,
                                  entity_type: 'organization_user',
                                  entity_id: m.user_id,
                                  action: 'delete_user',
                                  before_state: {
                                    user_id: m.user_id,
                                    full_name: m.full_name,
                                    email: m.email,
                                    org_role: m.org_role,
                                    app_role: m.app_role,
                                  },
                                  after_state: null,
                                  metadata: { deleted_auth_user: !!result?.deleted_auth_user },
                                });
                                toast.success('Usuario excluido');
                              },
                              onError: () => {
                                removeMember.mutate({ organization_id: orgId, user_id: m.user_id }, {
                                  onSuccess: () => {
                                    auditPermissionChange({
                                      organization_id: orgId,
                                      target_user_id: m.user_id,
                                      entity_type: 'organization_member',
                                      entity_id: `${orgId}:${m.user_id}`,
                                      action: 'remove_org_member',
                                      before_state: {
                                        user_id: m.user_id,
                                        full_name: m.full_name,
                                        email: m.email,
                                        org_role: m.org_role,
                                        app_role: m.app_role,
                                      },
                                      after_state: null,
                                    });
                                    toast.success('Usuario removido da organizacao');
                                  },
                                  onError: () => toast.error('Erro ao excluir usuario'),
                                });
                              },
                            });
                          }}
                        ><Trash2 className="h-3.5 w-3.5" /> Excluir</Button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {members.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Nenhum membro</td></tr>
            )}
            {members.length > 0 && visibleMembers.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Nenhum usuario encontrado com os filtros atuais</td></tr>
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

      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar usuário</DialogTitle>
            <DialogDescription>Atualize o nome exibido em responsáveis, equipe e configurações.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Nome completo</Label>
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Ex.: Maria Silva"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && editTarget && editName.trim()) {
                  updateProfile.mutate({ user_id: editTarget.userId, full_name: editName.trim() }, {
                    onSuccess: () => { toast.success('Nome atualizado'); setEditTarget(null); },
                    onError: () => toast.error('Erro ao atualizar nome'),
                  });
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancelar</Button>
            <Button
              disabled={!editName.trim() || updateProfile.isPending}
              onClick={() => {
                if (!editTarget) return;
                updateProfile.mutate({ user_id: editTarget.userId, full_name: editName.trim() }, {
                  onSuccess: () => { toast.success('Nome atualizado'); setEditTarget(null); },
                  onError: () => toast.error('Erro ao atualizar nome'),
                });
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!suspendTarget} onOpenChange={(o) => {
        if (!o) {
          setSuspendTarget(null);
          setSuspendReason('');
          setBlockAuth(false);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Suspender usuario</DialogTitle>
            <DialogDescription>
              A pessoa perde acesso a esta organizacao. O motivo fica registrado na auditoria.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <p className="font-medium">{suspendTarget?.name}</p>
              <p className="text-xs text-muted-foreground">Papel org: {suspendTarget?.orgRole} · Permissao: {suspendTarget?.appRole}</p>
            </div>
            <div className="space-y-2">
              <Label>Motivo da suspensao</Label>
              <Textarea
                value={suspendReason}
                onChange={(event) => setSuspendReason(event.target.value)}
                placeholder="Ex.: desligamento, acesso temporariamente revogado, revisao de permissao..."
                rows={4}
              />
            </div>
            <label className="flex items-start gap-2 rounded-md border p-3 text-sm">
              <Checkbox checked={blockAuth} onCheckedChange={(v) => setBlockAuth(v === true)} />
              <span>
                <span className="block font-medium">Bloquear login global desta conta</span>
                <span className="block text-xs text-muted-foreground">
                  Use quando a pessoa nao deve acessar nenhuma organizacao ate ser reativada.
                </span>
              </span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendTarget(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={!suspendTarget || suspendReason.trim().length < 3 || updateMemberStatus.isPending}
              onClick={() => {
                if (!suspendTarget) return;
                updateMemberStatus.mutate(
                  {
                    organization_id: orgId,
                    user_id: suspendTarget.userId,
                    status: 'suspended',
                    reason: suspendReason.trim(),
                    block_auth: blockAuth,
                  },
                  {
                    onSuccess: (result) => {
                      auditPermissionChange({
                        organization_id: orgId,
                        target_user_id: suspendTarget.userId,
                        entity_type: 'organization_member',
                        entity_id: `${orgId}:${suspendTarget.userId}`,
                        action: 'suspend_user',
                        before_state: {
                          user_id: suspendTarget.userId,
                          status: suspendTarget.status,
                          org_role: suspendTarget.orgRole,
                          app_role: suspendTarget.appRole,
                        },
                        after_state: {
                          user_id: suspendTarget.userId,
                          status: 'suspended',
                          org_role: suspendTarget.orgRole,
                          app_role: suspendTarget.appRole,
                          suspension_reason: suspendReason.trim(),
                        },
                        metadata: { auth_blocked: !!result?.auth_blocked },
                      });
                      toast.success(result?.auth_blocked ? 'Usuario suspenso e login bloqueado' : 'Usuario suspenso');
                      setSuspendTarget(null);
                      setSuspendReason('');
                      setBlockAuth(false);
                    },
                    onError: (e: unknown) => toast.error(getErrorMessage(e, 'Erro ao suspender usuario')),
                  },
                );
              }}
            >
              Suspender
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!accessTarget} onOpenChange={(o) => {
        if (!o) {
          setAccessTarget(null);
          setAccessDate('');
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Validade do acesso</DialogTitle>
            <DialogDescription>
              Defina uma data limite para acesso temporario ou deixe em branco para acesso sem expiracao.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <p className="font-medium">{accessTarget?.name}</p>
              <p className="text-xs text-muted-foreground">
                Atual: {accessTarget?.currentExpiresAt ? new Date(accessTarget.currentExpiresAt).toLocaleDateString('pt-BR') : 'sem expiracao'}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Expira em</Label>
              <Input
                type="date"
                value={accessDate}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(event) => setAccessDate(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">Limpar a data remove a expiracao de acesso.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAccessTarget(null)}>Cancelar</Button>
            <Button
              variant="secondary"
              disabled={!accessTarget || updateAccess.isPending}
              onClick={() => setAccessDate('')}
            >
              Sem expiracao
            </Button>
            <Button
              disabled={!accessTarget || updateAccess.isPending}
              onClick={() => {
                if (!accessTarget) return;
                const nextExpiry = accessDate ? new Date(`${accessDate}T23:59:59`).toISOString() : null;
                updateAccess.mutate(
                  { organization_id: orgId, user_id: accessTarget.userId, access_expires_at: nextExpiry },
                  {
                    onSuccess: (result) => {
                      auditPermissionChange({
                        organization_id: orgId,
                        target_user_id: accessTarget.userId,
                        entity_type: 'organization_member',
                        entity_id: `${orgId}:${accessTarget.userId}`,
                        action: 'update_access_expiration',
                        before_state: { access_expires_at: accessTarget.currentExpiresAt },
                        after_state: { access_expires_at: result.access_expires_at },
                      });
                      toast.success(result.access_expires_at ? 'Validade do acesso atualizada' : 'Acesso sem expiracao');
                      setAccessTarget(null);
                      setAccessDate('');
                    },
                    onError: (e: unknown) => toast.error(getErrorMessage(e, 'Erro ao renovar acesso')),
                  },
                );
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetTarget} onOpenChange={(o) => !o && setResetTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Resetar senha</DialogTitle>
            <DialogDescription>
              Defina uma nova senha temporária para <strong>{resetTarget?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Nova senha (mínimo 6 caracteres)</Label>
            <Input
              type="text"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              placeholder="Digite a nova senha"
              className="font-mono"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetTarget(null)}>Cancelar</Button>
            <Button
              disabled={newPwd.trim().length < 6 || resetPassword.isPending}
              onClick={async () => {
                if (!resetTarget) return;
                try {
                  await resetPassword.mutateAsync({
                    user_id: resetTarget.userId,
                    organization_id: orgId,
                    new_password: newPwd.trim(),
                  });
                  auditPermissionChange({
                    organization_id: orgId,
                    target_user_id: resetTarget.userId,
                    entity_type: 'organization_user',
                    entity_id: resetTarget.userId,
                    action: 'reset_password',
                    before_state: null,
                    after_state: { password_reset: true },
                  });
                  toast.success('Senha resetada com sucesso');
                  setResetTarget(null);
                } catch (e: unknown) {
                  toast.error(getErrorMessage(e, 'Erro ao resetar senha'));
                }
              }}
            >Confirmar</Button>
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
    send_invite: true,
    org_role: 'member' as 'admin' | 'member',
    app_role: 'member' as AppRole,
    access_expires_at: '',
    selectedDeptIds: [] as string[],
    primaryDeptId: '' as string,
  });

  const reset = () => {
    setStep(1);
    setData({
      full_name: '', email: '', password: '',
      send_invite: true,
      org_role: 'member', app_role: 'member',
      access_expires_at: '',
      selectedDeptIds: [], primaryDeptId: '',
    });
  };

  const close = () => { reset(); onClose(); };

  const canNext1 = data.email.trim() && (data.send_invite || data.password.trim().length >= 6);

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
    if (!data.email || (!data.send_invite && !data.password)) { toast.error('Email e senha obrigatórios'); return; }
    const primaryName = departments.find((d) => d.id === data.primaryDeptId)?.name;
    try {
      const res: any = await createUser.mutateAsync({
        email: data.email,
        password: data.send_invite ? undefined : data.password,
        full_name: data.full_name,
        organization_id: orgId,
        org_role: data.org_role,
        department: primaryName,
        send_invite: data.send_invite,
        redirect_to: `${window.location.origin}/login`,
        access_expires_at: data.access_expires_at ? new Date(`${data.access_expires_at}T23:59:59`).toISOString() : null,
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
      toast.success(res?.invited ? 'Convite enviado!' : 'Usuário criado!');
      auditPermissionChange({
        organization_id: orgId,
        target_user_id: newUserId ?? null,
        entity_type: 'organization_user',
        entity_id: newUserId ?? data.email,
        action: 'create_user',
        before_state: null,
        after_state: {
          user_id: newUserId ?? null,
          email: data.email,
          full_name: data.full_name,
          org_role: data.org_role,
          app_role: data.app_role,
          status: 'active',
          access_expires_at: data.access_expires_at || null,
          department_ids: data.selectedDeptIds,
          primary_department_id: data.primaryDeptId || null,
        },
        metadata: { primary_department: primaryName ?? null, invited: !!res?.invited },
      });
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
            <label className="flex items-start gap-2 rounded-md border p-3 text-sm">
              <Checkbox
                checked={data.send_invite}
                onCheckedChange={(v) => setData({ ...data, send_invite: v === true, password: v === true ? '' : data.password })}
              />
              <span>
                <span className="block font-medium">Enviar convite por e-mail</span>
                <span className="block text-xs text-muted-foreground">A pessoa define a senha ao aceitar o convite.</span>
              </span>
            </label>
            {!data.send_invite && (
              <>
                <div><Label>Senha temporária</Label><Input type="text" value={data.password} onChange={(e) => setData({ ...data, password: e.target.value })} placeholder="Mínimo 6 caracteres" /></div>
                <p className="text-xs text-muted-foreground">A pessoa poderá alterar a senha depois pelo login.</p>
              </>
            )}
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
            <div>
              <Label>Validade do acesso</Label>
              <Input
                type="date"
                value={data.access_expires_at}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setData({ ...data, access_expires_at: e.target.value })}
              />
              <p className="text-[11px] text-muted-foreground mt-1">Opcional. Em branco deixa o acesso sem expiracao.</p>
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
                        onSuccess: () => {
                          auditPermissionChange({
                            organization_id: orgId,
                            target_user_id: m.user_id,
                            entity_type: 'user_role',
                            entity_id: m.user_id,
                            action: 'update_app_role',
                            before_state: { user_id: m.user_id, app_role: m.app_role },
                            after_state: { user_id: m.user_id, app_role: role },
                          });
                          toast.success('Permissão atualizada');
                        },
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
                          onSuccess: () => {
                            auditPermissionChange({
                              organization_id: orgId,
                              target_user_id: m.user_id,
                              entity_type: 'user_role',
                              entity_id: `${m.user_id}:it_support`,
                              action: v ? 'enable_it_support' : 'disable_it_support',
                              before_state: { user_id: m.user_id, it_support: !v },
                              after_state: { user_id: m.user_id, it_support: v },
                            });
                            toast.success(v ? 'Adicionado ao Suporte TI' : 'Removido do Suporte TI');
                          },
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
          .from('email_preferences')
          .select('*')
          .eq('user_id', ud.user.id)
          .eq('organization_id', currentOrg.id)
          .maybeSingle()
          .then(({ data }) => {
            if (data) {
              setPrefs({
                notify_on_assignment: data.notify_on_assignment ?? true,
                notify_on_deadline: data.notify_on_deadline ?? true,
                notify_on_mention: data.notify_on_mention ?? true,
                notify_directors: data.notify_directors ?? false,
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
      .from('email_preferences')
      .upsert({
        user_id: ud.user.id,
        organization_id: currentOrg.id,
        ...prefs,
      }, { onConflict: 'organization_id,user_id' });
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
                        onSuccess: () => {
                          const dept = departments.find((d) => d.id === activeDept);
                          const member = memberMap.get(addUser);
                          auditPermissionChange({
                            organization_id: orgId,
                            target_user_id: addUser,
                            entity_type: 'department_member',
                            entity_id: `${activeDept}:${addUser}`,
                            action: 'add_department_member',
                            before_state: null,
                            after_state: {
                              department_id: activeDept,
                              department_name: dept?.name ?? null,
                              user_id: addUser,
                              full_name: member?.full_name ?? null,
                              role: addRole,
                            },
                            metadata: { source: 'department_teams' },
                          });
                          toast.success('Adicionado');
                          setAddUser('');
                        },
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
                              onSuccess: () => {
                                const dept = departments.find((d) => d.id === r.department_id);
                                auditPermissionChange({
                                  organization_id: orgId,
                                  target_user_id: r.user_id,
                                  entity_type: 'department_member',
                                  entity_id: r.id,
                                  action: 'update_department_role',
                                  before_state: {
                                    department_id: r.department_id,
                                    department_name: dept?.name ?? null,
                                    user_id: r.user_id,
                                    role: r.role,
                                  },
                                  after_state: {
                                    department_id: r.department_id,
                                    department_name: dept?.name ?? null,
                                    user_id: r.user_id,
                                    role: v,
                                  },
                                  metadata: { source: 'department_teams' },
                                });
                                toast.success('Atualizado');
                              },
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
                                onSuccess: () => {
                                  const dept = departments.find((d) => d.id === r.department_id);
                                  auditPermissionChange({
                                    organization_id: orgId,
                                    target_user_id: r.user_id,
                                    entity_type: 'department_member',
                                    entity_id: r.id,
                                    action: 'remove_department_member',
                                    before_state: {
                                      department_id: r.department_id,
                                      department_name: dept?.name ?? null,
                                      user_id: r.user_id,
                                      role: r.role,
                                    },
                                    after_state: null,
                                    metadata: { source: 'department_teams' },
                                  });
                                  toast.success('Removido');
                                },
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
