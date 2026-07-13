-- MiMo TTS 集成：API Key 字段与音色来源标记
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS mimo_api_key text;

-- 区分 user_voices 记录的来源 provider：豆包火山引擎 / 小米 MiMo
ALTER TABLE public.user_voices
  ADD COLUMN IF NOT EXISTS provider text DEFAULT 'doubao';

-- 旧数据的 provider 为 NULL，为兼容处理更新默认值
UPDATE public.user_voices SET provider = 'doubao' WHERE provider IS NULL;
