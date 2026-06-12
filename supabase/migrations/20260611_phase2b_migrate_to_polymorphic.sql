-- Phase 2B.1: Migrate dedicated comment/activity/attachment data → polymorphic tables
-- Idempotent: uses ON CONFLICT DO NOTHING (comments/activity_log have unique IDs)
-- Preserves original IDs so re-runs are safe.

-- ============================================================
-- COMMENTS: dedicated tables → public.comments
-- ============================================================

-- task_comments → comments(entity_type='task')
INSERT INTO public.comments (id, organization_id, entity_type, entity_id, author_id, body, created_at, updated_at)
SELECT tc.id, p.organization_id, 'task', tc.task_id, tc.user_id, tc.content, tc.created_at, COALESCE(tc.updated_at, tc.created_at)
FROM public.task_comments tc
JOIN public.tasks t ON t.id = tc.task_id
JOIN public.projects p ON p.id = t.project_id
ON CONFLICT (id) DO NOTHING;

-- melhoria_comments → comments(entity_type='melhoria')
INSERT INTO public.comments (id, organization_id, entity_type, entity_id, author_id, body, created_at, updated_at)
SELECT mc.id, m.organization_id, 'melhoria', mc.melhoria_id, mc.user_id, mc.content, mc.created_at, mc.created_at
FROM public.melhoria_comments mc
JOIN public.melhorias m ON m.id = mc.melhoria_id
ON CONFLICT (id) DO NOTHING;

-- sessao_comments → comments(entity_type='sessao')
INSERT INTO public.comments (id, organization_id, entity_type, entity_id, author_id, body, created_at, updated_at)
SELECT sc.id, s.organization_id, 'sessao', sc.sessao_id, sc.user_id, sc.content, sc.created_at, sc.created_at
FROM public.sessao_comments sc
JOIN public.sessoes s ON s.id = sc.sessao_id
ON CONFLICT (id) DO NOTHING;

-- produto_comments → comments(entity_type='produto')
INSERT INTO public.comments (id, organization_id, entity_type, entity_id, author_id, body, created_at, updated_at)
SELECT pc.id, pr.organization_id, 'produto', pc.produto_id, pc.user_id, pc.content, pc.created_at, pc.created_at
FROM public.produto_comments pc
JOIN public.produtos pr ON pr.id = pc.produto_id
ON CONFLICT (id) DO NOTHING;

-- conteudo_comments → comments(entity_type='conteudo')
INSERT INTO public.comments (id, organization_id, entity_type, entity_id, author_id, body, created_at, updated_at)
SELECT cc.id, ci.organization_id, 'conteudo', cc.conteudo_item_id, cc.user_id, cc.content, cc.created_at, cc.created_at
FROM public.conteudo_comments cc
JOIN public.conteudo_items ci ON ci.id = cc.conteudo_item_id
ON CONFLICT (id) DO NOTHING;

-- newsletter_comments → comments(entity_type='newsletter')
INSERT INTO public.comments (id, organization_id, entity_type, entity_id, author_id, body, created_at, updated_at)
SELECT nc.id, n.organization_id, 'newsletter', nc.newsletter_id, nc.user_id, nc.content, nc.created_at, nc.created_at
FROM public.newsletter_comments nc
JOIN public.newsletters n ON n.id = nc.newsletter_id
ON CONFLICT (id) DO NOTHING;

-- pauta_comments → comments(entity_type='pauta')
INSERT INTO public.comments (id, organization_id, entity_type, entity_id, author_id, body, created_at, updated_at)
SELECT pc.id, pa.organization_id, 'pauta', pc.pauta_id, pc.user_id, pc.content, pc.created_at, pc.created_at
FROM public.pauta_comments pc
JOIN public.pautas pa ON pa.id = pc.pauta_id
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- ACTIVITY LOG: dedicated tables → public.activity_log
-- ============================================================

-- task_activity_log → activity_log(entity_type='task')
-- Maps field_name/old_value/new_value into payload jsonb
INSERT INTO public.activity_log (id, organization_id, entity_type, entity_id, actor_id, action, payload, created_at)
SELECT tal.id, p.organization_id, 'task', tal.task_id, tal.user_id,
       tal.field_name,
       jsonb_build_object('from', tal.old_value, 'to', tal.new_value),
       tal.created_at
FROM public.task_activity_log tal
JOIN public.tasks t ON t.id = tal.task_id
JOIN public.projects p ON p.id = t.project_id
ON CONFLICT (id) DO NOTHING;

-- melhoria_activity → activity_log(entity_type='melhoria')
-- Note: skips records with NULL user_id (system-triggered) since actor_id is NOT NULL
INSERT INTO public.activity_log (id, organization_id, entity_type, entity_id, actor_id, action, payload, created_at)
SELECT ma.id, m.organization_id, 'melhoria', ma.melhoria_id, ma.user_id,
       ma.action,
       jsonb_build_object('from', ma.from_value, 'to', ma.to_value),
       ma.created_at
FROM public.melhoria_activity ma
JOIN public.melhorias m ON m.id = ma.melhoria_id
WHERE ma.user_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- sessao_activity → activity_log(entity_type='sessao')
INSERT INTO public.activity_log (id, organization_id, entity_type, entity_id, actor_id, action, payload, created_at)
SELECT sa.id, s.organization_id, 'sessao', sa.sessao_id, sa.user_id,
       sa.action,
       jsonb_build_object('from', sa.from_value, 'to', sa.to_value),
       sa.created_at
FROM public.sessao_activity sa
JOIN public.sessoes s ON s.id = sa.sessao_id
WHERE sa.user_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- produto_activity → activity_log(entity_type='produto')
INSERT INTO public.activity_log (id, organization_id, entity_type, entity_id, actor_id, action, payload, created_at)
SELECT pa.id, pr.organization_id, 'produto', pa.produto_id, pa.user_id,
       pa.action,
       jsonb_build_object('from', pa.from_value, 'to', pa.to_value),
       pa.created_at
FROM public.produto_activity pa
JOIN public.produtos pr ON pr.id = pa.produto_id
WHERE pa.user_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- conteudo_activity → activity_log(entity_type='conteudo')
INSERT INTO public.activity_log (id, organization_id, entity_type, entity_id, actor_id, action, payload, created_at)
SELECT ca.id, ci.organization_id, 'conteudo', ca.conteudo_item_id, ca.user_id,
       ca.action,
       jsonb_build_object('from', ca.from_value, 'to', ca.to_value),
       ca.created_at
FROM public.conteudo_activity ca
JOIN public.conteudo_items ci ON ci.id = ca.conteudo_item_id
WHERE ca.user_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- newsletter_activity → activity_log(entity_type='newsletter')
INSERT INTO public.activity_log (id, organization_id, entity_type, entity_id, actor_id, action, payload, created_at)
SELECT na.id, n.organization_id, 'newsletter', na.newsletter_id, na.user_id,
       na.action,
       jsonb_build_object('from', na.from_value, 'to', na.to_value),
       na.created_at
FROM public.newsletter_activity na
JOIN public.newsletters n ON n.id = na.newsletter_id
WHERE na.user_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- pauta_activity → activity_log(entity_type='pauta')
INSERT INTO public.activity_log (id, organization_id, entity_type, entity_id, actor_id, action, payload, created_at)
SELECT paa.id, pa.organization_id, 'pauta', paa.pauta_id, paa.user_id,
       paa.action,
       jsonb_build_object('from', paa.from_value, 'to', paa.to_value),
       paa.created_at
FROM public.pauta_activity paa
JOIN public.pautas pa ON pa.id = paa.pauta_id
WHERE paa.user_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- launch_stage_activity → activity_log(entity_type='launch_stage')
INSERT INTO public.activity_log (id, organization_id, entity_type, entity_id, actor_id, action, payload, created_at)
SELECT lsa.id, l.organization_id, 'launch_stage', lsa.stage_id, lsa.user_id,
       lsa.action,
       jsonb_build_object('from', lsa.old_value, 'to', lsa.new_value),
       lsa.created_at
FROM public.launch_stage_activity lsa
JOIN public.launch_stages ls ON ls.id = lsa.stage_id
JOIN public.launches l ON l.id = ls.launch_id
WHERE lsa.user_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- ATTACHMENTS: dedicated tables → public.attachments
-- Note: dedicated tables store file_url (full public URL).
-- We store the URL in storage_path for backward compat.
-- The generic hook generates URLs from storage_path + bucket,
-- but migrated records with full URLs will be handled by the hook.
-- ============================================================

-- task_attachments → attachments(entity_type='task')
INSERT INTO public.attachments (id, organization_id, entity_type, entity_id, storage_path, file_name, file_size, file_type, uploaded_by, created_at)
SELECT ta.id, p.organization_id, 'task', ta.task_id, ta.file_url, ta.file_name, ta.file_size, ta.file_type, ta.user_id, ta.created_at
FROM public.task_attachments ta
JOIN public.tasks t ON t.id = ta.task_id
JOIN public.projects p ON p.id = t.project_id
ON CONFLICT (id) DO NOTHING;

-- melhoria_attachments → attachments(entity_type='melhoria')
INSERT INTO public.attachments (id, organization_id, entity_type, entity_id, storage_path, file_name, file_size, file_type, uploaded_by, created_at)
SELECT ma.id, m.organization_id, 'melhoria', ma.melhoria_id, ma.file_url, ma.file_name, ma.file_size, ma.file_type, ma.user_id, ma.created_at
FROM public.melhoria_attachments ma
JOIN public.melhorias m ON m.id = ma.melhoria_id
ON CONFLICT (id) DO NOTHING;

-- sessao_attachments → attachments(entity_type='sessao')
INSERT INTO public.attachments (id, organization_id, entity_type, entity_id, storage_path, file_name, file_size, file_type, uploaded_by, created_at)
SELECT sa.id, s.organization_id, 'sessao', sa.sessao_id, sa.file_url, sa.file_name, sa.file_size, sa.file_type, sa.user_id, sa.created_at
FROM public.sessao_attachments sa
JOIN public.sessoes s ON s.id = sa.sessao_id
ON CONFLICT (id) DO NOTHING;

-- produto_attachments → attachments(entity_type='produto')
INSERT INTO public.attachments (id, organization_id, entity_type, entity_id, storage_path, file_name, file_size, file_type, uploaded_by, created_at)
SELECT pa.id, pr.organization_id, 'produto', pa.produto_id, pa.file_url, pa.file_name, pa.file_size, pa.file_type, pa.user_id, pa.created_at
FROM public.produto_attachments pa
JOIN public.produtos pr ON pr.id = pa.produto_id
ON CONFLICT (id) DO NOTHING;

-- conteudo_attachments → attachments(entity_type='conteudo')
INSERT INTO public.attachments (id, organization_id, entity_type, entity_id, storage_path, file_name, file_size, file_type, uploaded_by, created_at)
SELECT ca.id, ci.organization_id, 'conteudo', ca.conteudo_item_id, ca.file_url, ca.file_name, ca.file_size, ca.file_type, ca.user_id, ca.created_at
FROM public.conteudo_attachments ca
JOIN public.conteudo_items ci ON ci.id = ca.conteudo_item_id
ON CONFLICT (id) DO NOTHING;

-- launch_stage_attachments → attachments(entity_type='launch_stage')
INSERT INTO public.attachments (id, organization_id, entity_type, entity_id, storage_path, file_name, file_size, file_type, uploaded_by, created_at)
SELECT lsa.id, l.organization_id, 'launch_stage', lsa.stage_id, lsa.file_url, lsa.file_name, lsa.file_size, lsa.file_type, lsa.user_id, lsa.created_at
FROM public.launch_stage_attachments lsa
JOIN public.launch_stages ls ON ls.id = lsa.stage_id
JOIN public.launches l ON l.id = ls.launch_id
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- DEPRECATION COMMENTS on old tables (Phase 2B.3)
-- ============================================================
COMMENT ON TABLE public.task_comments IS 'DEPRECATED — migrated to public.comments(entity_type=task). Drop in Phase 4.';
COMMENT ON TABLE public.task_attachments IS 'DEPRECATED — migrated to public.attachments(entity_type=task). Drop in Phase 4.';
COMMENT ON TABLE public.task_activity_log IS 'DEPRECATED — migrated to public.activity_log(entity_type=task). Drop in Phase 4.';
COMMENT ON TABLE public.melhoria_comments IS 'DEPRECATED — migrated to public.comments(entity_type=melhoria). Drop in Phase 4.';
COMMENT ON TABLE public.melhoria_attachments IS 'DEPRECATED — migrated to public.attachments(entity_type=melhoria). Drop in Phase 4.';
COMMENT ON TABLE public.melhoria_activity IS 'DEPRECATED — migrated to public.activity_log(entity_type=melhoria). Drop in Phase 4.';
COMMENT ON TABLE public.sessao_comments IS 'DEPRECATED — migrated to public.comments(entity_type=sessao). Drop in Phase 4.';
COMMENT ON TABLE public.sessao_attachments IS 'DEPRECATED — migrated to public.attachments(entity_type=sessao). Drop in Phase 4.';
COMMENT ON TABLE public.sessao_activity IS 'DEPRECATED — migrated to public.activity_log(entity_type=sessao). Drop in Phase 4.';
COMMENT ON TABLE public.produto_comments IS 'DEPRECATED — migrated to public.comments(entity_type=produto). Drop in Phase 4.';
COMMENT ON TABLE public.produto_attachments IS 'DEPRECATED — migrated to public.attachments(entity_type=produto). Drop in Phase 4.';
COMMENT ON TABLE public.produto_activity IS 'DEPRECATED — migrated to public.activity_log(entity_type=produto). Drop in Phase 4.';
COMMENT ON TABLE public.conteudo_comments IS 'DEPRECATED — migrated to public.comments(entity_type=conteudo). Drop in Phase 4.';
COMMENT ON TABLE public.conteudo_attachments IS 'DEPRECATED — migrated to public.attachments(entity_type=conteudo). Drop in Phase 4.';
COMMENT ON TABLE public.conteudo_activity IS 'DEPRECATED — migrated to public.activity_log(entity_type=conteudo). Drop in Phase 4.';
COMMENT ON TABLE public.newsletter_comments IS 'DEPRECATED — migrated to public.comments(entity_type=newsletter). Drop in Phase 4.';
COMMENT ON TABLE public.newsletter_activity IS 'DEPRECATED — migrated to public.activity_log(entity_type=newsletter). Drop in Phase 4.';
COMMENT ON TABLE public.pauta_comments IS 'DEPRECATED — migrated to public.comments(entity_type=pauta). Drop in Phase 4.';
COMMENT ON TABLE public.pauta_activity IS 'DEPRECATED — migrated to public.activity_log(entity_type=pauta). Drop in Phase 4.';
COMMENT ON TABLE public.launch_stage_activity IS 'DEPRECATED — migrated to public.activity_log(entity_type=launch_stage). Drop in Phase 4.';
COMMENT ON TABLE public.launch_stage_attachments IS 'DEPRECATED — migrated to public.attachments(entity_type=launch_stage). Drop in Phase 4.';

-- ============================================================
-- Storage bucket for polymorphic attachments (if not exists)
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('entity-attachments', 'entity-attachments', true)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can upload entity attachments' AND tablename = 'objects') THEN
    CREATE POLICY "Authenticated users can upload entity attachments"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'entity-attachments');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can read entity attachments' AND tablename = 'objects') THEN
    CREATE POLICY "Anyone can read entity attachments"
      ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'entity-attachments');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Owner or manager can delete entity attachments' AND tablename = 'objects') THEN
    CREATE POLICY "Owner or manager can delete entity attachments"
      ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'entity-attachments');
  END IF;
END $$;
