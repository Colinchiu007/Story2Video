-- Add model configuration JSON column to user_settings
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS model_config jsonb DEFAULT NULL;

-- Add gallery-related fields to video_tasks
ALTER TABLE public.video_tasks ADD COLUMN IF NOT EXISTS image_effect text DEFAULT NULL;
ALTER TABLE public.video_tasks ADD COLUMN IF NOT EXISTS transition_effect text DEFAULT NULL;
ALTER TABLE public.video_tasks ADD COLUMN IF NOT EXISTS tts_audio_url text DEFAULT NULL;
ALTER TABLE public.video_tasks ADD COLUMN IF NOT EXISTS tts_duration_seconds int DEFAULT NULL;

-- Create gallery images table for slideshow videos
CREATE TABLE IF NOT EXISTS public.gallery_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES public.video_tasks(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  prompt text NOT NULL DEFAULT '',
  index int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_gallery_images_task_id ON public.gallery_images(task_id);
CREATE INDEX IF NOT EXISTS idx_gallery_images_user_id ON public.gallery_images(user_id);

-- Trigger for updated_at on gallery_images
CREATE OR REPLACE FUNCTION update_gallery_images_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS on_gallery_images_updated ON public.gallery_images;
CREATE TRIGGER on_gallery_images_updated
  BEFORE UPDATE ON public.gallery_images
  FOR EACH ROW
  EXECUTE FUNCTION update_gallery_images_updated_at();

-- RLS policies for gallery_images
ALTER TABLE public.gallery_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own gallery images" ON public.gallery_images
  FOR ALL TO authenticated USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
