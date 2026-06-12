-- ================================================================
-- MOOUI Collab Hub — Migrations pendentes (SCHEMA ONLY)
-- Gerado em: 2026-06-12
-- 
-- Migrations 6/8 e 7/8 (data migration) REMOVIDAS deste arquivo
-- porque o dry-run confirmou zero dados nas tabelas dedicadas.
-- Se precisar rodar a data migration depois, use os arquivos
-- individuais em supabase/migrations/
-- ================================================================


-- ================================================================
-- Migration 1/6: Phase 0 — has_min_role + security policies
-- ================================================================

-- Phase 0: Security hardening — has_min_role function + DELETE policy fixes
-- Items 0.6 and 0.7 from docs/REESTRUTURACAO.md

-- ============================================================
-- 1. has_min_role: hierarchical role check (SECURITY DEFINER)
-- ============================================================
-- Ranks: admin(0) > director(1) > manager(2) > operator(3) > member(4)
-- Returns true when the user's role rank <= min_role rank (i.e. same or higher privilege).

CREATE OR REPLACE FUNCTION public.has_min_role(_user_id uuid, _org_id uuid, _min_role app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members om
    LEFT JOIN public.user_roles ur ON ur.user_id = om.user_id
      AND ur.role::text NOT IN ('it_support')
    WHERE om.user_id = _user_id
      AND om.organization_id = _org_id
      AND (
        CASE COALESCE(ur.role::text, om.role::text)
          WHEN 'admin'    THEN 0
          WHEN 'director' THEN 1
          WHEN 'manager'  THEN 2
          WHEN 'operator' THEN 3
          WHEN 'member'   THEN 4
          ELSE 4
        END
      ) <= (
        CASE _min_role
          WHEN 'admin'    THEN 0
          WHEN 'director' THEN 1
          WHEN 'manager'  THEN 2
          WHEN 'operator' THEN 3
          WHEN 'member'   THEN 4
        END
      )
  )
$$;

-- ============================================================
-- 2. Fix tasks DELETE: restrict to manager+ (item 0.7)
-- ============================================================
-- Before: any project member could delete any task.
-- After:  must be project member AND have manager/director/admin role in the org.

DROP POLICY IF EXISTS "Project members can delete tasks" ON public.tasks;

DROP POLICY IF EXISTS "Manager+ can delete tasks" ON public.tasks;
CREATE POLICY "Manager+ can delete tasks"
ON public.tasks
FOR DELETE
TO authenticated
USING (
  public.is_project_member(auth.uid(), project_id)
  AND public.has_min_role(
    auth.uid(),
    (SELECT organization_id FROM public.projects WHERE id = project_id),
    'manager'
  )
);

-- ============================================================
-- 3. Fix melhoria-attachments storage DELETE: ownership (item 0.6)
-- ============================================================
-- Guarded: melhoria_attachments may not exist on remote yet.

DROP POLICY IF EXISTS "Auth delete own melhoria attachments" ON storage.objects;
DROP POLICY IF EXISTS "Owner deletes melhoria attachments" ON storage.objects;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'melhoria_attachments') THEN
    EXECUTE '
      CREATE POLICY "Owner deletes melhoria attachments"
      ON storage.objects FOR DELETE TO authenticated
      USING (
        bucket_id = ''melhoria-attachments''
        AND EXISTS (
          SELECT 1 FROM public.melhoria_attachments a
          WHERE a.file_url LIKE ''%'' || objects.name
            AND a.user_id = auth.uid()
        )
      )';
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL;
END $$;

-- ============================================================
-- 4. Upgrade existing storage DELETE policies: owner OR manager+
-- ============================================================
-- Aligns task-attachments, produto-attachments and sessao-attachments
-- with the decision that manager+ can clean up any attachment.

-- 4a. task-attachments (guarded)
DROP POLICY IF EXISTS "Owner deletes task attachments" ON storage.objects;
DROP POLICY IF EXISTS "Owner or manager deletes task attachments" ON storage.objects;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'task_attachments') THEN
    EXECUTE '
      CREATE POLICY "Owner or manager deletes task attachments"
      ON storage.objects FOR DELETE TO authenticated
      USING (
        bucket_id = ''task-attachments''
        AND (
          EXISTS (
            SELECT 1 FROM public.task_attachments a
            WHERE a.file_url LIKE ''%'' || objects.name
              AND a.user_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1 FROM public.task_attachments a
            JOIN public.tasks t ON t.id = a.task_id
            JOIN public.projects p ON p.id = t.project_id
            WHERE a.file_url LIKE ''%'' || objects.name
              AND public.has_min_role(auth.uid(), p.organization_id, ''manager'')
          )
        )
      )';
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL;
END $$;

-- 4b. produto-attachments (guarded: produto_attachments may not exist)
DROP POLICY IF EXISTS "Owner delete produto files" ON storage.objects;
DROP POLICY IF EXISTS "Owner or manager deletes produto attachments" ON storage.objects;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'produto_attachments') THEN
    EXECUTE '
      CREATE POLICY "Owner or manager deletes produto attachments"
      ON storage.objects FOR DELETE TO authenticated
      USING (
        bucket_id = ''produto-attachments''
        AND (
          EXISTS (
            SELECT 1 FROM public.produto_attachments a
            WHERE a.file_url LIKE ''%'' || objects.name
              AND a.user_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1 FROM public.produto_attachments a
            JOIN public.produtos p ON p.id = a.produto_id
            WHERE a.file_url LIKE ''%'' || objects.name
              AND public.has_min_role(auth.uid(), p.organization_id, ''manager'')
          )
        )
      )';
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL;
END $$;

-- 4c. sessao-attachments (guarded: sessao_attachments may not exist)
DROP POLICY IF EXISTS "Owner delete sessao files" ON storage.objects;
DROP POLICY IF EXISTS "Owner or manager deletes sessao attachments" ON storage.objects;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sessao_attachments') THEN
    EXECUTE '
      CREATE POLICY "Owner or manager deletes sessao attachments"
      ON storage.objects FOR DELETE TO authenticated
      USING (
        bucket_id = ''sessao-attachments''
        AND (
          EXISTS (
            SELECT 1 FROM public.sessao_attachments a
            WHERE a.file_url LIKE ''%'' || objects.name
              AND a.user_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1 FROM public.sessao_attachments a
            JOIN public.sessoes s ON s.id = a.sessao_id
            WHERE a.file_url LIKE ''%'' || objects.name
              AND public.has_min_role(auth.uid(), s.organization_id, ''manager'')
          )
        )
      )';
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL;
END $$;

-- 4d. melhoria-attachments: also allow manager+ (guarded: melhoria_attachments may not exist)
DROP POLICY IF EXISTS "Owner deletes melhoria attachments" ON storage.objects;
DROP POLICY IF EXISTS "Owner or manager deletes melhoria attachments" ON storage.objects;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'melhoria_attachments') THEN
    EXECUTE '
      CREATE POLICY "Owner or manager deletes melhoria attachments"
      ON storage.objects FOR DELETE TO authenticated
      USING (
        bucket_id = ''melhoria-attachments''
        AND (
          EXISTS (
            SELECT 1 FROM public.melhoria_attachments a
            WHERE a.file_url LIKE ''%'' || objects.name
              AND a.user_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1 FROM public.melhoria_attachments a
            JOIN public.melhorias m ON m.id = a.melhoria_id
            WHERE a.file_url LIKE ''%'' || objects.name
              AND public.has_min_role(auth.uid(), m.organization_id, ''manager'')
          )
        )
      )';
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL;
END $$;


-- ================================================================
-- Migration 2/6: Phase 2.5 — DELETE policies (non-live)
-- ================================================================

-- Phase 2.5 item 2.5.2: Restrict DELETE policies to manager+ using has_min_role()
-- Scope: all non-live modules (Orders, Tickets, Speaks deferred to item 2.5.6)
--
-- Pattern: main entities → has_min_role(manager)
--          sub-items     → has_min_role(manager) via parent's org_id
--          comments      → own only (auth.uid() = user_id) — unchanged
--          attachments   → own only (auth.uid() = user_id) — unchanged
--          activity logs → no DELETE policy (audit trail, immutable)
--
-- Exceptions kept:
--   - notifications → user deletes own
--   - meeting_room_bookings → owner or admin (booking management)
--   - message_reactions → user removes own
--   - email_preferences → user manages own

-- ============================================================
-- MAIN ENTITY TABLES: creator OR is_org_admin → has_min_role(manager)
-- ============================================================

-- melhorias (guarded)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'melhorias') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Creator or admin delete melhorias" ON public.melhorias';
    EXECUTE 'DROP POLICY IF EXISTS "Manager+ can delete melhorias" ON public.melhorias';
    EXECUTE 'CREATE POLICY "Manager+ can delete melhorias" ON public.melhorias FOR DELETE USING (public.has_min_role(auth.uid(), organization_id, ''manager''))';
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL;
END $$;

-- conteudo_items (guarded)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'conteudo_items') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Creator or admin delete conteudo" ON public.conteudo_items';
    EXECUTE 'DROP POLICY IF EXISTS "Manager+ can delete conteudo_items" ON public.conteudo_items';
    EXECUTE 'CREATE POLICY "Manager+ can delete conteudo_items" ON public.conteudo_items FOR DELETE USING (public.has_min_role(auth.uid(), organization_id, ''manager''))';
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL;
END $$;

-- newsletters (guarded)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'newsletters') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Creator or admin delete newsletters" ON public.newsletters';
    EXECUTE 'DROP POLICY IF EXISTS "Manager+ can delete newsletters" ON public.newsletters';
    EXECUTE 'CREATE POLICY "Manager+ can delete newsletters" ON public.newsletters FOR DELETE USING (public.has_min_role(auth.uid(), organization_id, ''manager''))';
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL;
END $$;

-- pautas (guarded)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'pautas') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Creator or admin delete pautas" ON public.pautas';
    EXECUTE 'DROP POLICY IF EXISTS "Manager+ can delete pautas" ON public.pautas';
    EXECUTE 'CREATE POLICY "Manager+ can delete pautas" ON public.pautas FOR DELETE USING (public.has_min_role(auth.uid(), organization_id, ''manager''))';
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL;
END $$;

-- sessoes (guarded)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sessoes') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Creator or admin delete sessoes" ON public.sessoes';
    EXECUTE 'DROP POLICY IF EXISTS "Manager+ can delete sessoes" ON public.sessoes';
    EXECUTE 'CREATE POLICY "Manager+ can delete sessoes" ON public.sessoes FOR DELETE USING (public.has_min_role(auth.uid(), organization_id, ''manager''))';
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL;
END $$;

-- produtos (guarded)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'produtos') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Creator or admin delete produtos" ON public.produtos';
    EXECUTE 'DROP POLICY IF EXISTS "Manager+ can delete produtos" ON public.produtos';
    EXECUTE 'CREATE POLICY "Manager+ can delete produtos" ON public.produtos FOR DELETE USING (public.has_min_role(auth.uid(), organization_id, ''manager''))';
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL;
END $$;

-- annual_events (guarded)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'annual_events') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Creator or admin can delete events" ON public.annual_events';
    EXECUTE 'DROP POLICY IF EXISTS "Creator or admin delete events" ON public.annual_events';
    EXECUTE 'DROP POLICY IF EXISTS "Manager+ can delete annual_events" ON public.annual_events';
    EXECUTE 'CREATE POLICY "Manager+ can delete annual_events" ON public.annual_events FOR DELETE USING (public.has_min_role(auth.uid(), organization_id, ''manager''))';
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL;
END $$;

-- launches (guarded)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'launches') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Creator or admin delete launches" ON public.launches';
    EXECUTE 'DROP POLICY IF EXISTS "Manager+ can delete launches" ON public.launches';
    EXECUTE 'CREATE POLICY "Manager+ can delete launches" ON public.launches FOR DELETE USING (public.has_min_role(auth.uid(), organization_id, ''manager''))';
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL;
END $$;

-- checklist_templates (guarded)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'checklist_templates') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Owner or admin delete templates" ON public.checklist_templates';
    EXECUTE 'DROP POLICY IF EXISTS "Manager+ can delete checklist_templates" ON public.checklist_templates';
    EXECUTE 'CREATE POLICY "Manager+ can delete checklist_templates" ON public.checklist_templates FOR DELETE USING (public.has_min_role(auth.uid(), organization_id, ''manager''))';
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL;
END $$;

-- launch_checklists (guarded)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'launch_checklists') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Owner or admin delete checklists" ON public.launch_checklists';
    EXECUTE 'DROP POLICY IF EXISTS "Manager+ can delete launch_checklists" ON public.launch_checklists';
    EXECUTE 'CREATE POLICY "Manager+ can delete launch_checklists" ON public.launch_checklists FOR DELETE USING (public.has_min_role(auth.uid(), organization_id, ''manager''))';
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL;
END $$;

-- doc_pages (guarded)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'doc_pages') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Creator or admin can delete pages" ON public.doc_pages';
    EXECUTE 'DROP POLICY IF EXISTS "Org members can manage doc pages" ON public.doc_pages';
    EXECUTE 'DROP POLICY IF EXISTS "Manager+ can delete doc_pages" ON public.doc_pages';
    EXECUTE 'CREATE POLICY "Manager+ can delete doc_pages" ON public.doc_pages FOR DELETE USING (public.has_min_role(auth.uid(), organization_id, ''manager''))';
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL;
END $$;

-- module_links (guarded)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'module_links') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Creator or admin delete module_links" ON public.module_links';
    EXECUTE 'DROP POLICY IF EXISTS "Manager+ can delete module_links" ON public.module_links';
    EXECUTE '
      CREATE POLICY "Manager+ can delete module_links"
        ON public.module_links FOR DELETE
        USING (
          auth.uid() = created_by
          OR public.has_min_role(auth.uid(), organization_id, ''manager'')
        )';
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL;
END $$;

-- sessao_contracts (guarded: table may not exist on remote)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sessao_contracts') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Creator or admin delete contracts" ON public.sessao_contracts';
    EXECUTE 'DROP POLICY IF EXISTS "Manager+ can delete sessao_contracts" ON public.sessao_contracts';
    EXECUTE '
      CREATE POLICY "Manager+ can delete sessao_contracts"
        ON public.sessao_contracts FOR DELETE
        USING (
          EXISTS (
            SELECT 1 FROM public.sessoes s
            WHERE s.id = sessao_id
              AND public.has_min_role(auth.uid(), s.organization_id, ''manager'')
          )
        )';
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL;
END $$;

-- sessao_ideas (guarded: table may not exist on remote)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sessao_ideas') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Creator or admin delete ideas" ON public.sessao_ideas';
    EXECUTE 'DROP POLICY IF EXISTS "Manager+ can delete sessao_ideas" ON public.sessao_ideas';
    EXECUTE '
      CREATE POLICY "Manager+ can delete sessao_ideas"
        ON public.sessao_ideas FOR DELETE
        USING (
          EXISTS (
            SELECT 1 FROM public.sessoes s
            WHERE s.id = sessao_id
              AND public.has_min_role(auth.uid(), s.organization_id, ''manager'')
          )
        )';
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL;
END $$;

-- crm_contacts (if exists)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'crm_contacts') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Owner or admin delete contacts" ON public.crm_contacts';
    EXECUTE 'CREATE POLICY "Manager+ can delete crm_contacts" ON public.crm_contacts FOR DELETE USING (public.has_min_role(auth.uid(), organization_id, ''manager''))';
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL;
END $$;

-- crm_deals (if exists)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'crm_deals') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Owner or admin delete deals" ON public.crm_deals';
    EXECUTE 'CREATE POLICY "Manager+ can delete crm_deals" ON public.crm_deals FOR DELETE USING (public.has_min_role(auth.uid(), organization_id, ''manager''))';
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL;
END $$;

-- ============================================================
-- SUB-ITEM TABLES: is_org_member → has_min_role(manager)
-- ============================================================

-- pauta_items (guarded: table may not exist on remote)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'pauta_items') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Delete pauta items" ON public.pauta_items';
    EXECUTE 'DROP POLICY IF EXISTS "Manager+ can delete pauta_items" ON public.pauta_items';
    EXECUTE '
      CREATE POLICY "Manager+ can delete pauta_items"
        ON public.pauta_items FOR DELETE
        USING (
          EXISTS (
            SELECT 1 FROM public.pautas p
            WHERE p.id = pauta_id
              AND public.has_min_role(auth.uid(), p.organization_id, ''manager'')
          )
        )';
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL;
END $$;

-- sessao_shots (guarded: table may not exist on remote)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sessao_shots') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Delete shots via session" ON public.sessao_shots';
    EXECUTE 'DROP POLICY IF EXISTS "Manager+ can delete sessao_shots" ON public.sessao_shots';
    EXECUTE '
      CREATE POLICY "Manager+ can delete sessao_shots"
        ON public.sessao_shots FOR DELETE
        USING (
          EXISTS (
            SELECT 1 FROM public.sessoes s
            WHERE s.id = sessao_id
              AND public.has_min_role(auth.uid(), s.organization_id, ''manager'')
          )
        )';
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL;
END $$;

-- produto_stages (guarded: table may not exist on remote)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'produto_stages') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Delete produto stages" ON public.produto_stages';
    EXECUTE 'DROP POLICY IF EXISTS "Manager+ can delete produto_stages" ON public.produto_stages';
    EXECUTE '
      CREATE POLICY "Manager+ can delete produto_stages"
        ON public.produto_stages FOR DELETE
        USING (
          EXISTS (
            SELECT 1 FROM public.produtos p
            WHERE p.id = produto_id
              AND public.has_min_role(auth.uid(), p.organization_id, ''manager'')
          )
        )';
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL;
END $$;

-- produto_design_items (guarded: table may not exist on remote)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'produto_design_items') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Delete design items" ON public.produto_design_items';
    EXECUTE 'DROP POLICY IF EXISTS "Manager+ can delete produto_design_items" ON public.produto_design_items';
    EXECUTE '
      CREATE POLICY "Manager+ can delete produto_design_items"
        ON public.produto_design_items FOR DELETE
        USING (
          EXISTS (
            SELECT 1 FROM public.produtos p
            WHERE p.id = produto_id
              AND public.has_min_role(auth.uid(), p.organization_id, ''manager'')
          )
        )';
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL;
END $$;

-- melhoria_subitems (guarded: table may not exist on remote)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'melhoria_subitems') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Delete melhoria subitems" ON public.melhoria_subitems';
    EXECUTE 'DROP POLICY IF EXISTS "Manager+ can delete melhoria_subitems" ON public.melhoria_subitems';
    EXECUTE '
      CREATE POLICY "Manager+ can delete melhoria_subitems"
        ON public.melhoria_subitems FOR DELETE
        USING (
          EXISTS (
            SELECT 1 FROM public.melhorias m
            WHERE m.id = melhoria_id
              AND public.has_min_role(auth.uid(), m.organization_id, ''manager'')
          )
        )';
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL;
END $$;

-- conteudo_checklist_items (guarded: table may not exist on remote)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'conteudo_checklist_items') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Delete conteudo checklist items" ON public.conteudo_checklist_items';
    EXECUTE 'DROP POLICY IF EXISTS "Manager+ can delete conteudo_checklist_items" ON public.conteudo_checklist_items';
    EXECUTE '
      CREATE POLICY "Manager+ can delete conteudo_checklist_items"
        ON public.conteudo_checklist_items FOR DELETE
        USING (
          EXISTS (
            SELECT 1 FROM public.conteudo_items c
            WHERE c.id = conteudo_item_id
              AND public.has_min_role(auth.uid(), c.organization_id, ''manager'')
          )
        )';
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL;
END $$;

-- annual_event_etapas (guarded)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'annual_event_etapas') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Delete event etapas" ON public.annual_event_etapas';
    EXECUTE 'DROP POLICY IF EXISTS "Manager+ can delete annual_event_etapas" ON public.annual_event_etapas';
    EXECUTE '
      CREATE POLICY "Manager+ can delete annual_event_etapas"
        ON public.annual_event_etapas FOR DELETE
        USING (
          EXISTS (
            SELECT 1 FROM public.annual_events e
            WHERE e.id = event_id
              AND public.has_min_role(auth.uid(), e.organization_id, ''manager'')
          )
        )';
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL;
END $$;

-- project_template_tasks (guarded)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'project_template_tasks') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Members can delete template tasks" ON public.project_template_tasks';
    EXECUTE 'DROP POLICY IF EXISTS "Manager+ can delete project_template_tasks" ON public.project_template_tasks';
    EXECUTE '
      CREATE POLICY "Manager+ can delete project_template_tasks"
        ON public.project_template_tasks FOR DELETE
        USING (
          EXISTS (
            SELECT 1 FROM public.project_templates pt
            WHERE pt.id = template_id
              AND public.has_min_role(auth.uid(), pt.organization_id, ''manager'')
          )
        )';
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL;
END $$;

-- task_labels (guarded)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'task_labels') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Project members can delete labels" ON public.task_labels';
    EXECUTE 'DROP POLICY IF EXISTS "Manager+ can delete task_labels" ON public.task_labels';
    EXECUTE '
      CREATE POLICY "Manager+ can delete task_labels"
        ON public.task_labels FOR DELETE
        USING (
          public.is_project_member(auth.uid(), project_id)
          AND EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = project_id
              AND public.has_min_role(auth.uid(), p.organization_id, ''manager'')
          )
        )';
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL;
END $$;

-- task_label_assignments (guarded)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'task_label_assignments') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Project members can remove labels" ON public.task_label_assignments';
    EXECUTE 'DROP POLICY IF EXISTS "Members can remove label assignments" ON public.task_label_assignments';
    EXECUTE 'DROP POLICY IF EXISTS "Manager+ can delete task_label_assignments" ON public.task_label_assignments';
    EXECUTE '
      CREATE POLICY "Manager+ can delete task_label_assignments"
        ON public.task_label_assignments FOR DELETE
        USING (
          EXISTS (
            SELECT 1 FROM public.tasks t
            JOIN public.projects p ON p.id = t.project_id
            WHERE t.id = task_id
              AND public.has_min_role(auth.uid(), p.organization_id, ''manager'')
          )
        )';
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL;
END $$;

-- task_assignees (guarded)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'task_assignees') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Project members can remove assignees" ON public.task_assignees';
    EXECUTE 'DROP POLICY IF EXISTS "Self or manager+ can delete task_assignees" ON public.task_assignees';
    EXECUTE '
      CREATE POLICY "Self or manager+ can delete task_assignees"
        ON public.task_assignees FOR DELETE
        USING (
          auth.uid() = user_id
          OR EXISTS (
            SELECT 1 FROM public.tasks t
            JOIN public.projects p ON p.id = t.project_id
            WHERE t.id = task_id
              AND public.has_min_role(auth.uid(), p.organization_id, ''manager'')
          )
        )';
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL;
END $$;

-- ============================================================
-- STORAGE: conteudo-attachments (was: any authenticated)
-- ============================================================

-- Fix conteudo-attachments storage DELETE (same pattern as Phase 0 fixes)
DROP POLICY IF EXISTS "Auth delete conteudo attachments" ON storage.objects;
DROP POLICY IF EXISTS "Owner or manager+ delete conteudo attachments" ON storage.objects;
CREATE POLICY "Owner or manager+ delete conteudo attachments"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'conteudo-attachments'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR EXISTS (
        SELECT 1 FROM public.organization_members om
        JOIN public.user_roles ur ON ur.user_id = om.user_id
        WHERE om.user_id = auth.uid()
          AND (CASE ur.role
            WHEN 'admin' THEN 0 WHEN 'director' THEN 1
            WHEN 'manager' THEN 2 WHEN 'operator' THEN 3
            WHEN 'member' THEN 4 END) <= 2
      )
    )
  );


-- ================================================================
-- Migration 3/6: Phase 2.5 — module_access table
-- ================================================================

-- Phase 2.5 item 2.5.4: Module access control table
-- Default sem linha = visible for entire org (current behavior preserved).
-- Sidebar and routes respect via hook useModuleAccess(moduleKey).

CREATE TABLE IF NOT EXISTS public.module_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  grantee_type text NOT NULL CHECK (grantee_type IN ('role', 'department', 'user')),
  grantee_id text NOT NULL,
  level text NOT NULL CHECK (level IN ('hidden', 'view', 'edit')) DEFAULT 'view',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, module_key, grantee_type, grantee_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_module_access_org_module
  ON public.module_access (organization_id, module_key);

-- RLS
ALTER TABLE public.module_access ENABLE ROW LEVEL SECURITY;

-- Read: any org member can read access rules (needed for sidebar visibility)
DROP POLICY IF EXISTS "Org members can read module_access" ON public.module_access;
CREATE POLICY "Org members can read module_access"
  ON public.module_access FOR SELECT
  USING (public.is_org_member(auth.uid(), organization_id));

-- Write: only admin can manage access rules
DROP POLICY IF EXISTS "Admin can insert module_access" ON public.module_access;
CREATE POLICY "Admin can insert module_access"
  ON public.module_access FOR INSERT
  WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Admin can update module_access" ON public.module_access;
CREATE POLICY "Admin can update module_access"
  ON public.module_access FOR UPDATE
  USING (public.is_org_admin(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Admin can delete module_access" ON public.module_access;
CREATE POLICY "Admin can delete module_access"
  ON public.module_access FOR DELETE
  USING (public.is_org_admin(auth.uid(), organization_id));

-- Comment for documentation
COMMENT ON TABLE public.module_access IS 'Per-module access control. No row = visible to all org members (default). Rows restrict visibility/editing by role, department, or user.';
COMMENT ON COLUMN public.module_access.module_key IS 'Module identifier: orders, tickets, boards, docs, launches, melhorias, programacao, newsletters, demandas, sessoes, produtos, calendario, salas, equipe, configuracoes';
COMMENT ON COLUMN public.module_access.grantee_type IS 'role = app_role name, department = department UUID, user = user UUID';
COMMENT ON COLUMN public.module_access.grantee_id IS 'Value depends on grantee_type: role name (admin/director/manager/operator/member), department id, or user id';
COMMENT ON COLUMN public.module_access.level IS 'hidden = not visible, view = read-only, edit = full access';


-- ================================================================
-- Migration 4/6: Phase 2.5 — DELETE policies (live modules)
-- ================================================================

-- Phase 2.5 item 2.5.6: DELETE policies for LIVE modules (Pedidos, Tickets, Speaks)
-- These modules are in daily production use. Changes restrict delete to manager+.
--
-- Exceptions kept:
--   - messages: user deletes own message (chat UX pattern)
--   - order_comments: user deletes own comment
--   - ticket_comments: user deletes own comment
--   - message_attachments: user deletes own message's attachments
--   - message_reactions: user removes own reaction

-- ============================================================
-- ORDERS (Pedidos)
-- ============================================================

-- orders (guarded)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'orders') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Creator or admin delete orders" ON public.orders';
    EXECUTE 'DROP POLICY IF EXISTS "Manager+ can delete orders" ON public.orders';
    EXECUTE 'CREATE POLICY "Manager+ can delete orders" ON public.orders FOR DELETE USING (public.has_min_role(auth.uid(), organization_id, ''manager''))';
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL;
END $$;

-- order_comments: own only — already correct, no change needed
-- order_activity: no DELETE policy — audit trail, immutable

-- ============================================================
-- TICKETS
-- ============================================================

-- tickets (guarded)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tickets') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Delete tickets: author or admin" ON public.tickets';
    EXECUTE 'DROP POLICY IF EXISTS "Manager+ can delete tickets" ON public.tickets';
    EXECUTE 'CREATE POLICY "Manager+ can delete tickets" ON public.tickets FOR DELETE USING (public.has_min_role(auth.uid(), organization_id, ''manager''))';
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL;
END $$;

-- ticket_comments: own only — already correct
-- ticket_attachments: own only — already correct
-- ticket_label_assignments: project member → manager+
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ticket_label_assignments') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Members can remove label assignments" ON public.ticket_label_assignments';
    EXECUTE '
      DROP POLICY IF EXISTS "Manager+ can delete ticket_label_assignments" ON public.ticket_label_assignments;
      CREATE POLICY "Manager+ can delete ticket_label_assignments"
        ON public.ticket_label_assignments FOR DELETE
        USING (
          EXISTS (
            SELECT 1 FROM public.tickets t
            WHERE t.id = ticket_id
              AND public.has_min_role(auth.uid(), t.organization_id, ''manager'')
          )
        )
    ';
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL;
END $$;

-- ============================================================
-- SPEAKS (Channels + Messages)
-- ============================================================

-- channels (guarded)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'channels') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Channel creator or org admin can delete" ON public.channels';
    EXECUTE 'DROP POLICY IF EXISTS "Manager+ can delete channels" ON public.channels';
    EXECUTE 'CREATE POLICY "Manager+ can delete channels" ON public.channels FOR DELETE USING (public.has_min_role(auth.uid(), organization_id, ''manager''))';
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL;
END $$;

-- channel_members (guarded)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'channel_members') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users can leave channels or be removed by admin" ON public.channel_members';
    EXECUTE 'DROP POLICY IF EXISTS "Self or manager+ can remove channel_members" ON public.channel_members';
    EXECUTE '
      CREATE POLICY "Self or manager+ can remove channel_members"
        ON public.channel_members FOR DELETE
        USING (
          auth.uid() = user_id
          OR EXISTS (
            SELECT 1 FROM public.channels c
            WHERE c.id = channel_id
              AND public.has_min_role(auth.uid(), c.organization_id, ''manager'')
          )
        )';
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL;
END $$;

-- messages: own only — keep as is (standard chat pattern)
-- message_attachments: own message only — keep as is
-- message_reactions: own only — keep as is


-- ================================================================
-- Migration 5/6: Phase 2A — polymorphic tables (comments, attachments, activity_log)
-- ================================================================

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

DROP POLICY IF EXISTS "Org members can read comments" ON public.comments;
CREATE POLICY "Org members can read comments"
  ON public.comments FOR SELECT
  USING (public.is_org_member(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Authenticated users can create comments" ON public.comments;
CREATE POLICY "Authenticated users can create comments"
  ON public.comments FOR INSERT
  WITH CHECK (
    auth.uid() = author_id
    AND public.is_org_member(auth.uid(), organization_id)
  );

DROP POLICY IF EXISTS "Authors can update own comments" ON public.comments;
CREATE POLICY "Authors can update own comments"
  ON public.comments FOR UPDATE
  USING (auth.uid() = author_id);

DROP POLICY IF EXISTS "Author or manager+ can delete comments" ON public.comments;
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

DROP POLICY IF EXISTS "Org members can read attachments" ON public.attachments;
CREATE POLICY "Org members can read attachments"
  ON public.attachments FOR SELECT
  USING (public.is_org_member(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Authenticated users can create attachments" ON public.attachments;
CREATE POLICY "Authenticated users can create attachments"
  ON public.attachments FOR INSERT
  WITH CHECK (
    auth.uid() = uploaded_by
    AND public.is_org_member(auth.uid(), organization_id)
  );

DROP POLICY IF EXISTS "Uploader or manager+ can delete attachments" ON public.attachments;
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

DROP POLICY IF EXISTS "Org members can read activity_log" ON public.activity_log;
CREATE POLICY "Org members can read activity_log"
  ON public.activity_log FOR SELECT
  USING (public.is_org_member(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Authenticated users can create activity_log entries" ON public.activity_log;
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

DROP POLICY IF EXISTS "Org members can read entity_code_seq" ON public.entity_code_seq;
CREATE POLICY "Org members can read entity_code_seq"
  ON public.entity_code_seq FOR SELECT
  USING (public.is_org_member(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Org members can upsert entity_code_seq" ON public.entity_code_seq;
CREATE POLICY "Org members can upsert entity_code_seq"
  ON public.entity_code_seq FOR INSERT
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Org members can update entity_code_seq" ON public.entity_code_seq;
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


-- ================================================================
-- Migration 6/6: Phase 4 — calendar_events
-- ================================================================

-- Phase 4.1: Central calendar_events table
-- Aggregates dated items from all sources into one unified calendar.
-- annual_events stays as-is (source of master campaigns/marcos).
-- calendar_events is the UI-facing table for the unified calendar.

create table if not exists calendar_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  source_type text not null,       -- 'annual_event', 'task', 'launch', 'booking'
  source_id uuid not null,         -- ID in the source table
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  sector text,                     -- e.g. 'marketing', 'produto', 'estudio', 'ti', 'sac'
  category text not null default 'prazo',  -- campanha|lancamento|sessao|feira|prazo|reuniao
  scope text not null default 'sector' check (scope in ('master', 'sector')),
  pinned_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, source_type, source_id)
);

-- Indexes for common queries
create index if not exists idx_calendar_events_org_scope
  on calendar_events (organization_id, scope, starts_at);
create index if not exists idx_calendar_events_org_sector
  on calendar_events (organization_id, sector, starts_at);
create index if not exists idx_calendar_events_source
  on calendar_events (source_type, source_id);

-- RLS
alter table calendar_events enable row level security;

DROP POLICY IF EXISTS "calendar_events_select" ON calendar_events;
create policy "calendar_events_select"
  on calendar_events for select
  using (organization_id in (
    select organization_id from organization_members where user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "calendar_events_insert" ON calendar_events;
create policy "calendar_events_insert"
  on calendar_events for insert
  with check (organization_id in (
    select organization_id from organization_members where user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "calendar_events_update" ON calendar_events;
create policy "calendar_events_update"
  on calendar_events for update
  using (organization_id in (
    select organization_id from organization_members where user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "calendar_events_delete" ON calendar_events;
create policy "calendar_events_delete"
  on calendar_events for delete
  using (
    public.has_min_role(auth.uid(), organization_id, 'manager')
  );

-- Trigger: auto-update updated_at
create or replace function update_calendar_events_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_calendar_events_updated_at on calendar_events;
create trigger trg_calendar_events_updated_at
  before update on calendar_events
  for each row execute function update_calendar_events_updated_at();

-- Backfill: sync existing annual_events → calendar_events (guarded)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'annual_events') THEN
    INSERT INTO calendar_events (organization_id, source_type, source_id, title, description, starts_at, ends_at, sector, category, scope, created_at, updated_at)
    SELECT
      ae.organization_id, 'annual_event', ae.id, ae.title, ae.description,
      ae.start_date::timestamptz, ae.end_date::timestamptz,
      null,
      case when ae.category = 'lancamento' then 'lancamento' when ae.category = 'data' then 'feira' else 'campanha' end,
      'master', ae.created_at, ae.updated_at
    FROM annual_events ae
    ON CONFLICT (organization_id, source_type, source_id) DO NOTHING;
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL;
END $$;

-- Backfill: sync launches → calendar_events (guarded)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'launches') THEN
    INSERT INTO calendar_events (organization_id, source_type, source_id, title, description, starts_at, ends_at, sector, category, scope, created_at, updated_at)
    SELECT
      l.organization_id, 'launch', l.id, l.name, l.description,
      l.start_date::timestamptz, null, 'produto', 'lancamento', 'sector',
      l.created_at, l.updated_at
    FROM launches l
    WHERE l.start_date IS NOT NULL
    ON CONFLICT (organization_id, source_type, source_id) DO NOTHING;
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL;
END $$;

-- Backfill: sync room_bookings → calendar_events (guarded)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'room_bookings') THEN
    INSERT INTO calendar_events (organization_id, source_type, source_id, title, starts_at, ends_at, sector, category, scope, created_at, updated_at)
    SELECT
      rb.organization_id, 'booking', rb.id, rb.title,
      rb.starts_at, rb.ends_at, null, 'reuniao', 'sector',
      rb.created_at, rb.created_at
    FROM room_bookings rb
    ON CONFLICT (organization_id, source_type, source_id) DO NOTHING;
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL;
END $$;

