-- ============================================================
-- Comments & Activity for Newsletter and Pauta modules
-- ============================================================

-- ---- Newsletter Comments ----
CREATE TABLE IF NOT EXISTS public.newsletter_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  newsletter_id UUID NOT NULL REFERENCES public.newsletters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_newsletter_comments ON public.newsletter_comments(newsletter_id);
ALTER TABLE public.newsletter_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View newsletter comments" ON public.newsletter_comments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.newsletters n WHERE n.id = newsletter_id AND public.is_org_member(auth.uid(), n.organization_id)));
CREATE POLICY "Add newsletter comments" ON public.newsletter_comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.newsletters n WHERE n.id = newsletter_id AND public.is_org_member(auth.uid(), n.organization_id)));
CREATE POLICY "Delete own newsletter comments" ON public.newsletter_comments FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ---- Newsletter Activity ----
CREATE TABLE IF NOT EXISTS public.newsletter_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  newsletter_id UUID NOT NULL REFERENCES public.newsletters(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  from_value TEXT,
  to_value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_newsletter_activity ON public.newsletter_activity(newsletter_id);
ALTER TABLE public.newsletter_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View newsletter activity" ON public.newsletter_activity FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.newsletters n WHERE n.id = newsletter_id AND public.is_org_member(auth.uid(), n.organization_id)));
CREATE POLICY "Add newsletter activity" ON public.newsletter_activity FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.newsletters n WHERE n.id = newsletter_id AND public.is_org_member(auth.uid(), n.organization_id)));

-- ---- Newsletter Activity Trigger ----
CREATE OR REPLACE FUNCTION public.log_newsletter_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO public.newsletter_activity (newsletter_id, user_id, action, from_value, to_value)
      VALUES (NEW.id, auth.uid(), 'alterou status', OLD.status, NEW.status);
    END IF;
    IF OLD.scheduled_date IS DISTINCT FROM NEW.scheduled_date THEN
      INSERT INTO public.newsletter_activity (newsletter_id, user_id, action, from_value, to_value)
      VALUES (NEW.id, auth.uid(), 'alterou data', COALESCE(OLD.scheduled_date::text,'(vazio)'), COALESCE(NEW.scheduled_date::text,'(vazio)'));
    END IF;
    IF OLD.tema IS DISTINCT FROM NEW.tema THEN
      INSERT INTO public.newsletter_activity (newsletter_id, user_id, action, from_value, to_value)
      VALUES (NEW.id, auth.uid(), 'alterou tema', COALESCE(OLD.tema,'(vazio)'), COALESCE(NEW.tema,'(vazio)'));
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_newsletter_activity ON public.newsletters;
CREATE TRIGGER trg_newsletter_activity
  AFTER UPDATE ON public.newsletters
  FOR EACH ROW EXECUTE FUNCTION public.log_newsletter_activity();

-- ---- Pauta Comments ----
CREATE TABLE IF NOT EXISTS public.pauta_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pauta_id UUID NOT NULL REFERENCES public.pautas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pauta_comments ON public.pauta_comments(pauta_id);
ALTER TABLE public.pauta_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View pauta comments" ON public.pauta_comments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pautas p WHERE p.id = pauta_id AND public.is_org_member(auth.uid(), p.organization_id)));
CREATE POLICY "Add pauta comments" ON public.pauta_comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.pautas p WHERE p.id = pauta_id AND public.is_org_member(auth.uid(), p.organization_id)));
CREATE POLICY "Delete own pauta comments" ON public.pauta_comments FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ---- Pauta Activity ----
CREATE TABLE IF NOT EXISTS public.pauta_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pauta_id UUID NOT NULL REFERENCES public.pautas(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  from_value TEXT,
  to_value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pauta_activity ON public.pauta_activity(pauta_id);
ALTER TABLE public.pauta_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View pauta activity" ON public.pauta_activity FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pautas p WHERE p.id = pauta_id AND public.is_org_member(auth.uid(), p.organization_id)));
CREATE POLICY "Add pauta activity" ON public.pauta_activity FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.pautas p WHERE p.id = pauta_id AND public.is_org_member(auth.uid(), p.organization_id)));

-- ---- Pauta Activity Trigger ----
CREATE OR REPLACE FUNCTION public.log_pauta_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO public.pauta_activity (pauta_id, user_id, action, from_value, to_value)
      VALUES (NEW.id, auth.uid(), 'alterou status', OLD.status, NEW.status);
    END IF;
    IF OLD.priority IS DISTINCT FROM NEW.priority THEN
      INSERT INTO public.pauta_activity (pauta_id, user_id, action, from_value, to_value)
      VALUES (NEW.id, auth.uid(), 'alterou prioridade', OLD.priority, NEW.priority);
    END IF;
    IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
      INSERT INTO public.pauta_activity (pauta_id, user_id, action, from_value, to_value)
      VALUES (NEW.id, auth.uid(), 'alterou responsavel', COALESCE(OLD.assigned_to::text,'(ninguem)'), COALESCE(NEW.assigned_to::text,'(ninguem)'));
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_pauta_activity ON public.pautas;
CREATE TRIGGER trg_pauta_activity
  AFTER UPDATE ON public.pautas
  FOR EACH ROW EXECUTE FUNCTION public.log_pauta_activity();
