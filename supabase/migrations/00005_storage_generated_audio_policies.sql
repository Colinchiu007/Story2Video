
-- Enable RLS policies on storage.objects for the generated-audio bucket
CREATE POLICY "Allow authenticated uploads to generated-audio" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'generated-audio');

CREATE POLICY "Allow authenticated read from generated-audio" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'generated-audio');

CREATE POLICY "Allow public read from generated-audio" ON storage.objects
FOR SELECT TO anon
USING (bucket_id = 'generated-audio');
