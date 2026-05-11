
-- Channels table
CREATE TABLE public.channels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_private BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, name)
);

-- Channel members
CREATE TABLE public.channel_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID NOT NULL,
  user_id UUID NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(channel_id, user_id)
);

-- Messages
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID NOT NULL,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  parent_message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
  edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_channel_created ON public.messages(channel_id, created_at DESC);
CREATE INDEX idx_messages_parent ON public.messages(parent_message_id);

-- Message attachments
CREATE TABLE public.message_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Security definer helpers
CREATE OR REPLACE FUNCTION public.is_channel_member(_user_id UUID, _channel_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.channel_members
    WHERE user_id = _user_id AND channel_id = _channel_id
  )
$$;

CREATE OR REPLACE FUNCTION public.can_view_channel(_user_id UUID, _channel_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.channels c
    WHERE c.id = _channel_id
      AND public.is_org_member(_user_id, c.organization_id)
      AND (c.is_private = false OR public.is_channel_member(_user_id, c.id))
  )
$$;

-- Enable RLS
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;

-- Channels policies
CREATE POLICY "Org members can view accessible channels"
ON public.channels FOR SELECT TO authenticated
USING (
  public.is_org_member(auth.uid(), organization_id)
  AND (is_private = false OR public.is_channel_member(auth.uid(), id))
);

CREATE POLICY "Org members can create channels"
ON public.channels FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = created_by
  AND public.is_org_member(auth.uid(), organization_id)
);

CREATE POLICY "Channel creator or org admin can update"
ON public.channels FOR UPDATE TO authenticated
USING (auth.uid() = created_by OR public.is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Channel creator or org admin can delete"
ON public.channels FOR DELETE TO authenticated
USING (auth.uid() = created_by OR public.is_org_admin(auth.uid(), organization_id));

-- Channel members policies
CREATE POLICY "View channel members if can view channel"
ON public.channel_members FOR SELECT TO authenticated
USING (public.can_view_channel(auth.uid(), channel_id));

CREATE POLICY "Users can join public channels or be added"
ON public.channel_members FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.channels c
    WHERE c.id = channel_id
      AND (c.created_by = auth.uid() OR public.is_org_admin(auth.uid(), c.organization_id))
  )
);

CREATE POLICY "Users can leave channels or be removed by admin"
ON public.channel_members FOR DELETE TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.channels c
    WHERE c.id = channel_id
      AND (c.created_by = auth.uid() OR public.is_org_admin(auth.uid(), c.organization_id))
  )
);

CREATE POLICY "Users can update own membership"
ON public.channel_members FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

-- Messages policies
CREATE POLICY "Channel members can view messages"
ON public.messages FOR SELECT TO authenticated
USING (public.can_view_channel(auth.uid(), channel_id));

CREATE POLICY "Channel members can send messages"
ON public.messages FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND public.can_view_channel(auth.uid(), channel_id)
);

CREATE POLICY "Users can update own messages"
ON public.messages FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own messages"
ON public.messages FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- Message attachments policies
CREATE POLICY "View attachments if can view message"
ON public.message_attachments FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = message_id AND public.can_view_channel(auth.uid(), m.channel_id)
  )
);

CREATE POLICY "Add attachments to own messages"
ON public.message_attachments FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = message_id AND m.user_id = auth.uid()
  )
);

CREATE POLICY "Delete own message attachments"
ON public.message_attachments FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = message_id AND m.user_id = auth.uid()
  )
);

-- Triggers for updated_at
CREATE TRIGGER update_channels_updated_at
BEFORE UPDATE ON public.channels
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.channel_members REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_members;

-- Storage bucket for chat attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-attachments', 'chat-attachments', true);

CREATE POLICY "Authenticated can upload chat attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'chat-attachments');

CREATE POLICY "Anyone can view chat attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-attachments');

CREATE POLICY "Users can delete own chat attachments"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'chat-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
