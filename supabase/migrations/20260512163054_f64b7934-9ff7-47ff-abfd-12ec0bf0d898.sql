
-- Annual calendar events
CREATE TABLE public.annual_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'acao',
  color TEXT NOT NULL DEFAULT '#D6336C',
  start_date DATE NOT NULL,
  end_date DATE,
  project_id UUID,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.annual_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view annual events" ON public.annual_events
  FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Members create annual events" ON public.annual_events
  FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id) AND auth.uid() = created_by);
CREATE POLICY "Owner or admin update annual events" ON public.annual_events
  FOR UPDATE TO authenticated USING (auth.uid() = created_by OR public.is_org_admin(auth.uid(), organization_id));
CREATE POLICY "Owner or admin delete annual events" ON public.annual_events
  FOR DELETE TO authenticated USING (auth.uid() = created_by OR public.is_org_admin(auth.uid(), organization_id));

CREATE TRIGGER update_annual_events_updated_at BEFORE UPDATE ON public.annual_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Launches (lançamentos)
CREATE TABLE public.launches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'active',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.launches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view launches" ON public.launches
  FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Members create launches" ON public.launches
  FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id) AND auth.uid() = created_by);
CREATE POLICY "Members update launches" ON public.launches
  FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Owner or admin delete launches" ON public.launches
  FOR DELETE TO authenticated USING (auth.uid() = created_by OR public.is_org_admin(auth.uid(), organization_id));

CREATE TRIGGER update_launches_updated_at BEFORE UPDATE ON public.launches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Launch stages (etapas sequenciais)
CREATE TABLE public.launch_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  launch_id UUID NOT NULL REFERENCES public.launches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  duration_days INTEGER NOT NULL DEFAULT 1,
  assignee_id UUID,
  planned_start DATE,
  planned_end DATE,
  actual_end DATE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.launch_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View stages via launch" ON public.launch_stages
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.launches l WHERE l.id = launch_stages.launch_id AND public.is_org_member(auth.uid(), l.organization_id))
  );
CREATE POLICY "Manage stages via launch" ON public.launch_stages
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.launches l WHERE l.id = launch_stages.launch_id AND public.is_org_member(auth.uid(), l.organization_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.launches l WHERE l.id = launch_stages.launch_id AND public.is_org_member(auth.uid(), l.organization_id))
  );

CREATE TRIGGER update_launch_stages_updated_at BEFORE UPDATE ON public.launch_stages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_launch_stages_launch ON public.launch_stages(launch_id, position);
CREATE INDEX idx_annual_events_org_date ON public.annual_events(organization_id, start_date);
