
CREATE TABLE video_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id TEXT,
  mode TEXT NOT NULL CHECK (mode IN ('text', 'image', 'remix')),
  prompt TEXT NOT NULL,
  size TEXT NOT NULL DEFAULT '720x1280',
  seconds INTEGER NOT NULL DEFAULT 8,
  status TEXT NOT NULL DEFAULT 'pending',
  progress INTEGER NOT NULL DEFAULT 0,
  video_url TEXT,
  audio_url TEXT,
  input_reference_url TEXT,
  remix_source_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_video_tasks_status ON video_tasks(status);
CREATE INDEX idx_video_tasks_created_at ON video_tasks(created_at DESC);
