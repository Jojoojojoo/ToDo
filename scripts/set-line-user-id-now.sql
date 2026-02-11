-- 將 LINE userId 寫入 profile（可重複執行，只更新尚未填寫的）
UPDATE public.profiles
SET line_user_id = 'U0dffbf23149e40170c8c376c387d65d0'
WHERE id = (SELECT id FROM public.profiles ORDER BY created_at DESC LIMIT 1)
  AND (line_user_id IS NULL OR line_user_id = '');

-- 確認結果
SELECT id, display_name, line_user_id
FROM public.profiles
WHERE line_user_id = 'U0dffbf23149e40170c8c376c387d65d0';
