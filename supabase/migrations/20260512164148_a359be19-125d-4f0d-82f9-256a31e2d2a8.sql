CREATE OR REPLACE FUNCTION public.notify_user(
  _user_id uuid,
  _type text,
  _title text,
  _message text DEFAULT NULL,
  _link text DEFAULT NULL
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
  INSERT INTO public.notifications (user_id, type, title, message, link)
  VALUES (_user_id, _type, _title, _message, _link)
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;