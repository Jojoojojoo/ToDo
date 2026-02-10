-- 截止日通知測試用 SQL（請在 Supabase SQL Editor 執行）
-- 使用前請替換：
--   :assignee_id   負責人（auth.users / profiles 的 id）
--   :owner_id      專案擁有者（可與 assignee_id 相同）

-- ========== Step 1：確保負責人 profile 有 email 或 line_notify_token ==========
-- 若已有使用者，只更新 profile（取消註解並替換 UUID、email）
/*
UPDATE public.profiles
SET email = 'test@example.com',
    line_notify_token = NULL,
    display_name = '測試負責人'
WHERE id = '00000000-0000-0000-0000-000000000000';
*/

-- ========== Step 2：建立測試專案 + 截止日（3 天內） ==========
-- 一次執行：建立專案並建立一筆「今天+2 天」到期的截止日，指定負責人
DO $$
DECLARE
  v_owner_id   uuid := '00000000-0000-0000-0000-000000000000';  -- 專案擁有者
  v_assignee  uuid := '00000000-0000-0000-0000-000000000000';  -- 負責人（assignee）
  v_project_id uuid;
BEGIN
  INSERT INTO public.projects (name, description, owner_id)
  VALUES ('測試專案-截止日通知', '驗證 Email/LINE 通知', v_owner_id)
  RETURNING id INTO v_project_id;

  INSERT INTO public.deadlines (project_id, title, due_date, description, assignee_id)
  VALUES (
    v_project_id,
    '測試截止日',
    (CURRENT_DATE + 2)::date,
    '若收到此通知代表流程正常',
    v_assignee
  );

  RAISE NOTICE '專案 id: %, 截止日已建立（due_date: %)', v_project_id, (CURRENT_DATE + 2)::date;
END $$;

-- ========== Step 4：檢查 notification_logs（觸發 curl 後執行） ==========
-- SELECT id, deadline_id, recipient, channel, sent_at
-- FROM public.notification_logs
-- ORDER BY sent_at DESC
-- LIMIT 20;

-- ========== 一鍵檢查：該負責人 3 天內到期且今日是否已發送 ==========
-- 替換最後一行的 UUID 為實際負責人 id
/*
SELECT d.id, d.title, d.due_date, p.name AS project_name,
       pr.email, (pr.line_notify_token IS NOT NULL) AS has_line_token
FROM public.deadlines d
JOIN public.projects p ON p.id = d.project_id
LEFT JOIN public.profiles pr ON pr.id = d.assignee_id
WHERE d.assignee_id = '00000000-0000-0000-0000-000000000000'
  AND d.due_date >= CURRENT_DATE
  AND d.due_date <= CURRENT_DATE + 3;
*/
