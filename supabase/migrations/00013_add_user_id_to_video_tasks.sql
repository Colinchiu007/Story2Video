-- Add user_id to video_tasks for RLS and ownership tracking
ALTER TABLE public.video_tasks ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Create index on user_id for performance
CREATE INDEX IF NOT EXISTS idx_video_tasks_user_id ON public.video_tasks(user_id);
