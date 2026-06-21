CREATE TABLE user_voices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  sample_audio_url text NOT NULL,
  voice_id text,
  status text NOT NULL DEFAULT 'pending',
  duration_seconds integer,
  language text DEFAULT 'Chinese',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_voices_updated_at
  BEFORE UPDATE ON user_voices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE user_voices ENABLE ROW LEVEL SECURITY;

-- Public policies (no auth required for this demo)
CREATE POLICY "allow_all_select" ON user_voices FOR SELECT USING (true);
CREATE POLICY "allow_all_insert" ON user_voices FOR INSERT WITH CHECK (true);
CREATE POLICY "allow_all_update" ON user_voices FOR UPDATE USING (true);
CREATE POLICY "allow_all_delete" ON user_voices FOR DELETE USING (true);