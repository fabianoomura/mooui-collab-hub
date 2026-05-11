
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS is_dm BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.get_or_create_dm(_other_user_id UUID, _org_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me UUID := auth.uid();
  _name TEXT;
  _channel_id UUID;
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _me = _other_user_id THEN
    RAISE EXCEPTION 'Cannot DM yourself';
  END IF;
  IF NOT public.is_org_member(_me, _org_id) OR NOT public.is_org_member(_other_user_id, _org_id) THEN
    RAISE EXCEPTION 'Both users must be in the organization';
  END IF;

  _name := 'dm:' || LEAST(_me::text, _other_user_id::text) || ':' || GREATEST(_me::text, _other_user_id::text);

  SELECT id INTO _channel_id FROM public.channels
  WHERE organization_id = _org_id AND name = _name AND is_dm = true
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

CREATE OR REPLACE FUNCTION public.unread_count(_channel_id UUID, _user_id UUID)
RETURNS INTEGER
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int
  FROM public.messages m
  JOIN public.channel_members cm
    ON cm.channel_id = m.channel_id AND cm.user_id = _user_id
  WHERE m.channel_id = _channel_id
    AND m.user_id <> _user_id
    AND m.created_at > cm.last_read_at;
$$;
