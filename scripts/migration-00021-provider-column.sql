-- ======================================================
-- Story2Video — 迁移: 添加 provider 列到 user_voices 表
-- 执行方式：Supabase Dashboard → SQL Editor → 粘贴运行
-- ======================================================

BEGIN;

-- 1. 添加 provider 列
ALTER TABLE public.user_voices
  ADD COLUMN IF NOT EXISTS provider text DEFAULT 'doubao';

-- 2. 更新已有数据的 provider
UPDATE public.user_voices SET provider = 'doubao' WHERE provider IS NULL;

-- 3. （可选）添加 mimo_api_key 列到 user_settings
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS mimo_api_key text;

COMMIT;

-- 验证
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'user_voices' AND column_name = 'provider';