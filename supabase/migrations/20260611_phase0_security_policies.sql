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
