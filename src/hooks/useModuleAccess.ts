import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAppRole, type AppRole } from './usePermissions';

export type ModuleAccessLevel = 'hidden' | 'view' | 'edit';

type ModuleAccessRow = {
  module_key: string;
  grantee_type: 'role' | 'department' | 'user';
  grantee_id: string;
  level: ModuleAccessLevel;
};

/**
 * Resolves the effective access level for the current user on a given module.
 *
 * Resolution order (first match wins):
 *   1. user-specific rule
 *   2. department rule (if user belongs to that department)
 *   3. role rule matching user's app_role
 *   4. No rule → 'edit' (default: full access, preserving current behavior)
 *
 * Admin always gets 'edit'.
 */
export function useModuleAccess(moduleKey: string): {
  level: ModuleAccessLevel;
  isLoading: boolean;
  canView: boolean;
  canEdit: boolean;
} {
  const { user } = useAuth();
  const { currentOrg, isAdmin } = useOrganization();
  const { data: role = 'member' } = useAppRole();
  const orgId = currentOrg?.id;

  const { data: userDeptIds = [] } = useQuery({
    queryKey: ['user-departments', user?.id, orgId],
    queryFn: async () => {
      if (!user || !orgId) return [];
      const { data } = await supabase
        .from('department_members')
        .select('department_id')
        .eq('user_id', user.id);
      return (data || []).map((d: any) => d.department_id);
    },
    enabled: !!user && !!orgId,
    staleTime: 300_000,
  });

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['module-access', orgId, moduleKey],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await supabase
        .from('module_access' as any)
        .select('module_key, grantee_type, grantee_id, level')
        .eq('organization_id', orgId)
        .eq('module_key', moduleKey);
      return (data || []) as ModuleAccessRow[];
    },
    enabled: !!orgId,
    staleTime: 60_000,
  });

  // Admin always has full access
  if (isAdmin) return { level: 'edit', isLoading: false, canView: true, canEdit: true };

  // No rules → default full access (current behavior preserved)
  if (rules.length === 0) return { level: 'edit', isLoading, canView: true, canEdit: true };

  // Resolve: user > department > role
  const userRule = rules.find((r) => r.grantee_type === 'user' && r.grantee_id === user?.id);
  if (userRule) {
    return makeResult(userRule.level, isLoading);
  }

  const deptRule = rules.find(
    (r) => r.grantee_type === 'department' && userDeptIds.includes(r.grantee_id),
  );
  if (deptRule) {
    return makeResult(deptRule.level, isLoading);
  }

  const roleRule = rules.find((r) => r.grantee_type === 'role' && r.grantee_id === role);
  if (roleRule) {
    return makeResult(roleRule.level, isLoading);
  }

  // Rules exist but none match this user → default to hidden (restrictive when rules are defined)
  return { level: 'hidden', isLoading, canView: false, canEdit: false };
}

function makeResult(level: ModuleAccessLevel, isLoading: boolean) {
  return {
    level,
    isLoading,
    canView: level === 'view' || level === 'edit',
    canEdit: level === 'edit',
  };
}

/** All module access rules for the org — used by the settings UI */
export function useAllModuleAccess() {
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id;

  return useQuery({
    queryKey: ['module-access-all', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await supabase
        .from('module_access' as any)
        .select('*')
        .eq('organization_id', orgId)
        .order('module_key');
      return (data || []) as (ModuleAccessRow & { id: string; organization_id: string })[];
    },
    enabled: !!orgId,
  });
}
