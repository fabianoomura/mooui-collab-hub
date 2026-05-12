
CREATE OR REPLACE FUNCTION public.add_project_creator_as_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.project_members (project_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner')
  ON CONFLICT (project_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_add_project_creator_as_owner ON public.projects;
CREATE TRIGGER trg_add_project_creator_as_owner
AFTER INSERT ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.add_project_creator_as_owner();
