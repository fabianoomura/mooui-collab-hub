-- ============================================================
-- MODULE: Conteudo (Content Hub & Social Media)
-- ============================================================

-- Content items (social media posts)
CREATE TABLE public.conteudo_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code TEXT,
  title TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'mooui_kids',
  scheduled_date DATE,
  time_slot TEXT,
  status TEXT NOT NULL DEFAULT 'nao_iniciado',
  content_type TEXT NOT NULL DEFAULT 'foto',
  is_repost BOOLEAN NOT NULL DEFAULT false,
  content_category TEXT,
  photo_url TEXT,
  notes TEXT,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_conteudo_items_org ON public.conteudo_items(organization_id);
CREATE INDEX idx_conteudo_items_channel ON public.conteudo_items(channel);
CREATE INDEX idx_conteudo_items_date ON public.conteudo_items(scheduled_date);
ALTER TABLE public.conteudo_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view conteudo" ON public.conteudo_items FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Members create conteudo" ON public.conteudo_items FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), organization_id) AND auth.uid() = created_by);
CREATE POLICY "Creator assignee or admin update conteudo" ON public.conteudo_items FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR auth.uid() = assigned_to OR public.is_org_admin(auth.uid(), organization_id));
CREATE POLICY "Creator or admin delete conteudo" ON public.conteudo_items FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR public.is_org_admin(auth.uid(), organization_id));

CREATE TRIGGER update_conteudo_items_updated_at
  BEFORE UPDATE ON public.conteudo_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Code sequence (CT-001)
CREATE TABLE public.conteudo_code_seq (
  organization_id UUID PRIMARY KEY,
  last_value INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE public.conteudo_code_seq ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX conteudo_org_code_uniq ON public.conteudo_items (organization_id, code) WHERE code IS NOT NULL;

CREATE OR REPLACE FUNCTION public.assign_conteudo_code()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _next integer;
BEGIN
  IF NEW.code IS NOT NULL AND NEW.code <> '' THEN RETURN NEW; END IF;
  INSERT INTO public.conteudo_code_seq (organization_id, last_value)
  VALUES (NEW.organization_id, 1)
  ON CONFLICT (organization_id)
  DO UPDATE SET last_value = public.conteudo_code_seq.last_value + 1
  RETURNING last_value INTO _next;
  NEW.code := 'CT-' || lpad(_next::text, 3, '0');
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_assign_conteudo_code
  BEFORE INSERT ON public.conteudo_items
  FOR EACH ROW EXECUTE FUNCTION public.assign_conteudo_code();

-- Newsletters
CREATE TABLE public.newsletters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  scheduled_date DATE,
  status TEXT NOT NULL DEFAULT 'nao_iniciado',
  tema TEXT,
  base TEXT,
  hora TEXT,
  titulo_email TEXT,
  open_rate NUMERIC(5,2),
  click_rate NUMERIC(5,2),
  channel TEXT NOT NULL DEFAULT 'brasil',
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_newsletters_org ON public.newsletters(organization_id);
ALTER TABLE public.newsletters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view newsletters" ON public.newsletters FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Members create newsletters" ON public.newsletters FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), organization_id) AND auth.uid() = created_by);
CREATE POLICY "Members update newsletters" ON public.newsletters FOR UPDATE TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Creator or admin delete newsletters" ON public.newsletters FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR public.is_org_admin(auth.uid(), organization_id));

CREATE TRIGGER update_newsletters_updated_at
  BEFORE UPDATE ON public.newsletters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Pautas (editorial demands)
CREATE TABLE public.pautas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'pendente',
  scheduled_date DATE,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.pauta_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pauta_id UUID NOT NULL REFERENCES public.pautas(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pautas_org ON public.pautas(organization_id);
CREATE INDEX idx_pauta_items ON public.pauta_items(pauta_id);
ALTER TABLE public.pautas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pauta_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view pautas" ON public.pautas FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Members create pautas" ON public.pautas FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), organization_id) AND auth.uid() = created_by);
CREATE POLICY "Members update pautas" ON public.pautas FOR UPDATE TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Creator or admin delete pautas" ON public.pautas FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR public.is_org_admin(auth.uid(), organization_id));

CREATE POLICY "View pauta items" ON public.pauta_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pautas p WHERE p.id = pauta_id AND public.is_org_member(auth.uid(), p.organization_id)));
CREATE POLICY "Create pauta items" ON public.pauta_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.pautas p WHERE p.id = pauta_id AND public.is_org_member(auth.uid(), p.organization_id)));
CREATE POLICY "Update pauta items" ON public.pauta_items FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pautas p WHERE p.id = pauta_id AND public.is_org_member(auth.uid(), p.organization_id)));
CREATE POLICY "Delete pauta items" ON public.pauta_items FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pautas p WHERE p.id = pauta_id AND public.is_org_member(auth.uid(), p.organization_id)));

CREATE TRIGGER update_pautas_updated_at
  BEFORE UPDATE ON public.pautas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Activity log for conteudo
CREATE TABLE public.conteudo_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conteudo_item_id UUID NOT NULL REFERENCES public.conteudo_items(id) ON DELETE CASCADE,
  user_id UUID,
  action TEXT NOT NULL,
  from_value TEXT,
  to_value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_conteudo_activity ON public.conteudo_activity(conteudo_item_id, created_at);
ALTER TABLE public.conteudo_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View conteudo activity" ON public.conteudo_activity FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.conteudo_items c WHERE c.id = conteudo_item_id AND public.is_org_member(auth.uid(), c.organization_id)));

CREATE OR REPLACE FUNCTION public.log_conteudo_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.conteudo_activity (conteudo_item_id, user_id, action, to_value)
    VALUES (NEW.id, COALESCE(_uid, NEW.created_by), 'created', NEW.title);
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.conteudo_activity (conteudo_item_id, user_id, action, from_value, to_value)
      VALUES (NEW.id, _uid, 'status', OLD.status, NEW.status);
    END IF;
    IF NEW.channel IS DISTINCT FROM OLD.channel THEN
      INSERT INTO public.conteudo_activity (conteudo_item_id, user_id, action, from_value, to_value)
      VALUES (NEW.id, _uid, 'channel', OLD.channel, NEW.channel);
    END IF;
    IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
      INSERT INTO public.conteudo_activity (conteudo_item_id, user_id, action, from_value, to_value)
      VALUES (NEW.id, _uid, 'assigned', COALESCE(OLD.assigned_to::text,''), COALESCE(NEW.assigned_to::text,''));
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_log_conteudo_activity_ins
  AFTER INSERT ON public.conteudo_items FOR EACH ROW EXECUTE FUNCTION public.log_conteudo_activity();
CREATE TRIGGER trg_log_conteudo_activity_upd
  AFTER UPDATE ON public.conteudo_items FOR EACH ROW EXECUTE FUNCTION public.log_conteudo_activity();
