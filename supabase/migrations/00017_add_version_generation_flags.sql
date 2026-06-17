-- Add version generation flags to video_tasks
ALTER TABLE public.video_tasks ADD COLUMN IF NOT EXISTS generate_base_enabled boolean DEFAULT true;
ALTER TABLE public.video_tasks ADD COLUMN IF NOT EXISTS generate_merged_enabled boolean DEFAULT true;
