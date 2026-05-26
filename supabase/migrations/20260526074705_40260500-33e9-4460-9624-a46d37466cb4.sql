
DROP POLICY IF EXISTS "Admins create rooms" ON public.meeting_rooms;
DROP POLICY IF EXISTS "Admins update rooms" ON public.meeting_rooms;
DROP POLICY IF EXISTS "Admins delete rooms" ON public.meeting_rooms;

CREATE POLICY "Members create rooms"
  ON public.meeting_rooms FOR INSERT TO authenticated
  WITH CHECK (is_org_member(auth.uid(), organization_id) AND auth.uid() = created_by);

CREATE POLICY "Members update rooms"
  ON public.meeting_rooms FOR UPDATE TO authenticated
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Creator or admin delete rooms"
  ON public.meeting_rooms FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR is_org_admin(auth.uid(), organization_id));
