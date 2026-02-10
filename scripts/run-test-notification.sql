-- 在 Supabase Dashboard → SQL Editor 一次執行（專案：aqhmnrwxglfmewsgvtzs）

-- Step 1：新增欄位（若尚未執行 migration）
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS line_user_id text;

-- Step 2：更新負責人 profile
UPDATE public.profiles
SET email = 'lujo941201@gmail.com',
    display_name = COALESCE(display_name, '測試負責人')
WHERE id = '7e63b645-f3f9-4b6a-8798-ff139e365d95';

-- Step 3 & 4：建立測試專案 + 截止日（今天+2 天）一鍵完成
DO $$
DECLARE
  v_owner_assignee uuid := '7e63b645-f3f9-4b6a-8798-ff139e365d95';
  v_project_id uuid;
BEGIN
  INSERT INTO public.projects (name, description, owner_id)
  VALUES ('測試專案-截止日通知', '驗證 Email/LINE 通知', v_owner_assignee)
  RETURNING id INTO v_project_id;

  INSERT INTO public.deadlines (project_id, title, due_date, description, assignee_id)
  VALUES (v_project_id, '測試截止日', (CURRENT_DATE + 2)::date, '若收到此通知代表流程正常', v_owner_assignee);

  RAISE NOTICE '專案 id: %, 截止日已建立', v_project_id;
END $$;

-- Step 5（觸發 curl 後）：檢查 notification_logs
-- SELECT id, deadline_id, recipient, channel, sent_at
-- FROM public.notification_logs ORDER BY sent_at DESC LIMIT 10;
