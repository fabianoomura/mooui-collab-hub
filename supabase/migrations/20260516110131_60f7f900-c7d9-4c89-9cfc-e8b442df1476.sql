
-- department_members table
CREATE TABLE IF NOT EXISTS public.department_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES public.org_departments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'operator' CHECK (role IN ('manager','operator')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (department_id, user_id)
);

ALTER TABLE public.department_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view dept members"
  ON public.department_members FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.org_departments d
    WHERE d.id = department_members.department_id
      AND public.is_org_member(auth.uid(), d.organization_id)
  ));

CREATE POLICY "Org admins insert dept members"
  ON public.department_members FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.org_departments d
    WHERE d.id = department_members.department_id
      AND public.is_org_admin(auth.uid(), d.organization_id)
  ));

CREATE POLICY "Org admins update dept members"
  ON public.department_members FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.org_departments d
    WHERE d.id = department_members.department_id
      AND public.is_org_admin(auth.uid(), d.organization_id)
  ));

CREATE POLICY "Org admins delete dept members"
  ON public.department_members FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.org_departments d
    WHERE d.id = department_members.department_id
      AND public.is_org_admin(auth.uid(), d.organization_id)
  ));

CREATE INDEX IF NOT EXISTS idx_department_members_user ON public.department_members(user_id);
CREATE INDEX IF NOT EXISTS idx_department_members_dept ON public.department_members(department_id);

-- helper: is_dept_manager
CREATE OR REPLACE FUNCTION public.is_dept_manager(_user_id uuid, _department_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.department_members
    WHERE user_id = _user_id AND department_id = _department_id AND role = 'manager'
  )
$$;

-- Cross-org DM: allow when both users share *any* org; channel hosted in _org_id
CREATE OR REPLACE FUNCTION public.get_or_create_dm(_other_user_id uuid, _org_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _me UUID := auth.uid();
  _name TEXT;
  _channel_id UUID;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _me = _other_user_id THEN RAISE EXCEPTION 'Cannot DM yourself'; END IF;

  -- I must be in the hosting org
  IF NOT public.is_org_member(_me, _org_id) THEN
    RAISE EXCEPTION 'You are not a member of this organization';
  END IF;

  -- Other user must share at least one org with me (any org)
  IF NOT EXISTS (
    SELECT 1
    FROM public.organization_members a
    JOIN public.organization_members b ON a.organization_id = b.organization_id
    WHERE a.user_id = _me AND b.user_id = _other_user_id
  ) THEN
    RAISE EXCEPTION 'Users do not share any organization';
  END IF;

  _name := 'dm:' || LEAST(_me::text, _other_user_id::text) || ':' || GREATEST(_me::text, _other_user_id::text);

  SELECT id INTO _channel_id FROM public.channels
  WHERE name = _name AND is_dm = true
  LIMIT 1;

  IF _channel_id IS NULL THEN
    INSERT INTO public.channels (organization_id, name, is_private, is_dm, created_by)
    VALUES (_org_id, _name, true, true, _me)
    RETURNING id INTO _channel_id;

    INSERT INTO public.channel_members (channel_id, user_id) VALUES
      (_channel_id, _me),
      (_channel_id, _other_user_id);
  END IF;

  RETURN _channel_id;
END;
$$;
