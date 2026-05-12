-- ============ CRM ============
CREATE TABLE public.crm_pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'atacado', -- 'atacado' | 'arquiteto'
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.crm_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL REFERENCES public.crm_pipelines(id) ON DELETE CASCADE,
  name text NOT NULL,
  position int NOT NULL DEFAULT 0,
  color text NOT NULL DEFAULT '#D6336C',
  is_won boolean NOT NULL DEFAULT false,
  is_lost boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.crm_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'atacado', -- atacado | arquiteto
  name text NOT NULL,
  company text,
  email text,
  phone text,
  document text, -- CNPJ/CPF
  address text,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.crm_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  pipeline_id uuid NOT NULL REFERENCES public.crm_pipelines(id) ON DELETE CASCADE,
  stage_id uuid NOT NULL REFERENCES public.crm_stages(id) ON DELETE RESTRICT,
  contact_id uuid REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  title text NOT NULL,
  value_cents bigint NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BRL',
  expected_close_date date,
  owner_id uuid,
  shopify_draft_order_id text,
  shopify_draft_order_name text, -- Ex: #D123
  shopify_draft_order_url text,
  shopify_order_number text,
  notes text,
  position int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open', -- open | won | lost
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.crm_deal_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.crm_deals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'note', -- note|call|email|meeting|stage_change
  content text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_deal_activities ENABLE ROW LEVEL SECURITY;

-- Pipelines: members view, admin manage
CREATE POLICY "Members view pipelines" ON public.crm_pipelines FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Admins manage pipelines insert" ON public.crm_pipelines FOR INSERT TO authenticated
  WITH CHECK (is_org_admin(auth.uid(), organization_id));
CREATE POLICY "Admins manage pipelines update" ON public.crm_pipelines FOR UPDATE TO authenticated
  USING (is_org_admin(auth.uid(), organization_id));
CREATE POLICY "Admins manage pipelines delete" ON public.crm_pipelines FOR DELETE TO authenticated
  USING (is_org_admin(auth.uid(), organization_id));

-- Stages
CREATE POLICY "View stages via pipeline" ON public.crm_stages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM crm_pipelines p WHERE p.id = pipeline_id AND is_org_member(auth.uid(), p.organization_id)));
CREATE POLICY "Admin manage stages" ON public.crm_stages FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM crm_pipelines p WHERE p.id = pipeline_id AND is_org_admin(auth.uid(), p.organization_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM crm_pipelines p WHERE p.id = pipeline_id AND is_org_admin(auth.uid(), p.organization_id)));

-- Contacts: members manage all in org
CREATE POLICY "Members view contacts" ON public.crm_contacts FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Members create contacts" ON public.crm_contacts FOR INSERT TO authenticated
  WITH CHECK (is_org_member(auth.uid(), organization_id) AND auth.uid() = created_by);
CREATE POLICY "Members update contacts" ON public.crm_contacts FOR UPDATE TO authenticated
  USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Owner or admin delete contacts" ON public.crm_contacts FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR is_org_admin(auth.uid(), organization_id));

-- Deals
CREATE POLICY "Members view deals" ON public.crm_deals FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Members create deals" ON public.crm_deals FOR INSERT TO authenticated
  WITH CHECK (is_org_member(auth.uid(), organization_id) AND auth.uid() = created_by);
CREATE POLICY "Members update deals" ON public.crm_deals FOR UPDATE TO authenticated
  USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Owner or admin delete deals" ON public.crm_deals FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR is_org_admin(auth.uid(), organization_id));

-- Activities
CREATE POLICY "View deal activities" ON public.crm_deal_activities FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM crm_deals d WHERE d.id = deal_id AND is_org_member(auth.uid(), d.organization_id)));
CREATE POLICY "Create deal activities" ON public.crm_deal_activities FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM crm_deals d WHERE d.id = deal_id AND is_org_member(auth.uid(), d.organization_id)));
CREATE POLICY "Delete own deal activities" ON public.crm_deal_activities FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER crm_contacts_updated_at BEFORE UPDATE ON public.crm_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER crm_deals_updated_at BEFORE UPDATE ON public.crm_deals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ LAUNCH CHECKLISTS ============
CREATE TABLE public.checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.checklist_template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.checklist_templates(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  category text NOT NULL DEFAULT 'geral', -- geral|fotos|descricao|erp|site|colecao|chegada
  label text NOT NULL,
  hint text
);

CREATE TABLE public.launch_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  launch_id uuid REFERENCES public.launches(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.checklist_templates(id) ON DELETE SET NULL,
  name text NOT NULL,
  expected_arrival_date date,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.launch_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id uuid NOT NULL REFERENCES public.launch_checklists(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  category text NOT NULL DEFAULT 'geral',
  label text NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending|done|na|blocked
  assignee_id uuid,
  due_date date,
  notes text,
  completed_at timestamptz,
  completed_by uuid
);

ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.launch_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.launch_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view templates" ON public.checklist_templates FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Members create templates" ON public.checklist_templates FOR INSERT TO authenticated
  WITH CHECK (is_org_member(auth.uid(), organization_id) AND auth.uid() = created_by);
CREATE POLICY "Members update templates" ON public.checklist_templates FOR UPDATE TO authenticated
  USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Owner or admin delete templates" ON public.checklist_templates FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Manage template items" ON public.checklist_template_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM checklist_templates t WHERE t.id = template_id AND is_org_member(auth.uid(), t.organization_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM checklist_templates t WHERE t.id = template_id AND is_org_member(auth.uid(), t.organization_id)));

CREATE POLICY "Members view checklists" ON public.launch_checklists FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Members create checklists" ON public.launch_checklists FOR INSERT TO authenticated
  WITH CHECK (is_org_member(auth.uid(), organization_id) AND auth.uid() = created_by);
CREATE POLICY "Members update checklists" ON public.launch_checklists FOR UPDATE TO authenticated
  USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Owner or admin delete checklists" ON public.launch_checklists FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Manage checklist items" ON public.launch_checklist_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM launch_checklists c WHERE c.id = checklist_id AND is_org_member(auth.uid(), c.organization_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM launch_checklists c WHERE c.id = checklist_id AND is_org_member(auth.uid(), c.organization_id)));

CREATE TRIGGER checklist_templates_updated_at BEFORE UPDATE ON public.checklist_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER launch_checklists_updated_at BEFORE UPDATE ON public.launch_checklists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_crm_deals_pipeline ON public.crm_deals(pipeline_id, stage_id);
CREATE INDEX idx_crm_deals_org ON public.crm_deals(organization_id);
CREATE INDEX idx_crm_contacts_org ON public.crm_contacts(organization_id);
CREATE INDEX idx_checklist_items_checklist ON public.launch_checklist_items(checklist_id);
CREATE INDEX idx_template_items_template ON public.checklist_template_items(template_id);