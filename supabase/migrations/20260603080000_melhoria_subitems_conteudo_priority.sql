-- ============================================================
-- PASSO 1: Conteudo checklist_items + attachments (se não existem)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.conteudo_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conteudo_item_id UUID NOT NULL REFERENCES public.conteudo_items(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  priority TEXT NOT NULL DEFAULT 'medium',
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  due_date DATE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conteudo_checklist_items
  ON public.conteudo_checklist_items(conteudo_item_id, position);

ALTER TABLE public.conteudo_checklist_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conteudo_checklist_items' AND policyname = 'View conteudo checklist items') THEN
    CREATE POLICY "View conteudo checklist items" ON public.conteudo_checklist_items FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.conteudo_items c WHERE c.id = conteudo_item_id AND public.is_org_member(auth.uid(), c.organization_id)));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conteudo_checklist_items' AND policyname = 'Create conteudo checklist items') THEN
    CREATE POLICY "Create conteudo checklist items" ON public.conteudo_checklist_items FOR INSERT TO authenticated
      WITH CHECK (EXISTS (SELECT 1 FROM public.conteudo_items c WHERE c.id = conteudo_item_id AND public.is_org_member(auth.uid(), c.organization_id)));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conteudo_checklist_items' AND policyname = 'Update conteudo checklist items') THEN
    CREATE POLICY "Update conteudo checklist items" ON public.conteudo_checklist_items FOR UPDATE TO authenticated
      USING (EXISTS (SELECT 1 FROM public.conteudo_items c WHERE c.id = conteudo_item_id AND public.is_org_member(auth.uid(), c.organization_id)));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conteudo_checklist_items' AND policyname = 'Delete conteudo checklist items') THEN
    CREATE POLICY "Delete conteudo checklist items" ON public.conteudo_checklist_items FOR DELETE TO authenticated
      USING (EXISTS (SELECT 1 FROM public.conteudo_items c WHERE c.id = conteudo_item_id AND public.is_org_member(auth.uid(), c.organization_id)));
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_conteudo_checklist_items_updated_at ON public.conteudo_checklist_items;
CREATE TRIGGER update_conteudo_checklist_items_updated_at
  BEFORE UPDATE ON public.conteudo_checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Conteudo attachments
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

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conteudo_attachments' AND policyname = 'View conteudo attachments') THEN
    CREATE POLICY "View conteudo attachments" ON public.conteudo_attachments FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.conteudo_items c WHERE c.id = conteudo_item_id AND public.is_org_member(auth.uid(), c.organization_id)));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conteudo_attachments' AND policyname = 'Add conteudo attachments') THEN
    CREATE POLICY "Add conteudo attachments" ON public.conteudo_attachments FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.conteudo_items c WHERE c.id = conteudo_item_id AND public.is_org_member(auth.uid(), c.organization_id)));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conteudo_attachments' AND policyname = 'Delete own conteudo attachments') THEN
    CREATE POLICY "Delete own conteudo attachments" ON public.conteudo_attachments FOR DELETE TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

INSERT INTO storage.buckets (id, name, public)
VALUES ('conteudo-attachments', 'conteudo-attachments', false)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Auth upload conteudo attachments') THEN
    CREATE POLICY "Auth upload conteudo attachments" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'conteudo-attachments' AND auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Auth read conteudo attachments') THEN
    CREATE POLICY "Auth read conteudo attachments" ON storage.objects FOR SELECT USING (bucket_id = 'conteudo-attachments' AND auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Auth delete conteudo attachments') THEN
    CREATE POLICY "Auth delete conteudo attachments" ON storage.objects FOR DELETE USING (bucket_id = 'conteudo-attachments' AND auth.role() = 'authenticated');
  END IF;
END $$;

-- ============================================================
-- PASSO 2: Melhoria Subitems (Sunday-like sub-elements)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.melhoria_subitems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  melhoria_id UUID NOT NULL REFERENCES public.melhorias(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'medium',
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  due_date DATE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_melhoria_subitems
  ON public.melhoria_subitems(melhoria_id, position);

ALTER TABLE public.melhoria_subitems ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'melhoria_subitems' AND policyname = 'View melhoria subitems') THEN
    CREATE POLICY "View melhoria subitems" ON public.melhoria_subitems FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.melhorias m WHERE m.id = melhoria_id AND public.is_org_member(auth.uid(), m.organization_id)));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'melhoria_subitems' AND policyname = 'Create melhoria subitems') THEN
    CREATE POLICY "Create melhoria subitems" ON public.melhoria_subitems FOR INSERT TO authenticated
      WITH CHECK (EXISTS (SELECT 1 FROM public.melhorias m WHERE m.id = melhoria_id AND public.is_org_member(auth.uid(), m.organization_id)));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'melhoria_subitems' AND policyname = 'Update melhoria subitems') THEN
    CREATE POLICY "Update melhoria subitems" ON public.melhoria_subitems FOR UPDATE TO authenticated
      USING (EXISTS (SELECT 1 FROM public.melhorias m WHERE m.id = melhoria_id AND public.is_org_member(auth.uid(), m.organization_id)));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'melhoria_subitems' AND policyname = 'Delete melhoria subitems') THEN
    CREATE POLICY "Delete melhoria subitems" ON public.melhoria_subitems FOR DELETE TO authenticated
      USING (EXISTS (SELECT 1 FROM public.melhorias m WHERE m.id = melhoria_id AND public.is_org_member(auth.uid(), m.organization_id)));
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_melhoria_subitems_updated_at ON public.melhoria_subitems;
CREATE TRIGGER update_melhoria_subitems_updated_at
  BEFORE UPDATE ON public.melhoria_subitems
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
