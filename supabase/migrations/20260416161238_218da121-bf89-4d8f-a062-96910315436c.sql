-- Create storage bucket for task attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-attachments', 'task-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload task attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'task-attachments');

-- Allow anyone to read (public bucket)
CREATE POLICY "Anyone can read task attachments"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'task-attachments');

-- Allow users to delete their own uploads
CREATE POLICY "Users can delete own task attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'task-attachments');