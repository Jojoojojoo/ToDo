-- 將 LINE Webhook 取得的 userId 寫入最新一筆 profile（僅執行一次）
-- userId: U0dffbf23149e40170c8c376c387d65d0

UPDATE public.profiles
SET line_user_id = 'U0dffbf23149e40170c8c376c387d65d0'
WHERE id = (SELECT id FROM public.profiles ORDER BY created_at DESC LIMIT 1)
  AND (line_user_id IS NULL OR line_user_id = '');
