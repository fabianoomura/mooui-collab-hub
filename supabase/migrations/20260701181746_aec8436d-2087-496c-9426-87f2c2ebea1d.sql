
-- 1) user_roles: restringir SELECT a usuários que compartilham org
DROP POLICY IF EXISTS "Users can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Authenticated can view roles" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_select_all" ON public.user_roles;

CREATE POLICY "Roles visible to org peers"
ON public.user_roles FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.organization_members a
    JOIN public.organization_members b ON a.organization_id = b.organization_id
    WHERE a.user_id = auth.uid() AND b.user_id = public.user_roles.user_id
  )
);

-- 2) ticket_attachments INSERT: exigir acesso ao ticket
DROP POLICY IF EXISTS "Add ticket attachments" ON public.ticket_attachments;
CREATE POLICY "Add ticket attachments"
ON public.ticket_attachments FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = ticket_attachments.ticket_id
      AND (t.created_by = auth.uid() OR t.assigned_to = auth.uid() OR public.is_it_support(auth.uid()))
  )
);

-- 3) Storage: SELECT dos buckets privados só para membros da org dona do arquivo
-- Convenção de path: primeiro segmento = organization_id
DROP POLICY IF EXISTS "Authenticated can view attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated read ticket attachments" ON storage.objects;
DROP POLICY IF EXISTS "Org members read produto files" ON storage.objects;
DROP POLICY IF EXISTS "Org members read sessao files" ON storage.objects;
DROP POLICY IF EXISTS "Auth read conteudo attachments" ON storage.objects;
DROP POLICY IF EXISTS "Auth read melhoria attachments" ON storage.objects;
DROP POLICY IF EXISTS "Auth upload conteudo attachments" ON storage.objects;
DROP POLICY IF EXISTS "Auth upload melhoria attachments" ON storage.objects;
DROP POLICY IF EXISTS "Org members read private attachments" ON storage.objects;
DROP POLICY IF EXISTS "Org members upload private attachments" ON storage.objects;

CREATE POLICY "Org members read private attachments"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id IN ('task-attachments','ticket-attachments','produto-attachments','sessao-attachments','conteudo-attachments','melhoria-attachments')
  AND (
    (storage.foldername(name))[1] IS NOT NULL
    AND public.is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);

CREATE POLICY "Org members upload private attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id IN ('task-attachments','ticket-attachments','produto-attachments','sessao-attachments','conteudo-attachments','melhoria-attachments')
  AND owner = auth.uid()
  AND (
    (storage.foldername(name))[1] IS NOT NULL
    AND public.is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);
