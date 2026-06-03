CREATE POLICY "Owners or creators can delete projects"
ON public.projects
FOR DELETE
TO authenticated
USING (
  auth.uid() = created_by
  OR EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = projects.id
      AND pm.user_id = auth.uid()
      AND pm.role = 'owner'
  )
);