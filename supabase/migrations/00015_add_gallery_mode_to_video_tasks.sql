ALTER TABLE video_tasks DROP CONSTRAINT IF EXISTS video_tasks_mode_check;

ALTER TABLE video_tasks ADD CONSTRAINT video_tasks_mode_check CHECK (mode IN ('text', 'image', 'remix', 'gallery'));