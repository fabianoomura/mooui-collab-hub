
CREATE POLICY "Org members read ticket files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'ticket-attachments' AND EXISTS (
    SELECT 1 FROM public.ticket_attachments a
    JOIN public.tickets t ON t.id = a.ticket_id
    WHERE a.file_url = name
      AND public.is_org_member(auth.uid(), t.organization_id)
  )
);

CREATE POLICY "Auth users upload ticket files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'ticket-attachments' AND auth.uid() IS NOT NULL
);

CREATE POLICY "Owner or admin delete ticket files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'ticket-attachments' AND EXISTS (
    SELECT 1 FROM public.ticket_attachments a
    JOIN public.tickets t ON t.id = a.ticket_id
    WHERE a.file_url = name
      AND (a.user_id = auth.uid() OR public.is_org_admin(auth.uid(), t.organization_id))
  )
);
