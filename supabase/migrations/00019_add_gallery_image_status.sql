-- Add status tracking to gallery_images for failed image handling
ALTER TABLE public.gallery_images ALTER COLUMN image_url DROP NOT NULL;
ALTER TABLE public.gallery_images ADD COLUMN status text DEFAULT 'success';
ALTER TABLE public.gallery_images ADD COLUMN error_message text DEFAULT NULL;
