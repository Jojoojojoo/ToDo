-- 下一步（Token 已在 Dashboard 設定完成後執行）
-- 在 Supabase Dashboard → SQL Editor 貼上並執行

-- 1. 確保 profiles 有 line_user_id 欄位（若已跑過 migration 會略過）
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS line_user_id text;
COMMENT ON COLUMN public.profiles.line_user_id IS 'LINE Messaging API 用：使用者 LINE userId（加 Bot 為好友後取得）';

-- 2. 查詢目前 profiles（確認要填 line_user_id 的負責人 id）
SELECT id, display_name, email, line_user_id, line_notify_token
FROM public.profiles
ORDER BY created_at DESC;
