-- Hotfix: has_min_role function fallback to organization_members.role
-- Problem: user_roles may be empty for some users; organization_members.role
-- is always populated by the Lovable-managed auth flow.
-- Fix: LEFT JOIN user_roles with COALESCE fallback to organization_members.role

CREATE OR REPLACE FUNCTION public.has_min_role(_user_id uuid, _org_id uuid, _min_role app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members om
    LEFT JOIN public.user_roles ur ON ur.user_id = om.user_id
      AND ur.role::text NOT IN ('it_support')
    WHERE om.user_id = _user_id
      AND om.organization_id = _org_id
      AND (
        CASE COALESCE(ur.role::text, om.role::text)
          WHEN 'admin'    THEN 0
          WHEN 'director' THEN 1
          WHEN 'manager'  THEN 2
          WHEN 'operator' THEN 3
          WHEN 'member'   THEN 4
          ELSE 4
        END
      ) <= (
        CASE _min_role
          WHEN 'admin'    THEN 0
          WHEN 'director' THEN 1
          WHEN 'manager'  THEN 2
          WHEN 'operator' THEN 3
          WHEN 'member'   THEN 4
        END
      )
  )
$$;
