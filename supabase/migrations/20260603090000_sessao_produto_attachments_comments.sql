-- ============================================================
-- Attachments & Comments for Sessoes and Produto modules
-- ============================================================

-- ---- SESSAO COMMENTS ----
CREATE TABLE IF NOT EXISTS public.sessao_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sessao_id UUID NOT NULL REFERENCES public.sessoes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sessao_comments ON public.sessao_comments(sessao_id);
ALTER TABLE public.sessao_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View sessao comments" ON public.sessao_comments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sessoes s WHERE s.id = sessao_id AND public.is_org_member(auth.uid(), s.organization_id)));
CREATE POLICY "Add sessao comments" ON public.sessao_comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.sessoes s WHERE s.id = sessao_id AND public.is_org_member(auth.uid(), s.organization_id)));
CREATE POLICY "Delete own sessao comments" ON public.sessao_comments FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ---- SESSAO ATTACHMENTS ----
CREATE TABLE IF NOT EXISTS public.sessao_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sessao_id UUID NOT NULL REFERENCES public.sessoes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sessao_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View sessao attachments" ON public.sessao_attachments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sessoes s WHERE s.id = sessao_id AND public.is_org_member(auth.uid(), s.organization_id)));
CREATE POLICY "Add sessao attachments" ON public.sessao_attachments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Delete own sessao attachments" ON public.sessao_attachments FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('sessao-attachments', 'sessao-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Org members upload sessao files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'sessao-attachments');
CREATE POLICY "Org members read sessao files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'sessao-attachments');
CREATE POLICY "Owner delete sessao files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'sessao-attachments' AND (storage.foldername(name))[1] IS NOT NULL);

-- ---- PRODUTO COMMENTS ----
CREATE TABLE IF NOT EXISTS public.produto_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_produto_comments ON public.produto_comments(produto_id);
ALTER TABLE public.produto_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View produto comments" ON public.produto_comments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.produtos p WHERE p.id = produto_id AND public.is_org_member(auth.uid(), p.organization_id)));
CREATE POLICY "Add produto comments" ON public.produto_comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.produtos p WHERE p.id = produto_id AND public.is_org_member(auth.uid(), p.organization_id)));
CREATE POLICY "Delete own produto comments" ON public.produto_comments FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ---- PRODUTO ATTACHMENTS ----
CREATE TABLE IF NOT EXISTS public.produto_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.produto_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View produto attachments" ON public.produto_attachments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.produtos p WHERE p.id = produto_id AND public.is_org_member(auth.uid(), p.organization_id)));
CREATE POLICY "Add produto attachments" ON public.produto_attachments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Delete own produto attachments" ON public.produto_attachments FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('produto-attachments', 'produto-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Org members upload produto files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'produto-attachments');
CREATE POLICY "Org members read produto files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'produto-attachments');
CREATE POLICY "Owner delete produto files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'produto-attachments' AND (storage.foldername(name))[1] IS NOT NULL);
