-- 1. Tabela genérica de instâncias por módulo
CREATE TABLE public.module_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  module_key text NOT NULL CHECK (module_key IN ('crm','calendario','lancamentos','checagens')),
  name text NOT NULL,
  description text,
  color text NOT NULL DEFAULT '#D6336C',
  icon text,
  position integer NOT NULL DEFAULT 0,
  archived_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_module_instances_org_module ON public.module_instances(organization_id, module_key) WHERE archived_at IS NULL;

ALTER TABLE public.module_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view module instances" ON public.module_instances
  FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Members create module instances" ON public.module_instances
  FOR INSERT TO authenticated
  WITH CHECK (is_org_member(auth.uid(), organization_id) AND auth.uid() = created_by);

CREATE POLICY "Owner or admin update module instances" ON public.module_instances
  FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Owner or admin delete module instances" ON public.module_instances
  FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR is_org_admin(auth.uid(), organization_id));

CREATE TRIGGER trg_module_instances_updated_at
  BEFORE UPDATE ON public.module_instances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Adicionar instance_id nas tabelas dos módulos
ALTER TABLE public.crm_pipelines ADD COLUMN instance_id uuid REFERENCES public.module_instances(id) ON DELETE SET NULL;
ALTER TABLE public.annual_events ADD COLUMN instance_id uuid REFERENCES public.module_instances(id) ON DELETE SET NULL;
ALTER TABLE public.launches ADD COLUMN instance_id uuid REFERENCES public.module_instances(id) ON DELETE SET NULL;
ALTER TABLE public.launch_checklists ADD COLUMN instance_id uuid REFERENCES public.module_instances(id) ON DELETE SET NULL;

CREATE INDEX idx_crm_pipelines_instance ON public.crm_pipelines(instance_id);
CREATE INDEX idx_annual_events_instance ON public.annual_events(instance_id);
CREATE INDEX idx_launches_instance ON public.launches(instance_id);
CREATE INDEX idx_launch_checklists_instance ON public.launch_checklists(instance_id);

-- 3. Migração: criar instância "Geral" para cada (org, módulo) e vincular dados existentes
DO $$
DECLARE
  org RECORD;
  modkey text;
  mods text[] := ARRAY['crm','calendario','lancamentos','checagens'];
  inst_id uuid;
  any_user uuid;
BEGIN
  FOR org IN SELECT id FROM public.organizations LOOP
    -- Pega qualquer admin/member da org como created_by da instância default
    SELECT user_id INTO any_user FROM public.organization_members
      WHERE organization_id = org.id ORDER BY created_at LIMIT 1;
    IF any_user IS NULL THEN CONTINUE; END IF;

    FOREACH modkey IN ARRAY mods LOOP
      INSERT INTO public.module_instances (organization_id, module_key, name, description, color, created_by)
      VALUES (org.id, modkey, 'Geral', 'Espaço padrão', '#D6336C', any_user)
      RETURNING id INTO inst_id;

      IF modkey = 'crm' THEN
        UPDATE public.crm_pipelines SET instance_id = inst_id
          WHERE organization_id = org.id AND instance_id IS NULL;
      ELSIF modkey = 'calendario' THEN
        UPDATE public.annual_events SET instance_id = inst_id
          WHERE organization_id = org.id AND instance_id IS NULL;
      ELSIF modkey = 'lancamentos' THEN
        UPDATE public.launches SET instance_id = inst_id
          WHERE organization_id = org.id AND instance_id IS NULL;
      ELSIF modkey = 'checagens' THEN
        UPDATE public.launch_checklists SET instance_id = inst_id
          WHERE organization_id = org.id AND instance_id IS NULL;
      END IF;
    END LOOP;
  END LOOP;
END $$;