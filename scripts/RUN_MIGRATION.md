# 数据库迁移: 为 user_voices 表添加 provider 列

## 问题
MiMo 音色克隆报错: Column 'provider' of relation 'user_voices' does not exist

## 方案 A — Supabase Dashboard（推荐）

1. 打开浏览器访问: https://supabase.com/dashboard/project/supabase313326034818740224/sql/new
   （如果上面地址打不开，请在 supabase.com 登录后进入项目 SQL Editor）

2. 粘贴以下 SQL 并点击运行 (Run / ▶):

```sql
ALTER TABLE public.user_voices ADD COLUMN IF NOT EXISTS provider text DEFAULT 'doubao';
UPDATE public.user_voices SET provider = 'doubao' WHERE provider IS NULL;
```

3. 刷新 http://127.0.0.1:5173/ 即可

## 方案 B — Supabase CLI（命令行）

```bash
# 1. 登录 Supabase
npx supabase login

# 2. 在弹出的浏览器中完成认证，获取 token 后粘贴回终端

# 3. 链接项目
npx supabase link --project-ref supabase313326034818740224

# 4. 执行迁移
npx supabase db push
```

## 方案 C — 直接数据库连接

```bash
psql "postgresql://postgres:[YOUR_DB_PASSWORD]@db.supabase313326034818740224.supabase.co:5432/postgres" -c "ALTER TABLE public.user_voices ADD COLUMN IF NOT EXISTS provider text DEFAULT 'doubao';"
```

完成后刷新页面，MiMo 音色克隆即可正常使用。
