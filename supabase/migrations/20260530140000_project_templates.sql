-- Project templates for reusable task structures
CREATE TABLE public.project_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.project_template_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.project_templates(id) ON DELETE CASCADE,
  title text NOT NULL,
  status task_status NOT NULL DEFAULT 'todo',
  priority task_priority NOT NULL DEFAULT 'medium',
  parent_ref uuid REFERENCES public.project_template_tasks(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_template_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view org templates"
  ON public.project_templates FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE POLICY "Members can create templates"
  ON public.project_templates FOR INSERT
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE POLICY "Creator can update template"
  ON public.project_templates FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "Creator can delete template"
  ON public.project_templates FOR DELETE
  USING (created_by = auth.uid());

CREATE POLICY "Members can view template tasks"
  ON public.project_template_tasks FOR SELECT
  USING (template_id IN (SELECT id FROM public.project_templates WHERE organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())));

CREATE POLICY "Members can insert template tasks"
  ON public.project_template_tasks FOR INSERT
  WITH CHECK (template_id IN (SELECT id FROM public.project_templates WHERE organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())));

CREATE POLICY "Members can delete template tasks"
  ON public.project_template_tasks FOR DELETE
  USING (template_id IN (SELECT id FROM public.project_templates WHERE organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())));
