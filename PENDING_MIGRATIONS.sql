-- ================================================================
-- MOOUI Collab Hub — Migrations pendentes para aplicar no Supabase
-- Gerado em: 2026-06-12
-- RODAR NA ORDEM, no SQL Editor do Supabase Dashboard
-- Todas sao idempotentes (CREATE IF NOT EXISTS, ON CONFLICT DO NOTHING)
-- 
-- INSTRUCOES:
--   1. Abra o SQL Editor no Supabase Dashboard
--   2. Cole este arquivo inteiro OU rode cada bloco separadamente
--   3. Recomendado: rode bloco por bloco para acompanhar erros
--   4. Todas as operacoes sao seguras para re-execucao
-- ================================================================


-- ================================================================
-- Migration 1/8: 20260611_phase0_security_policies.sql
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
    JOIN public.user_roles ur ON ur.user_id = om.user_id
    WHERE om.user_id = _user_id
      AND om.organization_id = _org_id
      AND (
        CASE ur.role
          WHEN 'admin'    THEN 0
          WHEN 'director' THEN 1
          WHEN 'manager'  THEN 2
          WHEN 'operator' THEN 3
          WHEN 'member'   THEN 4
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
-- Before: any authenticated user could delete any file in the bucket.
-- After:  only the file owner (matched via melhoria_attachments row).

DROP POLICY IF EXISTS "Auth delete own melhoria attachments" ON storage.objects;

DROP POLICY IF EXISTS "Owner deletes melhoria attachments" ON storage.objects;
CREATE POLICY "Owner deletes melhoria attachments"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'melhoria-attachments'
  AND EXISTS (
    SELECT 1 FROM public.melhoria_attachments a
    WHERE a.file_url LIKE '%' || objects.name
      AND a.user_id = auth.uid()
  )
);

-- ============================================================
-- 4. Upgrade existing storage DELETE policies: owner OR manager+
-- ============================================================
-- Aligns task-attachments, produto-attachments and sessao-attachments
-- with the decision that manager+ can clean up any attachment.

-- 4a. task-attachments
DROP POLICY IF EXISTS "Owner deletes task attachments" ON storage.objects;
DROP POLICY IF EXISTS "Owner or manager deletes task attachments" ON storage.objects;
CREATE POLICY "Owner or manager deletes task attachments"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'task-attachments'
  AND (
    EXISTS (
      SELECT 1 FROM public.task_attachments a
      WHERE a.file_url LIKE '%' || objects.name
        AND a.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.task_attachments a
      JOIN public.tasks t ON t.id = a.task_id
      JOIN public.projects p ON p.id = t.project_id
      WHERE a.file_url LIKE '%' || objects.name
        AND public.has_min_role(auth.uid(), p.organization_id, 'manager')
    )
  )
);

-- 4b. produto-attachments
DROP POLICY IF EXISTS "Owner delete produto files" ON storage.objects;
DROP POLICY IF EXISTS "Owner or manager deletes produto attachments" ON storage.objects;
CREATE POLICY "Owner or manager deletes produto attachments"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'produto-attachments'
  AND (
    EXISTS (
      SELECT 1 FROM public.produto_attachments a
      WHERE a.file_url LIKE '%' || objects.name
        AND a.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.produto_attachments a
      JOIN public.produtos p ON p.id = a.produto_id
      WHERE a.file_url LIKE '%' || objects.name
        AND public.has_min_role(auth.uid(), p.organization_id, 'manager')
    )
  )
);

-- 4c. sessao-attachments
DROP POLICY IF EXISTS "Owner delete sessao files" ON storage.objects;
DROP POLICY IF EXISTS "Owner or manager deletes sessao attachments" ON storage.objects;
CREATE POLICY "Owner or manager deletes sessao attachments"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'sessao-attachments'
  AND (
    EXISTS (
      SELECT 1 FROM public.sessao_attachments a
      WHERE a.file_url LIKE '%' || objects.name
        AND a.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.sessao_attachments a
      JOIN public.sessoes s ON s.id = a.sessao_id
      WHERE a.file_url LIKE '%' || objects.name
        AND public.has_min_role(auth.uid(), s.organization_id, 'manager')
    )
  )
);

-- 4d. melhoria-attachments: also allow manager+ (extend the policy just created above)
DROP POLICY IF EXISTS "Owner deletes melhoria attachments" ON storage.objects;
DROP POLICY IF EXISTS "Owner or manager deletes melhoria attachments" ON storage.objects;
CREATE POLICY "Owner or manager deletes melhoria attachments"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'melhoria-attachments'
  AND (
    EXISTS (
      SELECT 1 FROM public.melhoria_attachments a
      WHERE a.file_url LIKE '%' || objects.name
        AND a.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.melhoria_attachments a
      JOIN public.melhorias m ON m.id = a.melhoria_id
      WHERE a.file_url LIKE '%' || objects.name
        AND public.has_min_role(auth.uid(), m.organization_id, 'manager')
    )
  )
);


-- ================================================================
-- Migration 2/8: 20260611_phase25_delete_policies.sql
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

-- melhorias
DROP POLICY IF EXISTS "Creator or admin delete melhorias" ON public.melhorias;
DROP POLICY IF EXISTS "Manager+ can delete melhorias" ON public.melhorias;
CREATE POLICY "Manager+ can delete melhorias"
  ON public.melhorias FOR DELETE
  USING (public.has_min_role(auth.uid(), organization_id, 'manager'));

-- conteudo_items
DROP POLICY IF EXISTS "Creator or admin delete conteudo" ON public.conteudo_items;
DROP POLICY IF EXISTS "Manager+ can delete conteudo_items" ON public.conteudo_items;
CREATE POLICY "Manager+ can delete conteudo_items"
  ON public.conteudo_items FOR DELETE
  USING (public.has_min_role(auth.uid(), organization_id, 'manager'));

-- newsletters
DROP POLICY IF EXISTS "Creator or admin delete newsletters" ON public.newsletters;
DROP POLICY IF EXISTS "Manager+ can delete newsletters" ON public.newsletters;
CREATE POLICY "Manager+ can delete newsletters"
  ON public.newsletters FOR DELETE
  USING (public.has_min_role(auth.uid(), organization_id, 'manager'));

-- pautas
DROP POLICY IF EXISTS "Creator or admin delete pautas" ON public.pautas;
DROP POLICY IF EXISTS "Manager+ can delete pautas" ON public.pautas;
CREATE POLICY "Manager+ can delete pautas"
  ON public.pautas FOR DELETE
  USING (public.has_min_role(auth.uid(), organization_id, 'manager'));

-- sessoes
DROP POLICY IF EXISTS "Creator or admin delete sessoes" ON public.sessoes;
DROP POLICY IF EXISTS "Manager+ can delete sessoes" ON public.sessoes;
CREATE POLICY "Manager+ can delete sessoes"
  ON public.sessoes FOR DELETE
  USING (public.has_min_role(auth.uid(), organization_id, 'manager'));

-- produtos
DROP POLICY IF EXISTS "Creator or admin delete produtos" ON public.produtos;
DROP POLICY IF EXISTS "Manager+ can delete produtos" ON public.produtos;
CREATE POLICY "Manager+ can delete produtos"
  ON public.produtos FOR DELETE
  USING (public.has_min_role(auth.uid(), organization_id, 'manager'));

-- annual_events
DROP POLICY IF EXISTS "Creator or admin can delete events" ON public.annual_events;
DROP POLICY IF EXISTS "Creator or admin delete events" ON public.annual_events;
DROP POLICY IF EXISTS "Manager+ can delete annual_events" ON public.annual_events;
CREATE POLICY "Manager+ can delete annual_events"
  ON public.annual_events FOR DELETE
  USING (public.has_min_role(auth.uid(), organization_id, 'manager'));

-- launches
DROP POLICY IF EXISTS "Creator or admin delete launches" ON public.launches;
DROP POLICY IF EXISTS "Manager+ can delete launches" ON public.launches;
CREATE POLICY "Manager+ can delete launches"
  ON public.launches FOR DELETE
  USING (public.has_min_role(auth.uid(), organization_id, 'manager'));

-- checklist_templates
DROP POLICY IF EXISTS "Owner or admin delete templates" ON public.checklist_templates;
DROP POLICY IF EXISTS "Manager+ can delete checklist_templates" ON public.checklist_templates;
CREATE POLICY "Manager+ can delete checklist_templates"
  ON public.checklist_templates FOR DELETE
  USING (public.has_min_role(auth.uid(), organization_id, 'manager'));

-- launch_checklists
DROP POLICY IF EXISTS "Owner or admin delete checklists" ON public.launch_checklists;
DROP POLICY IF EXISTS "Manager+ can delete launch_checklists" ON public.launch_checklists;
CREATE POLICY "Manager+ can delete launch_checklists"
  ON public.launch_checklists FOR DELETE
  USING (public.has_min_role(auth.uid(), organization_id, 'manager'));

-- doc_pages
DROP POLICY IF EXISTS "Creator or admin can delete pages" ON public.doc_pages;
DROP POLICY IF EXISTS "Org members can manage doc pages" ON public.doc_pages;
DROP POLICY IF EXISTS "Manager+ can delete doc_pages" ON public.doc_pages;
CREATE POLICY "Manager+ can delete doc_pages"
  ON public.doc_pages FOR DELETE
  USING (public.has_min_role(auth.uid(), organization_id, 'manager'));

-- module_links
DROP POLICY IF EXISTS "Creator or admin delete module_links" ON public.module_links;
DROP POLICY IF EXISTS "Manager+ can delete module_links" ON public.module_links;
CREATE POLICY "Manager+ can delete module_links"
  ON public.module_links FOR DELETE
  USING (
    auth.uid() = created_by
    OR public.has_min_role(auth.uid(), organization_id, 'manager')
  );

-- sessao_contracts
DROP POLICY IF EXISTS "Creator or admin delete contracts" ON public.sessao_contracts;
DROP POLICY IF EXISTS "Manager+ can delete sessao_contracts" ON public.sessao_contracts;
CREATE POLICY "Manager+ can delete sessao_contracts"
  ON public.sessao_contracts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.sessoes s
      WHERE s.id = sessao_id
        AND public.has_min_role(auth.uid(), s.organization_id, 'manager')
    )
  );

-- sessao_ideas
DROP POLICY IF EXISTS "Creator or admin delete ideas" ON public.sessao_ideas;
DROP POLICY IF EXISTS "Manager+ can delete sessao_ideas" ON public.sessao_ideas;
CREATE POLICY "Manager+ can delete sessao_ideas"
  ON public.sessao_ideas FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.sessoes s
      WHERE s.id = sessao_id
        AND public.has_min_role(auth.uid(), s.organization_id, 'manager')
    )
  );

-- crm_contacts (if exists)
DROP POLICY IF EXISTS "Owner or admin delete contacts" ON public.crm_contacts;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'crm_contacts') THEN
    EXECUTE 'CREATE POLICY "Manager+ can delete crm_contacts" ON public.crm_contacts FOR DELETE USING (public.has_min_role(auth.uid(), organization_id, ''manager''))';
  END IF;
END $$;

-- crm_deals (if exists)
DROP POLICY IF EXISTS "Owner or admin delete deals" ON public.crm_deals;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'crm_deals') THEN
    EXECUTE 'CREATE POLICY "Manager+ can delete crm_deals" ON public.crm_deals FOR DELETE USING (public.has_min_role(auth.uid(), organization_id, ''manager''))';
  END IF;
END $$;

-- ============================================================
-- SUB-ITEM TABLES: is_org_member → has_min_role(manager)
-- ============================================================

-- pauta_items (was: ANY org_member!)
DROP POLICY IF EXISTS "Delete pauta items" ON public.pauta_items;
DROP POLICY IF EXISTS "Manager+ can delete pauta_items" ON public.pauta_items;
CREATE POLICY "Manager+ can delete pauta_items"
  ON public.pauta_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.pautas p
      WHERE p.id = pauta_id
        AND public.has_min_role(auth.uid(), p.organization_id, 'manager')
    )
  );

-- sessao_shots
DROP POLICY IF EXISTS "Delete shots via session" ON public.sessao_shots;
DROP POLICY IF EXISTS "Manager+ can delete sessao_shots" ON public.sessao_shots;
CREATE POLICY "Manager+ can delete sessao_shots"
  ON public.sessao_shots FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.sessoes s
      WHERE s.id = sessao_id
        AND public.has_min_role(auth.uid(), s.organization_id, 'manager')
    )
  );

-- produto_stages
DROP POLICY IF EXISTS "Delete produto stages" ON public.produto_stages;
DROP POLICY IF EXISTS "Manager+ can delete produto_stages" ON public.produto_stages;
CREATE POLICY "Manager+ can delete produto_stages"
  ON public.produto_stages FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.produtos p
      WHERE p.id = produto_id
        AND public.has_min_role(auth.uid(), p.organization_id, 'manager')
    )
  );

-- produto_design_items
DROP POLICY IF EXISTS "Delete design items" ON public.produto_design_items;
DROP POLICY IF EXISTS "Manager+ can delete produto_design_items" ON public.produto_design_items;
CREATE POLICY "Manager+ can delete produto_design_items"
  ON public.produto_design_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.produtos p
      WHERE p.id = produto_id
        AND public.has_min_role(auth.uid(), p.organization_id, 'manager')
    )
  );

-- melhoria_subitems
DROP POLICY IF EXISTS "Delete melhoria subitems" ON public.melhoria_subitems;
DROP POLICY IF EXISTS "Manager+ can delete melhoria_subitems" ON public.melhoria_subitems;
CREATE POLICY "Manager+ can delete melhoria_subitems"
  ON public.melhoria_subitems FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.melhorias m
      WHERE m.id = melhoria_id
        AND public.has_min_role(auth.uid(), m.organization_id, 'manager')
    )
  );

-- conteudo_checklist_items
DROP POLICY IF EXISTS "Delete conteudo checklist items" ON public.conteudo_checklist_items;
DROP POLICY IF EXISTS "Manager+ can delete conteudo_checklist_items" ON public.conteudo_checklist_items;
CREATE POLICY "Manager+ can delete conteudo_checklist_items"
  ON public.conteudo_checklist_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.conteudo_items c
      WHERE c.id = conteudo_item_id
        AND public.has_min_role(auth.uid(), c.organization_id, 'manager')
    )
  );

-- annual_event_etapas
DROP POLICY IF EXISTS "Delete event etapas" ON public.annual_event_etapas;
DROP POLICY IF EXISTS "Manager+ can delete annual_event_etapas" ON public.annual_event_etapas;
CREATE POLICY "Manager+ can delete annual_event_etapas"
  ON public.annual_event_etapas FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.annual_events e
      WHERE e.id = event_id
        AND public.has_min_role(auth.uid(), e.organization_id, 'manager')
    )
  );

-- project_template_tasks (broader membership check → manager+)
DROP POLICY IF EXISTS "Members can delete template tasks" ON public.project_template_tasks;
DROP POLICY IF EXISTS "Manager+ can delete project_template_tasks" ON public.project_template_tasks;
CREATE POLICY "Manager+ can delete project_template_tasks"
  ON public.project_template_tasks FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.project_templates pt
      WHERE pt.id = template_id
        AND public.has_min_role(auth.uid(), pt.organization_id, 'manager')
    )
  );

-- task_labels (was: is_project_member)
DROP POLICY IF EXISTS "Project members can delete labels" ON public.task_labels;
DROP POLICY IF EXISTS "Manager+ can delete task_labels" ON public.task_labels;
CREATE POLICY "Manager+ can delete task_labels"
  ON public.task_labels FOR DELETE
  USING (
    public.is_project_member(auth.uid(), project_id)
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id
        AND public.has_min_role(auth.uid(), p.organization_id, 'manager')
    )
  );

-- task_label_assignments (was: project member via tasks)
DROP POLICY IF EXISTS "Project members can remove labels" ON public.task_label_assignments;
DROP POLICY IF EXISTS "Members can remove label assignments" ON public.task_label_assignments;
DROP POLICY IF EXISTS "Manager+ can delete task_label_assignments" ON public.task_label_assignments;
CREATE POLICY "Manager+ can delete task_label_assignments"
  ON public.task_label_assignments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.projects p ON p.id = t.project_id
      WHERE t.id = task_id
        AND public.has_min_role(auth.uid(), p.organization_id, 'manager')
    )
  );

-- task_assignees (was: is_project_member — keep self-unassign + manager)
DROP POLICY IF EXISTS "Project members can remove assignees" ON public.task_assignees;
DROP POLICY IF EXISTS "Self or manager+ can delete task_assignees" ON public.task_assignees;
CREATE POLICY "Self or manager+ can delete task_assignees"
  ON public.task_assignees FOR DELETE
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.projects p ON p.id = t.project_id
      WHERE t.id = task_id
        AND public.has_min_role(auth.uid(), p.organization_id, 'manager')
    )
  );

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
-- Migration 3/8: 20260611_phase25_module_access.sql
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
-- Migration 4/8: 20260611_phase25_live_module_policies.sql
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

-- orders: creator OR is_org_admin → manager+
DROP POLICY IF EXISTS "Creator or admin delete orders" ON public.orders;
DROP POLICY IF EXISTS "Manager+ can delete orders" ON public.orders;
CREATE POLICY "Manager+ can delete orders"
  ON public.orders FOR DELETE
  USING (public.has_min_role(auth.uid(), organization_id, 'manager'));

-- order_comments: own only — already correct, no change needed
-- order_activity: no DELETE policy — audit trail, immutable

-- ============================================================
-- TICKETS
-- ============================================================

-- tickets: author OR is_org_admin → manager+
DROP POLICY IF EXISTS "Delete tickets: author or admin" ON public.tickets;
DROP POLICY IF EXISTS "Manager+ can delete tickets" ON public.tickets;
CREATE POLICY "Manager+ can delete tickets"
  ON public.tickets FOR DELETE
  USING (public.has_min_role(auth.uid(), organization_id, 'manager'));

-- ticket_comments: own only — already correct
-- ticket_attachments: own only — already correct
-- ticket_label_assignments: project member → manager+
DROP POLICY IF EXISTS "Members can remove label assignments" ON public.ticket_label_assignments;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ticket_label_assignments') THEN
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
END $$;

-- ============================================================
-- SPEAKS (Channels + Messages)
-- ============================================================

-- channels: creator OR is_org_admin → manager+
DROP POLICY IF EXISTS "Channel creator or org admin can delete" ON public.channels;
DROP POLICY IF EXISTS "Manager+ can delete channels" ON public.channels;
CREATE POLICY "Manager+ can delete channels"
  ON public.channels FOR DELETE
  USING (public.has_min_role(auth.uid(), organization_id, 'manager'));

-- channel_members: self-leave OR channel creator/admin → self-leave OR manager+
DROP POLICY IF EXISTS "Users can leave channels or be removed by admin" ON public.channel_members;
DROP POLICY IF EXISTS "Self or manager+ can remove channel_members" ON public.channel_members;
CREATE POLICY "Self or manager+ can remove channel_members"
  ON public.channel_members FOR DELETE
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.channels c
      WHERE c.id = channel_id
        AND public.has_min_role(auth.uid(), c.organization_id, 'manager')
    )
  );

-- messages: own only — keep as is (standard chat pattern)
-- message_attachments: own message only — keep as is
-- message_reactions: own only — keep as is


-- ================================================================
-- Migration 5/8: 20260611_phase2_polymorphic_services.sql
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
-- Migration 6/8: 20260611_phase2b_migrate_to_polymorphic.sql
-- ================================================================

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
    DROP POLICY IF EXISTS "Authenticated users can upload entity attachments" ON storage.objects;
    CREATE POLICY "Authenticated users can upload entity attachments"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'entity-attachments');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can read entity attachments' AND tablename = 'objects') THEN
    DROP POLICY IF EXISTS "Anyone can read entity attachments" ON storage.objects;
    CREATE POLICY "Anyone can read entity attachments"
      ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'entity-attachments');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Owner or manager can delete entity attachments' AND tablename = 'objects') THEN
    DROP POLICY IF EXISTS "Owner or manager can delete entity attachments" ON storage.objects;
    CREATE POLICY "Owner or manager can delete entity attachments"
      ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'entity-attachments');
  END IF;
END $$;


-- ================================================================
-- Migration 7/8: 20260611_phase2c_live_modules_to_polymorphic.sql
-- ================================================================

-- Phase 2C: Migrate LIVE module data (Orders, Tickets) → polymorphic tables
-- Idempotent: ON CONFLICT (id) DO NOTHING. Preserves original IDs.
-- Speaks/Messages: message_attachments left as-is (different domain, per REESTRUTURACAO.md 2C.3)

-- ============================================================
-- ORDER COMMENTS → comments(entity_type='order')
-- ============================================================
INSERT INTO public.comments (id, organization_id, entity_type, entity_id, author_id, body, created_at, updated_at)
SELECT oc.id, o.organization_id, 'order', oc.order_id, oc.user_id, oc.content, oc.created_at, COALESCE(oc.updated_at, oc.created_at)
FROM public.order_comments oc
JOIN public.orders o ON o.id = oc.order_id
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- ORDER ACTIVITY → activity_log(entity_type='order')
-- ============================================================
INSERT INTO public.activity_log (id, organization_id, entity_type, entity_id, actor_id, action, payload, created_at)
SELECT oa.id, o.organization_id, 'order', oa.order_id, oa.user_id,
       oa.action,
       jsonb_build_object('from', oa.from_value, 'to', oa.to_value),
       oa.created_at
FROM public.order_activity oa
JOIN public.orders o ON o.id = oa.order_id
WHERE oa.user_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- ORDER ATTACHMENTS → attachments(entity_type='order')
-- ============================================================
INSERT INTO public.attachments (id, organization_id, entity_type, entity_id, storage_path, file_name, file_size, file_type, uploaded_by, created_at)
SELECT oa.id, o.organization_id, 'order', oa.order_id, oa.file_url, oa.file_name, oa.file_size, oa.file_type, oa.user_id, oa.created_at
FROM public.order_attachments oa
JOIN public.orders o ON o.id = oa.order_id
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- TICKET COMMENTS → comments(entity_type='ticket')
-- ============================================================
INSERT INTO public.comments (id, organization_id, entity_type, entity_id, author_id, body, created_at, updated_at)
SELECT tc.id, t.organization_id, 'ticket', tc.ticket_id, tc.user_id, tc.content, tc.created_at, tc.created_at
FROM public.ticket_comments tc
JOIN public.tickets t ON t.id = tc.ticket_id
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- TICKET ACTIVITY → activity_log(entity_type='ticket')
-- ============================================================
INSERT INTO public.activity_log (id, organization_id, entity_type, entity_id, actor_id, action, payload, created_at)
SELECT ta.id, t.organization_id, 'ticket', ta.ticket_id, ta.user_id,
       ta.action,
       jsonb_build_object('from', ta.from_value, 'to', ta.to_value),
       ta.created_at
FROM public.ticket_activity ta
JOIN public.tickets t ON t.id = ta.ticket_id
WHERE ta.user_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- TICKET ATTACHMENTS → attachments(entity_type='ticket')
-- ============================================================
INSERT INTO public.attachments (id, organization_id, entity_type, entity_id, storage_path, file_name, file_size, file_type, uploaded_by, created_at)
SELECT ta.id, t.organization_id, 'ticket', ta.ticket_id, ta.file_url, ta.file_name, ta.file_size, ta.file_type, ta.user_id, ta.created_at
FROM public.ticket_attachments ta
JOIN public.tickets t ON t.id = ta.ticket_id
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- DEPRECATION COMMENTS
-- ============================================================
COMMENT ON TABLE public.order_comments IS 'DEPRECATED — migrated to public.comments(entity_type=order). Drop in Phase 4.';
COMMENT ON TABLE public.order_activity IS 'DEPRECATED — migrated to public.activity_log(entity_type=order). Drop in Phase 4.';
COMMENT ON TABLE public.order_attachments IS 'DEPRECATED — migrated to public.attachments(entity_type=order). Drop in Phase 4.';
COMMENT ON TABLE public.ticket_comments IS 'DEPRECATED — migrated to public.comments(entity_type=ticket). Drop in Phase 4.';
COMMENT ON TABLE public.ticket_activity IS 'DEPRECATED — migrated to public.activity_log(entity_type=ticket). Drop in Phase 4.';
COMMENT ON TABLE public.ticket_attachments IS 'DEPRECATED — migrated to public.attachments(entity_type=ticket). Drop in Phase 4.';


-- ================================================================
-- Migration 8/8: 20260612_phase4_calendar_events.sql
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

-- Backfill: sync existing annual_events → calendar_events
insert into calendar_events (organization_id, source_type, source_id, title, description, starts_at, ends_at, sector, category, scope, created_at, updated_at)
select
  ae.organization_id,
  'annual_event',
  ae.id,
  ae.title,
  ae.description,
  ae.start_date::timestamptz,
  ae.end_date::timestamptz,
  null,  -- annual_events are org-wide (master scope)
  case
    when ae.category = 'lancamento' then 'lancamento'
    when ae.category = 'data' then 'feira'
    else 'campanha'
  end,
  'master',
  ae.created_at,
  ae.updated_at
from annual_events ae
on conflict (organization_id, source_type, source_id) do nothing;

-- Backfill: sync launches → calendar_events (sector scope)
insert into calendar_events (organization_id, source_type, source_id, title, description, starts_at, ends_at, sector, category, scope, created_at, updated_at)
select
  l.organization_id,
  'launch',
  l.id,
  l.name,
  l.description,
  l.start_date::timestamptz,
  null,
  'produto',
  'lancamento',
  'sector',
  l.created_at,
  l.updated_at
from launches l
where l.start_date is not null
on conflict (organization_id, source_type, source_id) do nothing;

-- Backfill: sync room_bookings → calendar_events
insert into calendar_events (organization_id, source_type, source_id, title, starts_at, ends_at, sector, category, scope, created_at, updated_at)
select
  rb.organization_id,
  'booking',
  rb.id,
  rb.title,
  rb.starts_at,
  rb.ends_at,
  null,
  'reuniao',
  'sector',
  rb.created_at,
  rb.created_at
from room_bookings rb
on conflict (organization_id, source_type, source_id) do nothing;

