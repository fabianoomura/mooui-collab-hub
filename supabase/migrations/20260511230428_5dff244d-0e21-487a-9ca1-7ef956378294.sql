
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS position TEXT;

CREATE TABLE public.org_departments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#D6336C',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, name)
);
ALTER TABLE public.org_departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view departments" ON public.org_departments
FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Admins insert departments" ON public.org_departments
FOR INSERT TO authenticated WITH CHECK (public.is_org_admin(auth.uid(), organization_id));
CREATE POLICY "Admins update departments" ON public.org_departments
FOR UPDATE TO authenticated USING (public.is_org_admin(auth.uid(), organization_id));
CREATE POLICY "Admins delete departments" ON public.org_departments
FOR DELETE TO authenticated USING (public.is_org_admin(auth.uid(), organization_id));

CREATE TABLE public.org_positions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, name)
);
ALTER TABLE public.org_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view positions" ON public.org_positions
FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Admins insert positions" ON public.org_positions
FOR INSERT TO authenticated WITH CHECK (public.is_org_admin(auth.uid(), organization_id));
CREATE POLICY "Admins update positions" ON public.org_positions
FOR UPDATE TO authenticated USING (public.is_org_admin(auth.uid(), organization_id));
CREATE POLICY "Admins delete positions" ON public.org_positions
FOR DELETE TO authenticated USING (public.is_org_admin(auth.uid(), organization_id));
