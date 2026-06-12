-- Phase 2.5 item 2.5.6: DELETE policies for LIVE modules (Pedidos, Tickets, Speaks)
-- These modules are in daily production use. Changes restrict delete to manager+.
--
-- Exceptions kept:
--   - messages: user deletes own message (chat UX pattern)
--   - order_comments: user deletes own comment
--   - ticket_comments: user deletes own comment
--   - message_attachments: user deletes own message's attachments
--   - message_reactions: user removes own reaction

-- ============================================================
-- ORDERS (Pedidos)
-- ============================================================

-- orders: creator OR is_org_admin → manager+
DROP POLICY IF EXISTS "Creator or admin delete orders" ON public.orders;
CREATE POLICY "Manager+ can delete orders"
  ON public.orders FOR DELETE
  USING (public.has_min_role(auth.uid(), organization_id, 'manager'));

-- order_comments: own only — already correct, no change needed
-- order_activity: no DELETE policy — audit trail, immutable

-- ============================================================
-- TICKETS
-- ============================================================

-- tickets: author OR is_org_admin → manager+
DROP POLICY IF EXISTS "Delete tickets: author or admin" ON public.tickets;
CREATE POLICY "Manager+ can delete tickets"
  ON public.tickets FOR DELETE
  USING (public.has_min_role(auth.uid(), organization_id, 'manager'));

-- ticket_comments: own only — already correct
-- ticket_attachments: own only — already correct
-- ticket_label_assignments: project member → manager+
DROP POLICY IF EXISTS "Members can remove label assignments" ON public.ticket_label_assignments;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ticket_label_assignments') THEN
    EXECUTE '
      CREATE POLICY "Manager+ can delete ticket_label_assignments"
        ON public.ticket_label_assignments FOR DELETE
        USING (
          EXISTS (
            SELECT 1 FROM public.tickets t
            WHERE t.id = ticket_id
              AND public.has_min_role(auth.uid(), t.organization_id, ''manager'')
          )
        )
    ';
  END IF;
END $$;

-- ============================================================
-- SPEAKS (Channels + Messages)
-- ============================================================

-- channels: creator OR is_org_admin → manager+
DROP POLICY IF EXISTS "Channel creator or org admin can delete" ON public.channels;
CREATE POLICY "Manager+ can delete channels"
  ON public.channels FOR DELETE
  USING (public.has_min_role(auth.uid(), organization_id, 'manager'));

-- channel_members: self-leave OR channel creator/admin → self-leave OR manager+
DROP POLICY IF EXISTS "Users can leave channels or be removed by admin" ON public.channel_members;
CREATE POLICY "Self or manager+ can remove channel_members"
  ON public.channel_members FOR DELETE
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.channels c
      WHERE c.id = channel_id
        AND public.has_min_role(auth.uid(), c.organization_id, 'manager')
    )
  );

-- messages: own only — keep as is (standard chat pattern)
-- message_attachments: own message only — keep as is
-- message_reactions: own only — keep as is
