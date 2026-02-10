-- 將 LINE userId 寫入 profile（在 Supabase Dashboard → SQL Editor 貼上並執行）
-- LINE userId 來自 line-webhook Logs：U0dffbf23149e40170c8c376c387d65d0

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS line_user_id text;

-- 寫入：更新「最新一筆」profile（若你有多個使用者，請改為 WHERE id = '你的 UUID'）
UPDATE public.profiles
SET line_user_id = 'U0dffbf23149e40170c8c376c387d65d0'
WHERE id = (SELECT id FROM public.profiles ORDER BY created_at DESC LIMIT 1);

-- 確認結果
SELECT id, display_name, email, line_user_id
FROM public.profiles
ORDER BY created_at DESC;
