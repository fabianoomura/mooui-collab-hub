-- ============================================================
-- MODULE: Calendario Etapas (event execution checklist)
-- ============================================================

CREATE TABLE public.annual_event_etapas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.annual_events(id) ON DELETE CASCADE,
  etapa_key TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  responsavel UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, etapa_key)
);

CREATE INDEX idx_annual_event_etapas_event ON public.annual_event_etapas(event_id);
ALTER TABLE public.annual_event_etapas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View event etapas" ON public.annual_event_etapas FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.annual_events e
    WHERE e.id = event_id AND public.is_org_member(auth.uid(), e.organization_id)
  ));

CREATE POLICY "Create event etapas" ON public.annual_event_etapas FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.annual_events e
    WHERE e.id = event_id AND public.is_org_member(auth.uid(), e.organization_id)
  ));

CREATE POLICY "Update event etapas" ON public.annual_event_etapas FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.annual_events e
    WHERE e.id = event_id AND public.is_org_member(auth.uid(), e.organization_id)
  ));

CREATE POLICY "Delete event etapas" ON public.annual_event_etapas FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.annual_events e
    WHERE e.id = event_id AND public.is_org_member(auth.uid(), e.organization_id)
  ));

CREATE TRIGGER update_annual_event_etapas_updated_at
  BEFORE UPDATE ON public.annual_event_etapas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
