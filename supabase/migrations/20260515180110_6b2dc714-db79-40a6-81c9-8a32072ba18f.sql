
-- ============ Drop CRM ============
DROP TABLE IF EXISTS public.crm_deal_activities CASCADE;
DROP TABLE IF EXISTS public.crm_deals CASCADE;
DROP TABLE IF EXISTS public.crm_stages CASCADE;
DROP TABLE IF EXISTS public.crm_pipelines CASCADE;
DROP TABLE IF EXISTS public.crm_contacts CASCADE;
DROP FUNCTION IF EXISTS public.seed_default_crm_stages() CASCADE;

-- ============ Helper: is_it_support ============
CREATE OR REPLACE FUNCTION public.is_it_support(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('it_support'::app_role, 'admin'::app_role)
  )
$$;

-- ============ Tickets ============
CREATE TABLE public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'open', -- open | in_progress | resolved | closed
  priority text NOT NULL DEFAULT 'medium', -- low | medium | high | urgent
  category text NOT NULL DEFAULT 'bug', -- bug | duvida | solicitacao | outro
  created_by uuid NOT NULL,
  assigned_to uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tickets_org ON public.tickets(organization_id);
CREATE INDEX idx_tickets_status ON public.tickets(status);
CREATE INDEX idx_tickets_assigned ON public.tickets(assigned_to);

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members create tickets"
ON public.tickets FOR INSERT TO authenticated
WITH CHECK (is_org_member(auth.uid(), organization_id) AND auth.uid() = created_by);

CREATE POLICY "View tickets: author or IT"
ON public.tickets FOR SELECT TO authenticated
USING (
  is_org_member(auth.uid(), organization_id)
  AND (auth.uid() = created_by OR auth.uid() = assigned_to OR public.is_it_support(auth.uid()))
);

CREATE POLICY "Update tickets: author or IT"
ON public.tickets FOR UPDATE TO authenticated
USING (
  is_org_member(auth.uid(), organization_id)
  AND (auth.uid() = created_by OR public.is_it_support(auth.uid()))
);

CREATE POLICY "Delete tickets: author or admin"
ON public.tickets FOR DELETE TO authenticated
USING (auth.uid() = created_by OR is_org_admin(auth.uid(), organization_id));

CREATE TRIGGER update_tickets_updated_at
BEFORE UPDATE ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Ticket comments ============
CREATE TABLE public.ticket_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ticket_comments_ticket ON public.ticket_comments(ticket_id);

ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View ticket comments"
ON public.ticket_comments FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.tickets t
  WHERE t.id = ticket_comments.ticket_id
    AND is_org_member(auth.uid(), t.organization_id)
    AND (auth.uid() = t.created_by OR auth.uid() = t.assigned_to OR public.is_it_support(auth.uid()))
));

CREATE POLICY "Create ticket comments"
ON public.ticket_comments FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = ticket_comments.ticket_id
      AND is_org_member(auth.uid(), t.organization_id)
      AND (auth.uid() = t.created_by OR auth.uid() = t.assigned_to OR public.is_it_support(auth.uid()))
  )
);

CREATE POLICY "Delete own comments"
ON public.ticket_comments FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- ============ Ticket attachments ============
CREATE TABLE public.ticket_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text,
  file_size bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ticket_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View ticket attachments"
ON public.ticket_attachments FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.tickets t
  WHERE t.id = ticket_attachments.ticket_id
    AND is_org_member(auth.uid(), t.organization_id)
    AND (auth.uid() = t.created_by OR auth.uid() = t.assigned_to OR public.is_it_support(auth.uid()))
));

CREATE POLICY "Add ticket attachments"
ON public.ticket_attachments FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Delete own ticket attachments"
ON public.ticket_attachments FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- ============ Storage bucket ============
INSERT INTO storage.buckets (id, name, public)
VALUES ('ticket-attachments', 'ticket-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated read ticket attachments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'ticket-attachments');

CREATE POLICY "Authenticated upload ticket attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'ticket-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owners delete ticket attachments"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'ticket-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
