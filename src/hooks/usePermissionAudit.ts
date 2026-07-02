import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type PermissionAuditInput = {
  organization_id: string;
  target_user_id?: string | null;
  entity_type: string;
  entity_id?: string | null;
  action: string;
  before_state?: Record<string, unknown> | null;
  after_state?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
};

export type PermissionAuditRow = PermissionAuditInput & {
  id: string;
  actor_id: string | null;
  created_at: string;
};

const db = supabase as any;

export async function writePermissionAudit(input: PermissionAuditInput) {
  const { error } = await db.from('permission_audit_log').insert({
    organization_id: input.organization_id,
    target_user_id: input.target_user_id ?? null,
    entity_type: input.entity_type,
    entity_id: input.entity_id ?? null,
    action: input.action,
    before_state: input.before_state ?? null,
    after_state: input.after_state ?? null,
    metadata: input.metadata ?? {},
  });
  if (error) throw error;
}

export function usePermissionAudit() {
  return useMutation({
    mutationFn: writePermissionAudit,
    onError: (error) => {
      console.warn('Permission audit write failed', error);
    },
  });
}

export function usePermissionAuditLog(orgId: string | undefined) {
  return useQuery({
    queryKey: ['permission-audit-log', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await db
        .from('permission_audit_log')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(80);
      if (error) throw error;
      return (data || []) as PermissionAuditRow[];
    },
  });
}
