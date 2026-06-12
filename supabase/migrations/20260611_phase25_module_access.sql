-- Phase 2.5 item 2.5.4: Module access control table
-- Default sem linha = visible for entire org (current behavior preserved).
-- Sidebar and routes respect via hook useModuleAccess(moduleKey).

CREATE TABLE IF NOT EXISTS public.module_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  grantee_type text NOT NULL CHECK (grantee_type IN ('role', 'department', 'user')),
  grantee_id text NOT NULL,
  level text NOT NULL CHECK (level IN ('hidden', 'view', 'edit')) DEFAULT 'view',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, module_key, grantee_type, grantee_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_module_access_org_module
  ON public.module_access (organization_id, module_key);

-- RLS
ALTER TABLE public.module_access ENABLE ROW LEVEL SECURITY;

-- Read: any org member can read access rules (needed for sidebar visibility)
CREATE POLICY "Org members can read module_access"
  ON public.module_access FOR SELECT
  USING (public.is_org_member(auth.uid(), organization_id));

-- Write: only admin can manage access rules
CREATE POLICY "Admin can insert module_access"
  ON public.module_access FOR INSERT
  WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Admin can update module_access"
  ON public.module_access FOR UPDATE
  USING (public.is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Admin can delete module_access"
  ON public.module_access FOR DELETE
  USING (public.is_org_admin(auth.uid(), organization_id));

-- Comment for documentation
COMMENT ON TABLE public.module_access IS 'Per-module access control. No row = visible to all org members (default). Rows restrict visibility/editing by role, department, or user.';
COMMENT ON COLUMN public.module_access.module_key IS 'Module identifier: orders, tickets, boards, docs, launches, melhorias, programacao, newsletters, demandas, sessoes, produtos, calendario, salas, equipe, configuracoes';
COMMENT ON COLUMN public.module_access.grantee_type IS 'role = app_role name, department = department UUID, user = user UUID';
COMMENT ON COLUMN public.module_access.grantee_id IS 'Value depends on grantee_type: role name (admin/director/manager/operator/member), department id, or user id';
COMMENT ON COLUMN public.module_access.level IS 'hidden = not visible, view = read-only, edit = full access';
