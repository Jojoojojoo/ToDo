-- 支援 LINE Messaging API：以 userId 推播給使用者（與 line_notify_token 並存，擇一使用）
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS line_user_id text;

COMMENT ON COLUMN public.profiles.line_user_id IS 'LINE Messaging API 用：使用者 LINE userId（加 Bot 為好友後取得）';
