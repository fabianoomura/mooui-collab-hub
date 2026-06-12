import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';

export type AppRole = 'admin' | 'director' | 'manager' | 'operator' | 'member';

/** Role hierarchy — lower index = higher privilege */
const ROLE_RANK: Record<AppRole, number> = {
  admin: 0,
  director: 1,
  manager: 2,
  operator: 3,
  member: 4,
};

/** Permission matrix — minimum role required for each action */
const PERMISSIONS: Record<string, AppRole> = {
  create_project: 'manager',
  delete_project: 'director',
  create_private_channel: 'manager',
  manage_org_members: 'admin',
  reassign_any_task: 'director',
  view_reports: 'manager',
  configure_email: 'admin',
  manage_departments: 'admin',
  manage_templates: 'manager',
  delete_any_order: 'director',
  manage_module_instances: 'manager',
  delete_task: 'manager',
  delete_attachment: 'manager',
  delete_comment: 'member',
  delete_melhoria: 'manager',
  delete_sessao: 'manager',
  delete_produto: 'manager',
  delete_conteudo: 'manager',
  delete_newsletter: 'manager',
  delete_pauta: 'manager',
  delete_launch: 'manager',
  delete_checklist: 'manager',
  delete_event: 'manager',
  delete_doc: 'manager',
  delete_link: 'manager',
  delete_label: 'manager',
  delete_order: 'manager',
  delete_ticket: 'manager',
  delete_channel: 'manager',
};

function roleAtLeast(userRole: AppRole, minRole: AppRole): boolean {
  return ROLE_RANK[userRole] <= ROLE_RANK[minRole];
}

/** Fetches the current user's app_role from user_roles table */
export function useAppRole() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['app-role', user?.id],
    queryFn: async (): Promise<AppRole> => {
      if (!user) return 'member';
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .not('role', 'eq', 'it_support')
        .maybeSingle();
      return (data?.role as AppRole) ?? 'member';
    },
    enabled: !!user,
    staleTime: 60_000,
  });
}

/** Hook that returns a permission checker function */
export function usePermissions() {
  const { data: role = 'member' } = useAppRole();
  const { isAdmin: isOrgAdmin } = useOrganization();

  const canDo = (action: string): boolean => {
    // Org admins inherit full permissions
    if (isOrgAdmin) return true;

    const minRole = PERMISSIONS[action];
    // Unknown destructive actions denied by default; other unknowns allowed
    if (!minRole) return !action.startsWith('delete_');
    return roleAtLeast(role, minRole);
  };

  const isAtLeast = (minRole: AppRole): boolean => {
    if (isOrgAdmin) return true;
    return roleAtLeast(role, minRole);
  };

  return { role, canDo, isAtLeast };
}
