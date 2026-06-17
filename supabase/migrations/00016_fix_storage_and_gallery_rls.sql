-- Fix 1: Allow anonymous uploads to generated-audio bucket
DROP POLICY IF EXISTS "Allow authenticated uploads to generated-audio" ON storage.objects;
CREATE POLICY "Allow all uploads to generated-audio" ON storage.objects
FOR INSERT TO public
WITH CHECK (bucket_id = 'generated-audio');

-- Fix 2: Fix gallery_images RLS to avoid uid() crash with anonymous JWT (sub='anon')
DROP POLICY IF EXISTS "Users manage own gallery images" ON public.gallery_images;
CREATE POLICY "Allow all gallery images access" ON public.gallery_images
  FOR ALL TO public
  USING (true)
  WITH CHECK (true);
