CREATE TABLE IF NOT EXISTS public.programacao_workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  color text NOT NULL DEFAULT '#D6336C',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

ALTER TABLE public.programacao_workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view programacao workspaces"
ON public.programacao_workspaces
FOR SELECT
TO authenticated
USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members create programacao workspaces"
ON public.programacao_workspaces
FOR INSERT
TO authenticated
WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members update programacao workspaces"
ON public.programacao_workspaces
FOR UPDATE
TO authenticated
USING (public.is_org_member(auth.uid(), organization_id))
WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org admins delete programacao workspaces"
ON public.programacao_workspaces
FOR DELETE
TO authenticated
USING (public.is_org_admin(auth.uid(), organization_id));

CREATE TRIGGER update_programacao_workspaces_updated_at
  BEFORE UPDATE ON public.programacao_workspaces
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
