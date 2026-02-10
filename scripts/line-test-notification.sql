-- LINE Messaging API 測試：一鍵準備資料（Supabase Dashboard → SQL Editor 執行）
-- 1. 確保 line_user_id 欄位
-- 2. 將 LINE userId（來自 line-webhook Logs）寫入「最新一筆」profile
-- 3. 建立測試專案 + 截止日（今天+2 天），負責人 = 該 profile
-- 觸發 check-deadlines-notify 後，該使用者應收到 LINE 推播

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS line_user_id text;

DO $$
DECLARE
  v_line_user_id text := 'U0dffbf23149e40170c8c376c387d65d0';
  v_profile_id   uuid;
  v_project_id   uuid;
BEGIN
  -- 取得要收通知的 profile（優先：已有 line_user_id 的；否則取最新一筆）
  SELECT id INTO v_profile_id
  FROM public.profiles
  WHERE line_user_id = v_line_user_id
  LIMIT 1;
  IF v_profile_id IS NULL THEN
    SELECT id INTO v_profile_id
    FROM public.profiles
    ORDER BY created_at DESC
    LIMIT 1;
    UPDATE public.profiles SET line_user_id = v_line_user_id WHERE id = v_profile_id;
  END IF;

  -- 建立測試專案
  INSERT INTO public.projects (name, description, owner_id)
  VALUES ('LINE測試專案-截止日通知', '驗證 LINE Messaging API 推播', v_profile_id)
  RETURNING id INTO v_project_id;

  -- 建立截止日（今天+2 天），負責人 = 同上
  INSERT INTO public.deadlines (project_id, title, due_date, description, assignee_id)
  VALUES (v_project_id, 'LINE 測試截止日', (CURRENT_DATE + 2)::date, '收到此則 LINE 代表 Messaging API 正常', v_profile_id);

  RAISE NOTICE 'profile_id: %, project_id: %, 截止日已建立（due_date: %）', v_profile_id, v_project_id, (CURRENT_DATE + 2)::date;
END $$;

-- 確認：負責人與 3 天內截止日
SELECT p.id AS profile_id, p.display_name, p.line_user_id, d.title, d.due_date, pr.name AS project_name
FROM public.profiles p
LEFT JOIN public.deadlines d ON d.assignee_id = p.id AND d.due_date >= CURRENT_DATE AND d.due_date <= CURRENT_DATE + 3
LEFT JOIN public.projects pr ON pr.id = d.project_id
WHERE p.line_user_id IS NOT NULL
ORDER BY d.due_date
LIMIT 5;
