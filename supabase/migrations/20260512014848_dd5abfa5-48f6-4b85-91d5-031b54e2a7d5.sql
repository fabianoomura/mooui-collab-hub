
-- 1) doc_pages: department + permissions
ALTER TABLE public.doc_pages
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.org_departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS can_edit_roles app_role[] NOT NULL DEFAULT ARRAY['admin','manager','member']::app_role[],
  ADD COLUMN IF NOT EXISTS can_delete_roles app_role[] NOT NULL DEFAULT ARRAY['admin']::app_role[];

-- helper: highest app_role for a user
CREATE OR REPLACE FUNCTION public.user_has_any_role(_user_id uuid, _roles app_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = ANY(_roles)
  )
$$;

-- replace doc_pages update/delete policies
DROP POLICY IF EXISTS "Org members can update doc pages" ON public.doc_pages;
DROP POLICY IF EXISTS "Creator or admin can delete doc pages" ON public.doc_pages;

CREATE POLICY "Edit doc pages by allowed roles"
ON public.doc_pages FOR UPDATE TO authenticated
USING (
  is_org_member(auth.uid(), organization_id) AND (
    auth.uid() = created_by
    OR is_org_admin(auth.uid(), organization_id)
    OR user_has_any_role(auth.uid(), can_edit_roles)
  )
);

CREATE POLICY "Delete doc pages by allowed roles"
ON public.doc_pages FOR DELETE TO authenticated
USING (
  is_org_member(auth.uid(), organization_id) AND (
    is_org_admin(auth.uid(), organization_id)
    OR user_has_any_role(auth.uid(), can_delete_roles)
  )
);

-- 2) Meeting rooms
CREATE TABLE IF NOT EXISTS public.meeting_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  capacity int DEFAULT 4,
  color text NOT NULL DEFAULT '#D6336C',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.meeting_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view rooms" ON public.meeting_rooms FOR SELECT TO authenticated
USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Admins create rooms" ON public.meeting_rooms FOR INSERT TO authenticated
WITH CHECK (is_org_admin(auth.uid(), organization_id) AND auth.uid() = created_by);
CREATE POLICY "Admins update rooms" ON public.meeting_rooms FOR UPDATE TO authenticated
USING (is_org_admin(auth.uid(), organization_id));
CREATE POLICY "Admins delete rooms" ON public.meeting_rooms FOR DELETE TO authenticated
USING (is_org_admin(auth.uid(), organization_id));

CREATE TRIGGER trg_meeting_rooms_updated_at BEFORE UPDATE ON public.meeting_rooms
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Bookings
CREATE TABLE IF NOT EXISTS public.meeting_room_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.meeting_rooms(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.meeting_room_bookings ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_bookings_room_time ON public.meeting_room_bookings(room_id, starts_at, ends_at);

CREATE POLICY "Members view bookings" ON public.meeting_room_bookings FOR SELECT TO authenticated
USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Members create own bookings" ON public.meeting_room_bookings FOR INSERT TO authenticated
WITH CHECK (is_org_member(auth.uid(), organization_id) AND auth.uid() = user_id);
CREATE POLICY "Owner or admin update booking" ON public.meeting_room_bookings FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR is_org_admin(auth.uid(), organization_id));
CREATE POLICY "Owner or admin delete booking" ON public.meeting_room_bookings FOR DELETE TO authenticated
USING (auth.uid() = user_id OR is_org_admin(auth.uid(), organization_id));

CREATE TRIGGER trg_bookings_updated_at BEFORE UPDATE ON public.meeting_room_bookings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Validation trigger: time order + no overlap on same room
CREATE OR REPLACE FUNCTION public.validate_booking()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.ends_at <= NEW.starts_at THEN
    RAISE EXCEPTION 'Hora de término deve ser depois do início';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.meeting_room_bookings b
    WHERE b.room_id = NEW.room_id
      AND b.id <> NEW.id
      AND b.starts_at < NEW.ends_at
      AND b.ends_at > NEW.starts_at
  ) THEN
    RAISE EXCEPTION 'Horário já reservado para esta sala';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_booking BEFORE INSERT OR UPDATE ON public.meeting_room_bookings
FOR EACH ROW EXECUTE FUNCTION public.validate_booking();
