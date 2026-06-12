-- Phase 2A.1: Polymorphic service tables
-- ONE comments table, ONE attachments table, ONE activity_log, ONE entity_code_seq
-- replacing ~7 per-module copies.

-- ============================================================
-- COMMENTS (polymorphic)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  author_id uuid NOT NULL REFERENCES auth.users(id),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comments_entity
  ON public.comments (organization_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_comments_author
  ON public.comments (author_id);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read comments"
  ON public.comments FOR SELECT
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Authenticated users can create comments"
  ON public.comments FOR INSERT
  WITH CHECK (
    auth.uid() = author_id
    AND public.is_org_member(auth.uid(), organization_id)
  );

CREATE POLICY "Authors can update own comments"
  ON public.comments FOR UPDATE
  USING (auth.uid() = author_id);

CREATE POLICY "Author or manager+ can delete comments"
  ON public.comments FOR DELETE
  USING (
    auth.uid() = author_id
    OR public.has_min_role(auth.uid(), organization_id, 'manager')
  );

COMMENT ON TABLE public.comments IS 'Polymorphic comments for any entity. entity_type: task, order, ticket, launch, melhoria, conteudo, sessao, produto, newsletter, pauta, etc.';

-- ============================================================
-- ATTACHMENTS (polymorphic)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  file_size bigint,
  file_type text,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attachments_entity
  ON public.attachments (organization_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_attachments_uploader
  ON public.attachments (uploaded_by);

ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read attachments"
  ON public.attachments FOR SELECT
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Authenticated users can create attachments"
  ON public.attachments FOR INSERT
  WITH CHECK (
    auth.uid() = uploaded_by
    AND public.is_org_member(auth.uid(), organization_id)
  );

CREATE POLICY "Uploader or manager+ can delete attachments"
  ON public.attachments FOR DELETE
  USING (
    auth.uid() = uploaded_by
    OR public.has_min_role(auth.uid(), organization_id, 'manager')
  );

COMMENT ON TABLE public.attachments IS 'Polymorphic attachments for any entity. Files stored in Supabase Storage; storage_path is the bucket path.';

-- ============================================================
-- ACTIVITY LOG (polymorphic)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  action text NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_entity
  ON public.activity_log (organization_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_actor
  ON public.activity_log (actor_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created
  ON public.activity_log (created_at DESC);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read activity_log"
  ON public.activity_log FOR SELECT
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Authenticated users can create activity_log entries"
  ON public.activity_log FOR INSERT
  WITH CHECK (
    auth.uid() = actor_id
    AND public.is_org_member(auth.uid(), organization_id)
  );

-- Activity log is immutable — no UPDATE or DELETE policies

COMMENT ON TABLE public.activity_log IS 'Polymorphic activity log. Audit trail for all entities. Immutable — no update or delete.';

-- ============================================================
-- ENTITY CODE SEQUENCE (replaces *_code_seq tables)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.entity_code_seq (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  last_value bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (organization_id, entity_type)
);

ALTER TABLE public.entity_code_seq ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read entity_code_seq"
  ON public.entity_code_seq FOR SELECT
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can upsert entity_code_seq"
  ON public.entity_code_seq FOR INSERT
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can update entity_code_seq"
  ON public.entity_code_seq FOR UPDATE
  USING (public.is_org_member(auth.uid(), organization_id));

-- Function to get next code
CREATE OR REPLACE FUNCTION public.next_entity_code(_org_id uuid, _entity_type text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _next bigint;
BEGIN
  INSERT INTO public.entity_code_seq (organization_id, entity_type, last_value)
  VALUES (_org_id, _entity_type, 1)
  ON CONFLICT (organization_id, entity_type)
  DO UPDATE SET last_value = entity_code_seq.last_value + 1
  RETURNING last_value INTO _next;
  RETURN _next;
END;
$$;

COMMENT ON FUNCTION public.next_entity_code IS 'Atomically increments and returns the next code number for an entity type within an org. E.g., next_entity_code(org_id, ''melhoria'') → 304';
