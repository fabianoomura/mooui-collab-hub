-- Conteudo element project controls and media attachments

CREATE TABLE IF NOT EXISTS public.conteudo_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conteudo_item_id UUID NOT NULL REFERENCES public.conteudo_items(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  due_date DATE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conteudo_checklist_items
  ON public.conteudo_checklist_items(conteudo_item_id, position);

ALTER TABLE public.conteudo_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View conteudo checklist items"
  ON public.conteudo_checklist_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conteudo_items c
      WHERE c.id = conteudo_item_id
        AND public.is_org_member(auth.uid(), c.organization_id)
    )
  );

CREATE POLICY "Create conteudo checklist items"
  ON public.conteudo_checklist_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conteudo_items c
      WHERE c.id = conteudo_item_id
        AND public.is_org_member(auth.uid(), c.organization_id)
    )
  );

CREATE POLICY "Update conteudo checklist items"
  ON public.conteudo_checklist_items FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conteudo_items c
      WHERE c.id = conteudo_item_id
        AND public.is_org_member(auth.uid(), c.organization_id)
    )
  );

CREATE POLICY "Delete conteudo checklist items"
  ON public.conteudo_checklist_items FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conteudo_items c
      WHERE c.id = conteudo_item_id
        AND public.is_org_member(auth.uid(), c.organization_id)
    )
  );

DROP TRIGGER IF EXISTS update_conteudo_checklist_items_updated_at ON public.conteudo_checklist_items;
CREATE TRIGGER update_conteudo_checklist_items_updated_at
  BEFORE UPDATE ON public.conteudo_checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.conteudo_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conteudo_item_id UUID NOT NULL REFERENCES public.conteudo_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conteudo_attachments
  ON public.conteudo_attachments(conteudo_item_id, created_at DESC);

ALTER TABLE public.conteudo_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View conteudo attachments"
  ON public.conteudo_attachments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conteudo_items c
      WHERE c.id = conteudo_item_id
        AND public.is_org_member(auth.uid(), c.organization_id)
    )
  );

CREATE POLICY "Add conteudo attachments"
  ON public.conteudo_attachments FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.conteudo_items c
      WHERE c.id = conteudo_item_id
        AND public.is_org_member(auth.uid(), c.organization_id)
    )
  );

CREATE POLICY "Delete own conteudo attachments"
  ON public.conteudo_attachments FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

INSERT INTO storage.buckets (id, name, public)
VALUES ('conteudo-attachments', 'conteudo-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Auth upload conteudo attachments" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'conteudo-attachments' AND auth.role() = 'authenticated');
CREATE POLICY "Auth read conteudo attachments" ON storage.objects FOR SELECT
  USING (bucket_id = 'conteudo-attachments' AND auth.role() = 'authenticated');
CREATE POLICY "Auth delete conteudo attachments" ON storage.objects FOR DELETE
  USING (bucket_id = 'conteudo-attachments' AND auth.role() = 'authenticated');
