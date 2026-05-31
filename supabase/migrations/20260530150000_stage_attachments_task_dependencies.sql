-- 1. launch_stage_attachments table
CREATE TABLE IF NOT EXISTS public.launch_stage_attachments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  stage_id uuid NOT NULL REFERENCES public.launch_stages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text,
  file_size bigint,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.launch_stage_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can manage stage attachments"
  ON public.launch_stage_attachments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.launch_stages ls
      JOIN public.launches l ON l.id = ls.launch_id
      JOIN public.organization_members om ON om.organization_id = l.organization_id
      WHERE ls.id = launch_stage_attachments.stage_id AND om.user_id = auth.uid()
    )
  );

-- 2. task_dependencies table
CREATE TABLE IF NOT EXISTS public.task_dependencies (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  depends_on_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(task_id, depends_on_id),
  CHECK(task_id <> depends_on_id)
);

ALTER TABLE public.task_dependencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project members can manage dependencies"
  ON public.task_dependencies FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.project_members pm ON pm.project_id = t.project_id
      WHERE t.id = task_dependencies.task_id AND pm.user_id = auth.uid()
    )
  );

-- 3. Storage bucket for stage attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('launch-stage-attachments', 'launch-stage-attachments', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "org members can upload stage files" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'launch-stage-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY "anyone can read stage files" ON storage.objects FOR SELECT
  USING (bucket_id = 'launch-stage-attachments');

CREATE POLICY "owners can delete stage files" ON storage.objects FOR DELETE
  USING (bucket_id = 'launch-stage-attachments' AND auth.uid() IS NOT NULL);
