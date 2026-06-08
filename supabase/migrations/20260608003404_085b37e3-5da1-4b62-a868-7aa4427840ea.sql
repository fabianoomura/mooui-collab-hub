
-- 1. Profiles SELECT: restrict to users in shared orgs (plus self)
DROP POLICY IF EXISTS "Profiles viewable by authenticated" ON public.profiles;
CREATE POLICY "Profiles viewable by shared org members"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.organization_members me
    JOIN public.organization_members other
      ON other.organization_id = me.organization_id
    WHERE me.user_id = auth.uid()
      AND other.user_id = profiles.id
  )
);

-- 2. melhoria_attachments INSERT: require org membership of parent melhoria
DROP POLICY IF EXISTS "Add melhoria attachments" ON public.melhoria_attachments;
CREATE POLICY "Add melhoria attachments"
ON public.melhoria_attachments
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.melhorias m
    WHERE m.id = melhoria_attachments.melhoria_id
      AND public.is_org_member(auth.uid(), m.organization_id)
  )
);

-- 3. produto_attachments INSERT: require org membership of parent produto
DROP POLICY IF EXISTS "Add produto attachments" ON public.produto_attachments;
CREATE POLICY "Add produto attachments"
ON public.produto_attachments
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.produtos p
    WHERE p.id = produto_attachments.produto_id
      AND public.is_org_member(auth.uid(), p.organization_id)
  )
);

-- 4. sessao_attachments INSERT: require org membership of parent sessao
DROP POLICY IF EXISTS "Add sessao attachments" ON public.sessao_attachments;
CREATE POLICY "Add sessao attachments"
ON public.sessao_attachments
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.sessoes s
    WHERE s.id = sessao_attachments.sessao_id
      AND public.is_org_member(auth.uid(), s.organization_id)
  )
);

-- 5. ticket_activity SELECT: mirror tickets visibility
DROP POLICY IF EXISTS "View ticket activity if org member" ON public.ticket_activity;
CREATE POLICY "View ticket activity"
ON public.ticket_activity
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = ticket_activity.ticket_id
      AND (
        t.created_by = auth.uid()
        OR t.assigned_to = auth.uid()
        OR public.is_it_support(auth.uid())
      )
  )
);

-- 6. Storage: remove public read on task-attachments bucket
DROP POLICY IF EXISTS "Anyone can read task attachments" ON storage.objects;

-- 6b. Consolidate task-attachments INSERT: require project membership
DROP POLICY IF EXISTS "Authenticated can upload attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload task attachments" ON storage.objects;
CREATE POLICY "Project members upload task attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'task-attachments'
  AND EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id::text = (storage.foldername(name))[1]
      AND public.is_project_member(auth.uid(), t.project_id)
  )
);

-- 6c. Consolidate task-attachments DELETE: only file owner (via task_attachments row)
DROP POLICY IF EXISTS "Users can delete attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own task attachments" ON storage.objects;
CREATE POLICY "Owner deletes task attachments"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'task-attachments'
  AND EXISTS (
    SELECT 1 FROM public.task_attachments a
    WHERE a.file_url LIKE '%' || objects.name
      AND a.user_id = auth.uid()
  )
);

-- 7. produto-attachments storage: restrict upload to org members of produto, delete to file owner
DROP POLICY IF EXISTS "Org members upload produto files" ON storage.objects;
CREATE POLICY "Org members upload produto files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'produto-attachments'
  AND EXISTS (
    SELECT 1 FROM public.produtos p
    WHERE p.id::text = (storage.foldername(name))[1]
      AND public.is_org_member(auth.uid(), p.organization_id)
  )
);

DROP POLICY IF EXISTS "Owner delete produto files" ON storage.objects;
CREATE POLICY "Owner delete produto files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'produto-attachments'
  AND EXISTS (
    SELECT 1 FROM public.produto_attachments a
    WHERE a.file_url LIKE '%' || objects.name
      AND a.user_id = auth.uid()
  )
);

-- 8. sessao-attachments storage: same pattern
DROP POLICY IF EXISTS "Org members upload sessao files" ON storage.objects;
CREATE POLICY "Org members upload sessao files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'sessao-attachments'
  AND EXISTS (
    SELECT 1 FROM public.sessoes s
    WHERE s.id::text = (storage.foldername(name))[1]
      AND public.is_org_member(auth.uid(), s.organization_id)
  )
);

DROP POLICY IF EXISTS "Owner delete sessao files" ON storage.objects;
CREATE POLICY "Owner delete sessao files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'sessao-attachments'
  AND EXISTS (
    SELECT 1 FROM public.sessao_attachments a
    WHERE a.file_url LIKE '%' || objects.name
      AND a.user_id = auth.uid()
  )
);
