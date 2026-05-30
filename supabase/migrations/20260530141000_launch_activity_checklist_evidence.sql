-- Activity log for launch stages (tracks changes to date, status, assignee)
CREATE TABLE IF NOT EXISTS public.launch_stage_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id uuid NOT NULL REFERENCES public.launch_stages(id) ON DELETE CASCADE,
  launch_id uuid NOT NULL REFERENCES public.launches(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  action text NOT NULL, -- 'status', 'date', 'assignee', 'created'
  from_value text,
  to_value text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX launch_stage_activity_stage_idx ON public.launch_stage_activity (stage_id, created_at);

ALTER TABLE public.launch_stage_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view launch activity"
  ON public.launch_stage_activity FOR SELECT TO authenticated
  USING (launch_id IN (
    SELECT id FROM public.launches WHERE organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Org members can insert launch activity"
  ON public.launch_stage_activity FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Checklist item evidence: notes and attachment
ALTER TABLE public.launch_checklist_items
  ADD COLUMN IF NOT EXISTS evidence_notes text,
  ADD COLUMN IF NOT EXISTS evidence_file_url text,
  ADD COLUMN IF NOT EXISTS evidence_file_name text;
