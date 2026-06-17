
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('generated-media', 'generated-media', true),
  ('generated-audio', 'generated-audio', true)
ON CONFLICT (id) DO NOTHING;
