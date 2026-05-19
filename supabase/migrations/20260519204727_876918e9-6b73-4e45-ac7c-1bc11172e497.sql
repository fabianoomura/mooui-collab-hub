-- Enums
CREATE TYPE public.order_status AS ENUM ('open', 'in_progress', 'waiting', 'sent', 'done', 'cancelled');
CREATE TYPE public.order_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE public.order_problem AS ENUM ('furo_estoque', 'aguardando_itens', 'aguardar_envio', 'presente', 'troca', 'devolucao', 'endereco', 'outro');
CREATE TYPE public.order_source AS ENUM ('expedicao', 'atendimento', 'marketing', 'outro');

-- Orders table
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  code TEXT,
  shopify_order TEXT,
  totvs_order TEXT,
  customer_name TEXT,
  problem_type public.order_problem NOT NULL DEFAULT 'outro',
  source public.order_source NOT NULL DEFAULT 'expedicao',
  status public.order_status NOT NULL DEFAULT 'open',
  priority public.order_priority NOT NULL DEFAULT 'medium',
  title TEXT NOT NULL,
  description TEXT,
  notes TEXT,
  assigned_to UUID,
  created_by UUID NOT NULL,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT orders_has_external_code CHECK (
    (shopify_order IS NOT NULL AND shopify_order <> '') OR
    (totvs_order IS NOT NULL AND totvs_order <> '')
  )
);

CREATE INDEX idx_orders_org ON public.orders(organization_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_assigned ON public.orders(assigned_to);

-- Code sequence
CREATE TABLE public.order_code_seq (
  organization_id UUID PRIMARY KEY,
  last_value INTEGER NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION public.assign_order_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _next integer;
BEGIN
  IF NEW.code IS NOT NULL AND NEW.code <> '' THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.order_code_seq (organization_id, last_value)
  VALUES (NEW.organization_id, 1)
  ON CONFLICT (organization_id)
  DO UPDATE SET last_value = public.order_code_seq.last_value + 1
  RETURNING last_value INTO _next;
  NEW.code := 'PD-' || lpad(_next::text, 3, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER orders_assign_code
BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.assign_order_code();

CREATE TRIGGER orders_set_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Comments
CREATE TABLE public.order_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_order_comments_order ON public.order_comments(order_id);

CREATE TRIGGER order_comments_set_updated_at
BEFORE UPDATE ON public.order_comments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Activity log
CREATE TABLE public.order_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id UUID,
  action TEXT NOT NULL,
  from_value TEXT,
  to_value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_order_activity_order ON public.order_activity(order_id);

CREATE OR REPLACE FUNCTION public.log_order_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.order_activity (order_id, user_id, action, to_value)
    VALUES (NEW.id, COALESCE(_uid, NEW.created_by), 'created', NEW.title);
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.order_activity (order_id, user_id, action, from_value, to_value)
      VALUES (NEW.id, _uid, 'status', OLD.status::text, NEW.status::text);
      IF NEW.status IN ('sent','done','cancelled') AND OLD.status NOT IN ('sent','done','cancelled') THEN
        NEW.closed_at := now();
      ELSIF NEW.status NOT IN ('sent','done','cancelled') THEN
        NEW.closed_at := NULL;
      END IF;
    END IF;
    IF NEW.priority IS DISTINCT FROM OLD.priority THEN
      INSERT INTO public.order_activity (order_id, user_id, action, from_value, to_value)
      VALUES (NEW.id, _uid, 'priority', OLD.priority::text, NEW.priority::text);
    END IF;
    IF NEW.problem_type IS DISTINCT FROM OLD.problem_type THEN
      INSERT INTO public.order_activity (order_id, user_id, action, from_value, to_value)
      VALUES (NEW.id, _uid, 'problem_type', OLD.problem_type::text, NEW.problem_type::text);
    END IF;
    IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
      INSERT INTO public.order_activity (order_id, user_id, action, from_value, to_value)
      VALUES (NEW.id, _uid, 'assigned', COALESCE(OLD.assigned_to::text,''), COALESCE(NEW.assigned_to::text,''));
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER orders_log_activity_ins
AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.log_order_activity();

CREATE TRIGGER orders_log_activity_upd
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.log_order_activity();

-- RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_code_seq ENABLE ROW LEVEL SECURITY;

-- Orders policies
CREATE POLICY "Members view orders" ON public.orders FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Members create orders" ON public.orders FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), organization_id) AND auth.uid() = created_by);
CREATE POLICY "Creator assignee or admin update orders" ON public.orders FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR auth.uid() = assigned_to OR public.is_org_admin(auth.uid(), organization_id) OR public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Creator or admin delete orders" ON public.orders FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR public.is_org_admin(auth.uid(), organization_id));

-- Comments policies
CREATE POLICY "View order comments" ON public.order_comments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND public.is_org_member(auth.uid(), o.organization_id)));
CREATE POLICY "Add order comments" ON public.order_comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND public.is_org_member(auth.uid(), o.organization_id)));
CREATE POLICY "Update own order comments" ON public.order_comments FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Delete own order comments" ON public.order_comments FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Activity policies
CREATE POLICY "View order activity" ON public.order_activity FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND public.is_org_member(auth.uid(), o.organization_id)));

-- Code seq policies (managed by trigger as SECURITY DEFINER but enable RLS to satisfy linter)
CREATE POLICY "Members read order code seq" ON public.order_code_seq FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));