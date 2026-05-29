
-- 1. Add metadata column to notifications
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2. Update notify_user RPC to accept _metadata
CREATE OR REPLACE FUNCTION public.notify_user(
  _user_id uuid, _type text, _title text,
  _message text DEFAULT NULL, _link text DEFAULT NULL, _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _id uuid;
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
  VALUES (_user_id, _type, _title, _message, _link, COALESCE(_metadata, '{}'::jsonb))
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

-- 3. module_links table for cross-module linking
CREATE TABLE IF NOT EXISTS public.module_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  source_type text NOT NULL,
  source_id uuid NOT NULL,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, source_type, source_id, target_type, target_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.module_links TO authenticated;
GRANT ALL ON public.module_links TO service_role;
ALTER TABLE public.module_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view module_links" ON public.module_links FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Members create module_links" ON public.module_links FOR INSERT TO authenticated
  WITH CHECK (is_org_member(auth.uid(), organization_id) AND auth.uid() = created_by);
CREATE POLICY "Creator or admin delete module_links" ON public.module_links FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR is_org_admin(auth.uid(), organization_id));
CREATE INDEX IF NOT EXISTS idx_module_links_source ON public.module_links (organization_id, source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_module_links_target ON public.module_links (organization_id, target_type, target_id);

-- 4. email_preferences table
CREATE TABLE IF NOT EXISTS public.email_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  notify_on_assignment boolean NOT NULL DEFAULT true,
  notify_on_deadline boolean NOT NULL DEFAULT true,
  notify_on_mention boolean NOT NULL DEFAULT true,
  notify_directors boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, organization_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_preferences TO authenticated;
GRANT ALL ON public.email_preferences TO service_role;
ALTER TABLE public.email_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own email prefs" ON public.email_preferences FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users insert own email prefs" ON public.email_preferences FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own email prefs" ON public.email_preferences FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users delete own email prefs" ON public.email_preferences FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
CREATE TRIGGER trg_email_prefs_updated_at BEFORE UPDATE ON public.email_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
