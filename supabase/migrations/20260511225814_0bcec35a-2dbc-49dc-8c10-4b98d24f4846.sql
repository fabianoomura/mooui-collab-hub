
-- Documentation module: hierarchical pages per organization
CREATE TABLE public.doc_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  parent_id UUID REFERENCES public.doc_pages(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Sem título',
  content TEXT,
  icon TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_doc_pages_org ON public.doc_pages(organization_id);
CREATE INDEX idx_doc_pages_parent ON public.doc_pages(parent_id);

ALTER TABLE public.doc_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view doc pages"
ON public.doc_pages FOR SELECT TO authenticated
USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can create doc pages"
ON public.doc_pages FOR INSERT TO authenticated
WITH CHECK (public.is_org_member(auth.uid(), organization_id) AND auth.uid() = created_by);

CREATE POLICY "Org members can update doc pages"
ON public.doc_pages FOR UPDATE TO authenticated
USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Creator or admin can delete doc pages"
ON public.doc_pages FOR DELETE TO authenticated
USING (auth.uid() = created_by OR public.is_org_admin(auth.uid(), organization_id));

CREATE TRIGGER update_doc_pages_updated_at
BEFORE UPDATE ON public.doc_pages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
