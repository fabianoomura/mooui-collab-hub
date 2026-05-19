
-- ============ SLA config ============
CREATE TABLE IF NOT EXISTS public.ticket_sla_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  priority text NOT NULL CHECK (priority IN ('low','medium','high','urgent')),
  response_hours integer NOT NULL DEFAULT 24,
  resolve_hours integer NOT NULL DEFAULT 72,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, priority)
);

ALTER TABLE public.ticket_sla_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view sla config"
ON public.ticket_sla_config FOR SELECT TO authenticated
USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Admins manage sla config"
ON public.ticket_sla_config FOR ALL TO authenticated
USING (public.is_org_admin(auth.uid(), organization_id))
WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

CREATE TRIGGER trg_sla_updated
BEFORE UPDATE ON public.ticket_sla_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed defaults for every existing org
INSERT INTO public.ticket_sla_config (organization_id, priority, response_hours, resolve_hours)
SELECT o.id, p.priority, p.r, p.s
FROM public.organizations o
CROSS JOIN (VALUES
  ('urgent', 1, 4),
  ('high',   4, 24),
  ('medium', 8, 72),
  ('low',    24, 168)
) AS p(priority, r, s)
ON CONFLICT (organization_id, priority) DO NOTHING;

-- ============ Labels ============
CREATE TABLE IF NOT EXISTS public.ticket_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#D6336C',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ticket_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view ticket labels"
ON public.ticket_labels FOR SELECT TO authenticated
USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Admins manage ticket labels"
ON public.ticket_labels FOR ALL TO authenticated
USING (public.is_org_admin(auth.uid(), organization_id))
WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

CREATE TABLE IF NOT EXISTS public.ticket_label_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  label_id uuid NOT NULL REFERENCES public.ticket_labels(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ticket_id, label_id)
);

CREATE INDEX IF NOT EXISTS idx_tla_ticket ON public.ticket_label_assignments(ticket_id);

ALTER TABLE public.ticket_label_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view label assignments"
ON public.ticket_label_assignments FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.tickets t
  WHERE t.id = ticket_label_assignments.ticket_id
    AND public.is_org_member(auth.uid(), t.organization_id)
));

CREATE POLICY "Members assign labels"
ON public.ticket_label_assignments FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.tickets t
  WHERE t.id = ticket_label_assignments.ticket_id
    AND public.is_org_member(auth.uid(), t.organization_id)
));

CREATE POLICY "Members remove labels"
ON public.ticket_label_assignments FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.tickets t
  WHERE t.id = ticket_label_assignments.ticket_id
    AND public.is_org_member(auth.uid(), t.organization_id)
));
