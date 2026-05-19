
-- 1) Sequência de código por organização
CREATE TABLE IF NOT EXISTS public.ticket_code_seq (
  organization_id uuid PRIMARY KEY,
  last_value integer NOT NULL DEFAULT 0
);
ALTER TABLE public.ticket_code_seq ENABLE ROW LEVEL SECURITY;
-- Sem políticas: só funções SECURITY DEFINER tocam essa tabela.

-- 2) Coluna code em tickets
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS code text;
CREATE UNIQUE INDEX IF NOT EXISTS tickets_org_code_uniq
  ON public.tickets (organization_id, code) WHERE code IS NOT NULL;

-- 3) Função + trigger para gerar TI-XXX
CREATE OR REPLACE FUNCTION public.assign_ticket_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _next integer;
BEGIN
  IF NEW.code IS NOT NULL AND NEW.code <> '' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.ticket_code_seq (organization_id, last_value)
  VALUES (NEW.organization_id, 1)
  ON CONFLICT (organization_id)
  DO UPDATE SET last_value = public.ticket_code_seq.last_value + 1
  RETURNING last_value INTO _next;

  NEW.code := 'TI-' || lpad(_next::text, 3, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_ticket_code ON public.tickets;
CREATE TRIGGER trg_assign_ticket_code
  BEFORE INSERT ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.assign_ticket_code();

-- 4) Backfill códigos para tickets existentes (por org, ordenado por criação)
DO $$
DECLARE
  _org uuid;
  _row record;
  _n integer;
BEGIN
  FOR _org IN SELECT DISTINCT organization_id FROM public.tickets WHERE code IS NULL LOOP
    SELECT COALESCE(last_value, 0) INTO _n FROM public.ticket_code_seq WHERE organization_id = _org;
    IF _n IS NULL THEN _n := 0; END IF;
    FOR _row IN
      SELECT id FROM public.tickets
      WHERE organization_id = _org AND code IS NULL
      ORDER BY created_at ASC
    LOOP
      _n := _n + 1;
      UPDATE public.tickets SET code = 'TI-' || lpad(_n::text, 3, '0') WHERE id = _row.id;
    END LOOP;
    INSERT INTO public.ticket_code_seq (organization_id, last_value)
    VALUES (_org, _n)
    ON CONFLICT (organization_id) DO UPDATE SET last_value = EXCLUDED.last_value;
  END LOOP;
END $$;

-- 5) Tabela de histórico
CREATE TABLE IF NOT EXISTS public.ticket_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  user_id uuid,
  action text NOT NULL,        -- created | status | priority | category | assigned | title | description
  from_value text,
  to_value text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ticket_activity_ticket_idx
  ON public.ticket_activity (ticket_id, created_at);

ALTER TABLE public.ticket_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View ticket activity if org member" ON public.ticket_activity;
CREATE POLICY "View ticket activity if org member"
ON public.ticket_activity FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.tickets t
  WHERE t.id = ticket_activity.ticket_id
    AND public.is_org_member(auth.uid(), t.organization_id)
));

-- 6) Trigger que registra mudanças
CREATE OR REPLACE FUNCTION public.log_ticket_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.ticket_activity (ticket_id, user_id, action, to_value)
    VALUES (NEW.id, COALESCE(_uid, NEW.created_by), 'created', NEW.title);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.ticket_activity (ticket_id, user_id, action, from_value, to_value)
      VALUES (NEW.id, _uid, 'status', OLD.status::text, NEW.status::text);
    END IF;
    IF NEW.priority IS DISTINCT FROM OLD.priority THEN
      INSERT INTO public.ticket_activity (ticket_id, user_id, action, from_value, to_value)
      VALUES (NEW.id, _uid, 'priority', OLD.priority::text, NEW.priority::text);
    END IF;
    IF NEW.category IS DISTINCT FROM OLD.category THEN
      INSERT INTO public.ticket_activity (ticket_id, user_id, action, from_value, to_value)
      VALUES (NEW.id, _uid, 'category', OLD.category::text, NEW.category::text);
    END IF;
    IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
      INSERT INTO public.ticket_activity (ticket_id, user_id, action, from_value, to_value)
      VALUES (NEW.id, _uid, 'assigned',
              COALESCE(OLD.assigned_to::text, ''), COALESCE(NEW.assigned_to::text, ''));
    END IF;
    IF NEW.title IS DISTINCT FROM OLD.title THEN
      INSERT INTO public.ticket_activity (ticket_id, user_id, action, from_value, to_value)
      VALUES (NEW.id, _uid, 'title', OLD.title, NEW.title);
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_ticket_activity_ins ON public.tickets;
CREATE TRIGGER trg_log_ticket_activity_ins
  AFTER INSERT ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.log_ticket_activity();

DROP TRIGGER IF EXISTS trg_log_ticket_activity_upd ON public.tickets;
CREATE TRIGGER trg_log_ticket_activity_upd
  AFTER UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.log_ticket_activity();
