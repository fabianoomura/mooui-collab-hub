
-- Add assigned department to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS assigned_department_id uuid REFERENCES public.org_departments(id) ON DELETE SET NULL;

-- Log assigned_department changes in activity
CREATE OR REPLACE FUNCTION public.log_order_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.order_activity (order_id, user_id, action, to_value)
    VALUES (NEW.id, COALESCE(_uid, NEW.created_by), 'created', NEW.title);
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.order_activity (order_id, user_id, action, from_value, to_value)
      VALUES (NEW.id, _uid, 'status', OLD.status::text, NEW.status::text);
      IF NEW.status IN ('sent','done','cancelled') AND OLD.status NOT IN ('sent','done','cancelled') THEN
        NEW.closed_at := now();
      ELSIF NEW.status NOT IN ('sent','done','cancelled') THEN
        NEW.closed_at := NULL;
      END IF;
    END IF;
    IF NEW.priority IS DISTINCT FROM OLD.priority THEN
      INSERT INTO public.order_activity (order_id, user_id, action, from_value, to_value)
      VALUES (NEW.id, _uid, 'priority', OLD.priority::text, NEW.priority::text);
    END IF;
    IF NEW.problem_type IS DISTINCT FROM OLD.problem_type THEN
      INSERT INTO public.order_activity (order_id, user_id, action, from_value, to_value)
      VALUES (NEW.id, _uid, 'problem_type', OLD.problem_type::text, NEW.problem_type::text);
    END IF;
    IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
      INSERT INTO public.order_activity (order_id, user_id, action, from_value, to_value)
      VALUES (NEW.id, _uid, 'assigned', COALESCE(OLD.assigned_to::text,''), COALESCE(NEW.assigned_to::text,''));
    END IF;
    IF NEW.assigned_department_id IS DISTINCT FROM OLD.assigned_department_id THEN
      INSERT INTO public.order_activity (order_id, user_id, action, from_value, to_value)
      VALUES (NEW.id, _uid, 'assigned_department', COALESCE(OLD.assigned_department_id::text,''), COALESCE(NEW.assigned_department_id::text,''));
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$function$;

-- Cleanup orphan profiles (not member of any organization). Auth users are kept
-- so the user can be re-invited if needed, but the polluted display name disappears.
DELETE FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.organization_members om WHERE om.user_id = p.id
)
AND NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.created_by = p.id OR o.assigned_to = p.id)
AND NOT EXISTS (SELECT 1 FROM public.tickets t WHERE t.created_by = p.id OR t.assigned_to = p.id)
AND NOT EXISTS (SELECT 1 FROM public.messages m WHERE m.user_id = p.id)
AND NOT EXISTS (SELECT 1 FROM public.task_assignees ta WHERE ta.user_id = p.id);
