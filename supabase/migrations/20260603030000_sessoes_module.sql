-- ============================================================
-- MODULE: Sessoes (Photo & Video Production)
-- ============================================================

-- Sessions
CREATE TABLE public.sessoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code TEXT,
  title TEXT NOT NULL,
  scheduled_date DATE,
  professional TEXT,
  status TEXT NOT NULL DEFAULT 'planejada',
  responsaveis UUID[] DEFAULT '{}',
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessoes_org ON public.sessoes(organization_id);
CREATE INDEX idx_sessoes_date ON public.sessoes(scheduled_date);
ALTER TABLE public.sessoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view sessoes" ON public.sessoes FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Members create sessoes" ON public.sessoes FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), organization_id) AND auth.uid() = created_by);
CREATE POLICY "Members update sessoes" ON public.sessoes FOR UPDATE TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Creator or admin delete sessoes" ON public.sessoes FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR public.is_org_admin(auth.uid(), organization_id));

CREATE TRIGGER update_sessoes_updated_at
  BEFORE UPDATE ON public.sessoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Code sequence (SS-001)
CREATE TABLE public.sessao_code_seq (
  organization_id UUID PRIMARY KEY,
  last_value INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE public.sessao_code_seq ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX sessoes_org_code_uniq ON public.sessoes (organization_id, code) WHERE code IS NOT NULL;

CREATE OR REPLACE FUNCTION public.assign_sessao_code()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _next integer;
BEGIN
  IF NEW.code IS NOT NULL AND NEW.code <> '' THEN RETURN NEW; END IF;
  INSERT INTO public.sessao_code_seq (organization_id, last_value)
  VALUES (NEW.organization_id, 1)
  ON CONFLICT (organization_id)
  DO UPDATE SET last_value = public.sessao_code_seq.last_value + 1
  RETURNING last_value INTO _next;
  NEW.code := 'SS-' || lpad(_next::text, 3, '0');
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_assign_sessao_code
  BEFORE INSERT ON public.sessoes
  FOR EACH ROW EXECUTE FUNCTION public.assign_sessao_code();

-- Shots (child items of sessions)
CREATE TABLE public.sessao_shots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sessao_id UUID NOT NULL REFERENCES public.sessoes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'foto',
  status TEXT NOT NULL DEFAULT 'nao_iniciado',
  local TEXT,
  funil TEXT,
  content_type TEXT,
  modelo TEXT,
  data_entrega DATE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessao_shots ON public.sessao_shots(sessao_id);
ALTER TABLE public.sessao_shots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View shots via session" ON public.sessao_shots FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sessoes s WHERE s.id = sessao_id AND public.is_org_member(auth.uid(), s.organization_id)));
CREATE POLICY "Create shots via session" ON public.sessao_shots FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessoes s WHERE s.id = sessao_id AND public.is_org_member(auth.uid(), s.organization_id)));
CREATE POLICY "Update shots via session" ON public.sessao_shots FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sessoes s WHERE s.id = sessao_id AND public.is_org_member(auth.uid(), s.organization_id)));
CREATE POLICY "Delete shots via session" ON public.sessao_shots FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sessoes s WHERE s.id = sessao_id AND public.is_org_member(auth.uid(), s.organization_id)));

CREATE TRIGGER update_sessao_shots_updated_at
  BEFORE UPDATE ON public.sessao_shots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Contracts (photographer contracts)
CREATE TABLE public.sessao_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  photographer_name TEXT NOT NULL,
  contract_start DATE,
  contract_end DATE,
  monthly_quota_photos INTEGER DEFAULT 0,
  monthly_quota_videos INTEGER DEFAULT 0,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sessao_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view contracts" ON public.sessao_contracts FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Members create contracts" ON public.sessao_contracts FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), organization_id) AND auth.uid() = created_by);
CREATE POLICY "Members update contracts" ON public.sessao_contracts FOR UPDATE TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Creator or admin delete contracts" ON public.sessao_contracts FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR public.is_org_admin(auth.uid(), organization_id));

CREATE TRIGGER update_sessao_contracts_updated_at
  BEFORE UPDATE ON public.sessao_contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Ideas bank
CREATE TABLE public.sessao_ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT,
  status TEXT NOT NULL DEFAULT 'nova',
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sessao_ideas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view ideas" ON public.sessao_ideas FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Members create ideas" ON public.sessao_ideas FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), organization_id) AND auth.uid() = created_by);
CREATE POLICY "Members update ideas" ON public.sessao_ideas FOR UPDATE TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Creator or admin delete ideas" ON public.sessao_ideas FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR public.is_org_admin(auth.uid(), organization_id));

-- Activity log for sessions
CREATE TABLE public.sessao_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sessao_id UUID NOT NULL REFERENCES public.sessoes(id) ON DELETE CASCADE,
  user_id UUID,
  action TEXT NOT NULL,
  from_value TEXT,
  to_value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sessao_activity ON public.sessao_activity(sessao_id, created_at);
ALTER TABLE public.sessao_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View sessao activity" ON public.sessao_activity FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sessoes s WHERE s.id = sessao_id AND public.is_org_member(auth.uid(), s.organization_id)));

CREATE OR REPLACE FUNCTION public.log_sessao_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.sessao_activity (sessao_id, user_id, action, to_value)
    VALUES (NEW.id, COALESCE(_uid, NEW.created_by), 'created', NEW.title);
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.sessao_activity (sessao_id, user_id, action, from_value, to_value)
      VALUES (NEW.id, _uid, 'status', OLD.status, NEW.status);
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_log_sessao_activity_ins
  AFTER INSERT ON public.sessoes FOR EACH ROW EXECUTE FUNCTION public.log_sessao_activity();
CREATE TRIGGER trg_log_sessao_activity_upd
  AFTER UPDATE ON public.sessoes FOR EACH ROW EXECUTE FUNCTION public.log_sessao_activity();
