-- Phase 2C: Migrate LIVE module data (Orders, Tickets) → polymorphic tables
-- Idempotent: ON CONFLICT (id) DO NOTHING. Preserves original IDs.
-- Speaks/Messages: message_attachments left as-is (different domain, per REESTRUTURACAO.md 2C.3)

-- ============================================================
-- ORDER COMMENTS → comments(entity_type='order')
-- ============================================================
INSERT INTO public.comments (id, organization_id, entity_type, entity_id, author_id, body, created_at, updated_at)
SELECT oc.id, o.organization_id, 'order', oc.order_id, oc.user_id, oc.content, oc.created_at, COALESCE(oc.updated_at, oc.created_at)
FROM public.order_comments oc
JOIN public.orders o ON o.id = oc.order_id
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- ORDER ACTIVITY → activity_log(entity_type='order')
-- ============================================================
INSERT INTO public.activity_log (id, organization_id, entity_type, entity_id, actor_id, action, payload, created_at)
SELECT oa.id, o.organization_id, 'order', oa.order_id, oa.user_id,
       oa.action,
       jsonb_build_object('from', oa.from_value, 'to', oa.to_value),
       oa.created_at
FROM public.order_activity oa
JOIN public.orders o ON o.id = oa.order_id
WHERE oa.user_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- ORDER ATTACHMENTS → attachments(entity_type='order')
-- ============================================================
INSERT INTO public.attachments (id, organization_id, entity_type, entity_id, storage_path, file_name, file_size, file_type, uploaded_by, created_at)
SELECT oa.id, o.organization_id, 'order', oa.order_id, oa.file_url, oa.file_name, oa.file_size, oa.file_type, oa.user_id, oa.created_at
FROM public.order_attachments oa
JOIN public.orders o ON o.id = oa.order_id
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- TICKET COMMENTS → comments(entity_type='ticket')
-- ============================================================
INSERT INTO public.comments (id, organization_id, entity_type, entity_id, author_id, body, created_at, updated_at)
SELECT tc.id, t.organization_id, 'ticket', tc.ticket_id, tc.user_id, tc.content, tc.created_at, tc.created_at
FROM public.ticket_comments tc
JOIN public.tickets t ON t.id = tc.ticket_id
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- TICKET ACTIVITY → activity_log(entity_type='ticket')
-- ============================================================
INSERT INTO public.activity_log (id, organization_id, entity_type, entity_id, actor_id, action, payload, created_at)
SELECT ta.id, t.organization_id, 'ticket', ta.ticket_id, ta.user_id,
       ta.action,
       jsonb_build_object('from', ta.from_value, 'to', ta.to_value),
       ta.created_at
FROM public.ticket_activity ta
JOIN public.tickets t ON t.id = ta.ticket_id
WHERE ta.user_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- TICKET ATTACHMENTS → attachments(entity_type='ticket')
-- ============================================================
INSERT INTO public.attachments (id, organization_id, entity_type, entity_id, storage_path, file_name, file_size, file_type, uploaded_by, created_at)
SELECT ta.id, t.organization_id, 'ticket', ta.ticket_id, ta.file_url, ta.file_name, ta.file_size, ta.file_type, ta.user_id, ta.created_at
FROM public.ticket_attachments ta
JOIN public.tickets t ON t.id = ta.ticket_id
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- DEPRECATION COMMENTS
-- ============================================================
COMMENT ON TABLE public.order_comments IS 'DEPRECATED — migrated to public.comments(entity_type=order). Drop in Phase 4.';
COMMENT ON TABLE public.order_activity IS 'DEPRECATED — migrated to public.activity_log(entity_type=order). Drop in Phase 4.';
COMMENT ON TABLE public.order_attachments IS 'DEPRECATED — migrated to public.attachments(entity_type=order). Drop in Phase 4.';
COMMENT ON TABLE public.ticket_comments IS 'DEPRECATED — migrated to public.comments(entity_type=ticket). Drop in Phase 4.';
COMMENT ON TABLE public.ticket_activity IS 'DEPRECATED — migrated to public.activity_log(entity_type=ticket). Drop in Phase 4.';
COMMENT ON TABLE public.ticket_attachments IS 'DEPRECATED — migrated to public.attachments(entity_type=ticket). Drop in Phase 4.';
