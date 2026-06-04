-- ============================================================
-- Comments for Conteudo module
-- ============================================================

CREATE TABLE IF NOT EXISTS public.conteudo_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conteudo_item_id UUID NOT NULL REFERENCES public.conteudo_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_conteudo_comments ON public.conteudo_comments(conteudo_item_id);
ALTER TABLE public.conteudo_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View conteudo comments" ON public.conteudo_comments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.conteudo_items c WHERE c.id = conteudo_item_id AND public.is_org_member(auth.uid(), c.organization_id)));
CREATE POLICY "Add conteudo comments" ON public.conteudo_comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.conteudo_items c WHERE c.id = conteudo_item_id AND public.is_org_member(auth.uid(), c.organization_id)));
CREATE POLICY "Delete own conteudo comments" ON public.conteudo_comments FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
