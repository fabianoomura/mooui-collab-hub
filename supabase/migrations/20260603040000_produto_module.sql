-- ============================================================
-- MODULE: Produto (Product Development Pipeline)
-- ============================================================

-- Products
CREATE TABLE public.produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code TEXT,
  name TEXT NOT NULL,
  collection_group TEXT NOT NULL DEFAULT 'novas_ideias',
  responsible UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  launch_target DATE,
  cronograma_start DATE,
  cronograma_end DATE,
  observations TEXT,
  progress INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_produtos_org ON public.produtos(organization_id);
CREATE INDEX idx_produtos_group ON public.produtos(collection_group);
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view produtos" ON public.produtos FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Members create produtos" ON public.produtos FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), organization_id) AND auth.uid() = created_by);
CREATE POLICY "Members update produtos" ON public.produtos FOR UPDATE TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Creator or admin delete produtos" ON public.produtos FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR public.is_org_admin(auth.uid(), organization_id));

CREATE TRIGGER update_produtos_updated_at
  BEFORE UPDATE ON public.produtos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Code sequence (PR-001)
CREATE TABLE public.produto_code_seq (
  organization_id UUID PRIMARY KEY,
  last_value INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE public.produto_code_seq ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX produtos_org_code_uniq ON public.produtos (organization_id, code) WHERE code IS NOT NULL;

CREATE OR REPLACE FUNCTION public.assign_produto_code()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _next integer;
BEGIN
  IF NEW.code IS NOT NULL AND NEW.code <> '' THEN RETURN NEW; END IF;
  INSERT INTO public.produto_code_seq (organization_id, last_value)
  VALUES (NEW.organization_id, 1)
  ON CONFLICT (organization_id)
  DO UPDATE SET last_value = public.produto_code_seq.last_value + 1
  RETURNING last_value INTO _next;
  NEW.code := 'PR-' || lpad(_next::text, 3, '0');
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_assign_produto_code
  BEFORE INSERT ON public.produtos
  FOR EACH ROW EXECUTE FUNCTION public.assign_produto_code();

-- Pipeline stages (15 per product, auto-seeded)
CREATE TABLE public.produto_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  stage_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'nao_iniciado',
  assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at DATE,
  notes TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(produto_id, stage_key)
);

CREATE INDEX idx_produto_stages ON public.produto_stages(produto_id);
ALTER TABLE public.produto_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View produto stages" ON public.produto_stages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.produtos p WHERE p.id = produto_id AND public.is_org_member(auth.uid(), p.organization_id)));
CREATE POLICY "Create produto stages" ON public.produto_stages FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.produtos p WHERE p.id = produto_id AND public.is_org_member(auth.uid(), p.organization_id)));
CREATE POLICY "Update produto stages" ON public.produto_stages FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.produtos p WHERE p.id = produto_id AND public.is_org_member(auth.uid(), p.organization_id)));
CREATE POLICY "Delete produto stages" ON public.produto_stages FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.produtos p WHERE p.id = produto_id AND public.is_org_member(auth.uid(), p.organization_id)));

CREATE TRIGGER update_produto_stages_updated_at
  BEFORE UPDATE ON public.produto_stages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-seed 15 stages on product creation
CREATE OR REPLACE FUNCTION public.seed_produto_stages()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _stages TEXT[] := ARRAY[
    'definicao_produto','prospeccao_fornecedores','validacao_pre_custo',
    'design_estampa','peca_piloto','aprovacao','embalagem',
    'fornecedor_aprovado','ficha_tecnica','rapport','mostruario_foto',
    'producao','fotos','entrega_pd','apresentacao'
  ];
  _i INTEGER;
BEGIN
  FOR _i IN 1..array_length(_stages, 1) LOOP
    INSERT INTO public.produto_stages (produto_id, stage_key, position)
    VALUES (NEW.id, _stages[_i], _i);
  END LOOP;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_seed_produto_stages
  AFTER INSERT ON public.produtos
  FOR EACH ROW EXECUTE FUNCTION public.seed_produto_stages();

-- Auto-calculate progress when stages change
CREATE OR REPLACE FUNCTION public.update_produto_progress()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _total INTEGER;
  _done INTEGER;
  _pct INTEGER;
BEGIN
  SELECT count(*), count(*) FILTER (WHERE status = 'finalizado')
  INTO _total, _done
  FROM public.produto_stages WHERE produto_id = NEW.produto_id;

  IF _total > 0 THEN
    _pct := round((_done::numeric / _total::numeric) * 100);
  ELSE
    _pct := 0;
  END IF;

  UPDATE public.produtos SET progress = _pct WHERE id = NEW.produto_id;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_update_produto_progress
  AFTER INSERT OR UPDATE ON public.produto_stages
  FOR EACH ROW EXECUTE FUNCTION public.update_produto_progress();

-- Design variations (sub-items)
CREATE TABLE public.produto_design_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  qt_variacoes INTEGER DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pendente',
  target_date DATE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_produto_design_items ON public.produto_design_items(produto_id);
ALTER TABLE public.produto_design_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View design items" ON public.produto_design_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.produtos p WHERE p.id = produto_id AND public.is_org_member(auth.uid(), p.organization_id)));
CREATE POLICY "Create design items" ON public.produto_design_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.produtos p WHERE p.id = produto_id AND public.is_org_member(auth.uid(), p.organization_id)));
CREATE POLICY "Update design items" ON public.produto_design_items FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.produtos p WHERE p.id = produto_id AND public.is_org_member(auth.uid(), p.organization_id)));
CREATE POLICY "Delete design items" ON public.produto_design_items FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.produtos p WHERE p.id = produto_id AND public.is_org_member(auth.uid(), p.organization_id)));

CREATE TRIGGER update_produto_design_items_updated_at
  BEFORE UPDATE ON public.produto_design_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Activity log
CREATE TABLE public.produto_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  user_id UUID,
  action TEXT NOT NULL,
  from_value TEXT,
  to_value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_produto_activity ON public.produto_activity(produto_id, created_at);
ALTER TABLE public.produto_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View produto activity" ON public.produto_activity FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.produtos p WHERE p.id = produto_id AND public.is_org_member(auth.uid(), p.organization_id)));

CREATE OR REPLACE FUNCTION public.log_produto_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.produto_activity (produto_id, user_id, action, to_value)
    VALUES (NEW.id, COALESCE(_uid, NEW.created_by), 'created', NEW.name);
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.collection_group IS DISTINCT FROM OLD.collection_group THEN
      INSERT INTO public.produto_activity (produto_id, user_id, action, from_value, to_value)
      VALUES (NEW.id, _uid, 'collection', OLD.collection_group, NEW.collection_group);
    END IF;
    IF NEW.responsible IS DISTINCT FROM OLD.responsible THEN
      INSERT INTO public.produto_activity (produto_id, user_id, action, from_value, to_value)
      VALUES (NEW.id, _uid, 'responsible', COALESCE(OLD.responsible::text,''), COALESCE(NEW.responsible::text,''));
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_log_produto_activity_ins
  AFTER INSERT ON public.produtos FOR EACH ROW EXECUTE FUNCTION public.log_produto_activity();
CREATE TRIGGER trg_log_produto_activity_upd
  AFTER UPDATE ON public.produtos FOR EACH ROW EXECUTE FUNCTION public.log_produto_activity();

-- Stage activity trigger (logs individual stage status changes)
CREATE OR REPLACE FUNCTION public.log_produto_stage_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.produto_activity (produto_id, user_id, action, from_value, to_value)
    VALUES (NEW.produto_id, _uid, 'stage_' || NEW.stage_key, OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_log_produto_stage_activity
  AFTER UPDATE ON public.produto_stages
  FOR EACH ROW EXECUTE FUNCTION public.log_produto_stage_activity();
