
DROP POLICY IF EXISTS "Projects viewable by members" ON public.projects;
CREATE POLICY "Projects viewable by members or creator"
ON public.projects FOR SELECT TO authenticated
USING (is_project_member(auth.uid(), id) OR auth.uid() = created_by);
