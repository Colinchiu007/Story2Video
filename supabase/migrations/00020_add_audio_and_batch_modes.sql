
-- 放松 mode CHECK 约束以支持新的音频和分段模式
ALTER TABLE video_tasks DROP CONSTRAINT IF EXISTS video_tasks_mode_check;
ALTER TABLE video_tasks ADD CONSTRAINT video_tasks_mode_check CHECK (mode IN ('text', 'image', 'remix', 'gallery', 'audio', 'batch'));

-- 确保 gallery_images 表可以关联到 batch 模式的任务
-- 已存在的 gallery_images 表结构足够使用
