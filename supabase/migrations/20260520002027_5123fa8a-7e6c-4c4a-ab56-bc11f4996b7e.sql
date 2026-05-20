
ALTER TABLE public.doc_pages
  ADD COLUMN IF NOT EXISTS is_restricted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allowed_user_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[];

DROP POLICY IF EXISTS "Org members can view doc pages" ON public.doc_pages;
CREATE POLICY "View doc pages"
ON public.doc_pages
FOR SELECT
TO authenticated
USING (
  is_org_member(auth.uid(), organization_id)
  AND (
    is_restricted = false
    OR auth.uid() = created_by
    OR is_org_admin(auth.uid(), organization_id)
    OR auth.uid() = ANY (allowed_user_ids)
  )
);

DROP POLICY IF EXISTS "Edit doc pages by allowed roles" ON public.doc_pages;
CREATE POLICY "Edit doc pages by allowed roles"
ON public.doc_pages
FOR UPDATE
TO authenticated
USING (
  is_org_member(auth.uid(), organization_id)
  AND (
    auth.uid() = created_by
    OR is_org_admin(auth.uid(), organization_id)
    OR (
      user_has_any_role(auth.uid(), can_edit_roles)
      AND (is_restricted = false OR auth.uid() = ANY (allowed_user_ids))
    )
  )
);

DROP POLICY IF EXISTS "Delete doc pages by allowed roles" ON public.doc_pages;
CREATE POLICY "Delete doc pages by allowed roles"
ON public.doc_pages
FOR DELETE
TO authenticated
USING (
  is_org_member(auth.uid(), organization_id)
  AND (
    is_org_admin(auth.uid(), organization_id)
    OR auth.uid() = created_by
    OR (
      user_has_any_role(auth.uid(), can_delete_roles)
      AND (is_restricted = false OR auth.uid() = ANY (allowed_user_ids))
    )
  )
);
