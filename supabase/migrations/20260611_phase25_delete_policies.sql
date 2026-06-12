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
CREATE POLICY "Manager+ can delete melhorias"
  ON public.melhorias FOR DELETE
  USING (public.has_min_role(auth.uid(), organization_id, 'manager'));

-- conteudo_items
DROP POLICY IF EXISTS "Creator or admin delete conteudo" ON public.conteudo_items;
CREATE POLICY "Manager+ can delete conteudo_items"
  ON public.conteudo_items FOR DELETE
  USING (public.has_min_role(auth.uid(), organization_id, 'manager'));

-- newsletters
DROP POLICY IF EXISTS "Creator or admin delete newsletters" ON public.newsletters;
CREATE POLICY "Manager+ can delete newsletters"
  ON public.newsletters FOR DELETE
  USING (public.has_min_role(auth.uid(), organization_id, 'manager'));

-- pautas
DROP POLICY IF EXISTS "Creator or admin delete pautas" ON public.pautas;
CREATE POLICY "Manager+ can delete pautas"
  ON public.pautas FOR DELETE
  USING (public.has_min_role(auth.uid(), organization_id, 'manager'));

-- sessoes
DROP POLICY IF EXISTS "Creator or admin delete sessoes" ON public.sessoes;
CREATE POLICY "Manager+ can delete sessoes"
  ON public.sessoes FOR DELETE
  USING (public.has_min_role(auth.uid(), organization_id, 'manager'));

-- produtos
DROP POLICY IF EXISTS "Creator or admin delete produtos" ON public.produtos;
CREATE POLICY "Manager+ can delete produtos"
  ON public.produtos FOR DELETE
  USING (public.has_min_role(auth.uid(), organization_id, 'manager'));

-- annual_events
DROP POLICY IF EXISTS "Creator or admin can delete events" ON public.annual_events;
DROP POLICY IF EXISTS "Creator or admin delete events" ON public.annual_events;
CREATE POLICY "Manager+ can delete annual_events"
  ON public.annual_events FOR DELETE
  USING (public.has_min_role(auth.uid(), organization_id, 'manager'));

-- launches
DROP POLICY IF EXISTS "Creator or admin delete launches" ON public.launches;
CREATE POLICY "Manager+ can delete launches"
  ON public.launches FOR DELETE
  USING (public.has_min_role(auth.uid(), organization_id, 'manager'));

-- checklist_templates
DROP POLICY IF EXISTS "Owner or admin delete templates" ON public.checklist_templates;
CREATE POLICY "Manager+ can delete checklist_templates"
  ON public.checklist_templates FOR DELETE
  USING (public.has_min_role(auth.uid(), organization_id, 'manager'));

-- launch_checklists
DROP POLICY IF EXISTS "Owner or admin delete checklists" ON public.launch_checklists;
CREATE POLICY "Manager+ can delete launch_checklists"
  ON public.launch_checklists FOR DELETE
  USING (public.has_min_role(auth.uid(), organization_id, 'manager'));

-- doc_pages
DROP POLICY IF EXISTS "Creator or admin can delete pages" ON public.doc_pages;
DROP POLICY IF EXISTS "Org members can manage doc pages" ON public.doc_pages;
CREATE POLICY "Manager+ can delete doc_pages"
  ON public.doc_pages FOR DELETE
  USING (public.has_min_role(auth.uid(), organization_id, 'manager'));

-- module_links
DROP POLICY IF EXISTS "Creator or admin delete module_links" ON public.module_links;
CREATE POLICY "Manager+ can delete module_links"
  ON public.module_links FOR DELETE
  USING (
    auth.uid() = created_by
    OR public.has_min_role(auth.uid(), organization_id, 'manager')
  );

-- sessao_contracts
DROP POLICY IF EXISTS "Creator or admin delete contracts" ON public.sessao_contracts;
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
