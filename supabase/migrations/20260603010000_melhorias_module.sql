-- ============================================================
-- MODULE: Melhorias (Site & Systems Improvements)
-- ============================================================

-- Main table
CREATE TABLE public.melhorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code TEXT,
  title TEXT NOT NULL,
  description TEXT,
  area TEXT NOT NULL DEFAULT 'site_melhorias',
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'medium',
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  data_abertura DATE NOT NULL DEFAULT CURRENT_DATE,
  data_conclusao DATE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_melhorias_org ON public.melhorias(organization_id);
CREATE INDEX idx_melhorias_status ON public.melhorias(status);
CREATE INDEX idx_melhorias_assigned ON public.melhorias(assigned_to);

ALTER TABLE public.melhorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view melhorias" ON public.melhorias FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Members create melhorias" ON public.melhorias FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), organization_id) AND auth.uid() = created_by);
CREATE POLICY "Creator assignee or admin update melhorias" ON public.melhorias FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR auth.uid() = assigned_to OR public.is_org_admin(auth.uid(), organization_id));
CREATE POLICY "Creator or admin delete melhorias" ON public.melhorias FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR public.is_org_admin(auth.uid(), organization_id));

CREATE TRIGGER update_melhorias_updated_at
  BEFORE UPDATE ON public.melhorias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Code sequence (ML-001)
CREATE TABLE public.melhoria_code_seq (
  organization_id UUID PRIMARY KEY,
  last_value INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE public.melhoria_code_seq ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX melhorias_org_code_uniq
  ON public.melhorias (organization_id, code) WHERE code IS NOT NULL;

CREATE OR REPLACE FUNCTION public.assign_melhoria_code()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _next integer;
BEGIN
  IF NEW.code IS NOT NULL AND NEW.code <> '' THEN RETURN NEW; END IF;
  INSERT INTO public.melhoria_code_seq (organization_id, last_value)
  VALUES (NEW.organization_id, 1)
  ON CONFLICT (organization_id)
  DO UPDATE SET last_value = public.melhoria_code_seq.last_value + 1
  RETURNING last_value INTO _next;
  NEW.code := 'ML-' || lpad(_next::text, 3, '0');
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_assign_melhoria_code
  BEFORE INSERT ON public.melhorias
  FOR EACH ROW EXECUTE FUNCTION public.assign_melhoria_code();

-- Comments
CREATE TABLE public.melhoria_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  melhoria_id UUID NOT NULL REFERENCES public.melhorias(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_melhoria_comments ON public.melhoria_comments(melhoria_id);
ALTER TABLE public.melhoria_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View melhoria comments" ON public.melhoria_comments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.melhorias m WHERE m.id = melhoria_id AND public.is_org_member(auth.uid(), m.organization_id)));
CREATE POLICY "Add melhoria comments" ON public.melhoria_comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.melhorias m WHERE m.id = melhoria_id AND public.is_org_member(auth.uid(), m.organization_id)));
CREATE POLICY "Delete own melhoria comments" ON public.melhoria_comments FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Attachments
CREATE TABLE public.melhoria_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  melhoria_id UUID NOT NULL REFERENCES public.melhorias(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.melhoria_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View melhoria attachments" ON public.melhoria_attachments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.melhorias m WHERE m.id = melhoria_id AND public.is_org_member(auth.uid(), m.organization_id)));
CREATE POLICY "Add melhoria attachments" ON public.melhoria_attachments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Delete own melhoria attachments" ON public.melhoria_attachments FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Activity log
CREATE TABLE public.melhoria_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  melhoria_id UUID NOT NULL REFERENCES public.melhorias(id) ON DELETE CASCADE,
  user_id UUID,
  action TEXT NOT NULL,
  from_value TEXT,
  to_value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_melhoria_activity ON public.melhoria_activity(melhoria_id, created_at);
ALTER TABLE public.melhoria_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View melhoria activity" ON public.melhoria_activity FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.melhorias m WHERE m.id = melhoria_id AND public.is_org_member(auth.uid(), m.organization_id)));

CREATE OR REPLACE FUNCTION public.log_melhoria_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.melhoria_activity (melhoria_id, user_id, action, to_value)
    VALUES (NEW.id, COALESCE(_uid, NEW.created_by), 'created', NEW.title);
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.melhoria_activity (melhoria_id, user_id, action, from_value, to_value)
      VALUES (NEW.id, _uid, 'status', OLD.status, NEW.status);
    END IF;
    IF NEW.priority IS DISTINCT FROM OLD.priority THEN
      INSERT INTO public.melhoria_activity (melhoria_id, user_id, action, from_value, to_value)
      VALUES (NEW.id, _uid, 'priority', OLD.priority, NEW.priority);
    END IF;
    IF NEW.area IS DISTINCT FROM OLD.area THEN
      INSERT INTO public.melhoria_activity (melhoria_id, user_id, action, from_value, to_value)
      VALUES (NEW.id, _uid, 'area', OLD.area, NEW.area);
    END IF;
    IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
      INSERT INTO public.melhoria_activity (melhoria_id, user_id, action, from_value, to_value)
      VALUES (NEW.id, _uid, 'assigned', COALESCE(OLD.assigned_to::text,''), COALESCE(NEW.assigned_to::text,''));
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_log_melhoria_activity_ins
  AFTER INSERT ON public.melhorias FOR EACH ROW EXECUTE FUNCTION public.log_melhoria_activity();
CREATE TRIGGER trg_log_melhoria_activity_upd
  AFTER UPDATE ON public.melhorias FOR EACH ROW EXECUTE FUNCTION public.log_melhoria_activity();

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('melhoria-attachments', 'melhoria-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Auth upload melhoria attachments" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'melhoria-attachments' AND auth.role() = 'authenticated');
CREATE POLICY "Auth read melhoria attachments" ON storage.objects FOR SELECT
  USING (bucket_id = 'melhoria-attachments' AND auth.role() = 'authenticated');
CREATE POLICY "Auth delete own melhoria attachments" ON storage.objects FOR DELETE
  USING (bucket_id = 'melhoria-attachments' AND auth.role() = 'authenticated');
