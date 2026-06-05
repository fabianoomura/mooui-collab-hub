-- Allow organization admins to edit profile metadata for members of their own org.
-- This is used by Configuracoes > Usuarios for name, department and position edits.

CREATE POLICY "Org admins update member profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.organization_members admin_membership
    JOIN public.organization_members target_membership
      ON target_membership.organization_id = admin_membership.organization_id
    WHERE admin_membership.user_id = auth.uid()
      AND admin_membership.role = 'admin'
      AND target_membership.user_id = profiles.id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.organization_members admin_membership
    JOIN public.organization_members target_membership
      ON target_membership.organization_id = admin_membership.organization_id
    WHERE admin_membership.user_id = auth.uid()
      AND admin_membership.role = 'admin'
      AND target_membership.user_id = profiles.id
  )
);
