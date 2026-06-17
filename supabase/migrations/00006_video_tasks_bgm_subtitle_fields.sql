
ALTER TABLE public.video_tasks
ADD COLUMN IF NOT EXISTS segment_text text,
ADD COLUMN IF NOT EXISTS bgm_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS bgm_url text,
ADD COLUMN IF NOT EXISTS bgm_volume integer DEFAULT 5,
ADD COLUMN IF NOT EXISTS subtitle_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS subtitle_font text DEFAULT 'font1',
ADD COLUMN IF NOT EXISTS subtitle_size text DEFAULT 'size3',
ADD COLUMN IF NOT EXISTS subtitle_style text DEFAULT 'style1',
ADD COLUMN IF NOT EXISTS merged_video_url text;
