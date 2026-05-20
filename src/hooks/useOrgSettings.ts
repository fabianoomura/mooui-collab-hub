import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface OrgDepartment {
  id: string;
  organization_id: string;
  name: string;
  color: string;
  created_at: string;
}
export interface OrgPosition {
  id: string;
  organization_id: string;
  name: string;
  created_at: string;
}

export function useDepartments(orgId?: string) {
  return useQuery({
    queryKey: ['org-departments', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('org_departments')
        .select('*')
        .eq('organization_id', orgId!)
        .order('name');
      if (error) throw error;
      return data as OrgDepartment[];
    },
  });
}

export function usePositions(orgId?: string) {
  return useQuery({
    queryKey: ['org-positions', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('org_positions')
        .select('*')
        .eq('organization_id', orgId!)
        .order('name');
      if (error) throw error;
      return data as OrgPosition[];
    },
  });
}

export function useCreateDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { organization_id: string; name: string; color?: string }) => {
      const { data, error } = await supabase
        .from('org_departments')
        .insert({ organization_id: input.organization_id, name: input.name, color: input.color ?? '#D6336C' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['org-departments', vars.organization_id] }),
  });
}

export function useDeleteDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('org_departments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org-departments'] }),
  });
}

export function useCreatePosition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { organization_id: string; name: string }) => {
      const { data, error } = await supabase
        .from('org_positions')
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['org-positions', vars.organization_id] }),
  });
}

export function useDeletePosition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('org_positions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org-positions'] }),
  });
}

// Members + profiles + roles
export interface MemberRow {
  user_id: string;
  org_role: 'admin' | 'member';
  full_name: string | null;
  avatar_url: string | null;
  department: string | null;
  position: string | null;
  app_role: 'admin' | 'manager' | 'member' | 'director' | 'operator';
}

export function useOrgMembersFull(orgId?: string) {
  return useQuery({
    queryKey: ['org-members-full', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data: members, error: e1 } = await supabase
        .from('organization_members')
        .select('user_id, role')
        .eq('organization_id', orgId!);
      if (e1) throw e1;
      const ids = (members ?? []).map((m: any) => m.user_id);
      if (ids.length === 0) return [] as MemberRow[];

      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from('profiles').select('id, full_name, avatar_url, department, position').in('id', ids),
        supabase.from('user_roles').select('user_id, role').in('user_id', ids),
      ]);

      const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
      const roleMap = new Map<string, string>();
      (roles ?? []).forEach((r: any) => {
        const cur = roleMap.get(r.user_id);
        // priority: admin > manager > member
        const order = { admin: 5, director: 4, manager: 3, operator: 2, member: 1 } as Record<string, number>;
        if (!cur || order[r.role] > order[cur]) roleMap.set(r.user_id, r.role);
      });

      return (members ?? []).map((m: any) => {
        const p: any = profileMap.get(m.user_id) ?? {};
        return {
          user_id: m.user_id,
          org_role: m.role,
          full_name: p.full_name ?? null,
          avatar_url: p.avatar_url ?? null,
          department: p.department ?? null,
          position: p.position ?? null,
          app_role: (roleMap.get(m.user_id) ?? 'member') as MemberRow['app_role'],
        } as MemberRow;
      });
    },
  });
}

export function useUpdateMemberProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { user_id: string; department?: string | null; position?: string | null; full_name?: string }) => {
      const { user_id, ...patch } = input;
      const { error } = await supabase.from('profiles').update(patch).eq('id', user_id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org-members-full'] }),
  });
}

export function useUpdateOrgRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { organization_id: string; user_id: string; role: 'admin' | 'member' }) => {
      const { error } = await supabase
        .from('organization_members')
        .update({ role: input.role })
        .eq('organization_id', input.organization_id)
        .eq('user_id', input.user_id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org-members-full'] }),
  });
}

export function useUpdateAppRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { user_id: string; role: 'admin' | 'manager' | 'member' | 'director' | 'operator' }) => {
      // wipe previous app roles (preserve it_support flag) then insert new
      const { error: delErr } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', input.user_id)
        .in('role', ['admin', 'manager', 'member', 'director', 'operator']);
      if (delErr) throw delErr;
      const { error: insErr } = await supabase.from('user_roles').insert({ user_id: input.user_id, role: input.role });
      if (insErr) throw insErr;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org-members-full'] }),
  });
}

export function useItSupportMembers(userIds: string[]) {
  return useQuery({
    queryKey: ['it-support-flags', userIds.sort().join(',')],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'it_support')
        .in('user_id', userIds);
      if (error) throw error;
      return new Set((data ?? []).map((r: any) => r.user_id));
    },
  });
}

export function useToggleItSupport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { user_id: string; enable: boolean }) => {
      if (input.enable) {
        const { error } = await supabase.from('user_roles').insert({ user_id: input.user_id, role: 'it_support' });
        if (error && !error.message.includes('duplicate')) throw error;
      } else {
        const { error } = await supabase
          .from('user_roles').delete()
          .eq('user_id', input.user_id).eq('role', 'it_support');
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['it-support-flags'] });
      qc.invalidateQueries({ queryKey: ['is-it-support'] });
      qc.invalidateQueries({ queryKey: ['it-support-members'] });
    },
  });
}

export function useResetUserPassword() {
  return useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      });
      if (error) throw error;
    },
  });
}

export function useRemoveOrgMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { organization_id: string; user_id: string }) => {
      const { error } = await supabase
        .from('organization_members')
        .delete()
        .eq('organization_id', input.organization_id)
        .eq('user_id', input.user_id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org-members-full'] }),
  });
}

// Department members (manager / operator multi-setor)
export interface DepartmentMemberRow {
  id: string;
  department_id: string;
  user_id: string;
  role: 'manager' | 'operator';
}

export function useDepartmentMembers(orgId?: string) {
  return useQuery({
    queryKey: ['department-members', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data: depts, error: e1 } = await supabase
        .from('org_departments').select('id').eq('organization_id', orgId!);
      if (e1) throw e1;
      const ids = (depts ?? []).map((d: any) => d.id);
      if (ids.length === 0) return [] as DepartmentMemberRow[];
      const { data, error } = await supabase
        .from('department_members').select('id, department_id, user_id, role').in('department_id', ids);
      if (error) throw error;
      return (data ?? []) as DepartmentMemberRow[];
    },
  });
}

export function useAddDepartmentMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { department_id: string; user_id: string; role: 'manager' | 'operator' }) => {
      const { error } = await supabase.from('department_members').insert(input);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['department-members'] }),
  });
}

export function useUpdateDepartmentMemberRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; role: 'manager' | 'operator' }) => {
      const { error } = await supabase.from('department_members').update({ role: input.role }).eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['department-members'] }),
  });
}

export function useRemoveDepartmentMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('department_members').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['department-members'] }),
  });
}

export function useCreateOrgUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      email: string;
      password: string;
      full_name: string;
      organization_id: string;
      org_role: 'admin' | 'member';
      department?: string;
      position?: string;
      app_role?: 'admin' | 'manager' | 'member';
    }) => {
      const { data, error } = await supabase.functions.invoke('admin-create-user', { body: input });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org-members-full'] }),
  });
}
