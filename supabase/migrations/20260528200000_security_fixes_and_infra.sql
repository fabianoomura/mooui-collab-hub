-- ============================================================
-- Phase 1: Security fix — orders UPDATE RLS policy
-- Phase 2: Infrastructure — module_links, email_preferences,
--           notifications metadata
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1.3  Fix overly permissive orders UPDATE policy
--      Old policy allowed ANY org member to edit any order.
--      New policy: creator, assignee, or org admin only.
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Creator assignee or admin update orders" ON public.orders;
CREATE POLICY "Creator assignee or admin update orders" ON public.orders
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = created_by
    OR auth.uid() = assigned_to
    OR public.is_org_admin(auth.uid(), organization_id)
  );

-- ────────────────────────────────────────────────────────────
-- 2.1  Cross-module links table
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.module_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_id UUID NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(source_type, source_id, target_type, target_id)
);

ALTER TABLE public.module_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view links"
  ON public.module_links FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can create links"
  ON public.module_links FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND public.is_org_member(auth.uid(), organization_id)
  );

CREATE POLICY "Creator or admin can delete links"
  ON public.module_links FOR DELETE TO authenticated
  USING (
    auth.uid() = created_by
    OR public.is_org_admin(auth.uid(), organization_id)
  );

-- ────────────────────────────────────────────────────────────
-- 2.2  Email preferences table
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.email_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notify_on_assignment BOOLEAN NOT NULL DEFAULT true,
  notify_on_deadline BOOLEAN NOT NULL DEFAULT true,
  notify_on_mention BOOLEAN NOT NULL DEFAULT true,
  notify_directors BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

ALTER TABLE public.email_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own email prefs"
  ON public.email_preferences FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view org email prefs"
  ON public.email_preferences FOR SELECT TO authenticated
  USING (public.is_org_admin(auth.uid(), organization_id));

CREATE TRIGGER update_email_preferences_updated_at
  BEFORE UPDATE ON public.email_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ────────────────────────────────────────────────────────────
-- 2.3  Add metadata JSONB to notifications for deep linking
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Update notify_user to accept metadata
CREATE OR REPLACE FUNCTION public.notify_user(
  _user_id uuid,
  _type text,
  _title text,
  _message text DEFAULT NULL,
  _link text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
  VALUES (_user_id, _type, _title, _message, _link, _metadata)
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;
