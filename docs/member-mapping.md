# 成員對照表與方案 B：成員選擇器

## 方案 B 已實作

專案詳情頁「專案成員」區塊新增 **「從名單選擇」** 按鈕：

- 點擊後顯示可邀請成員名單（顯示名稱、Email、是否已綁 LINE）。
- 名單排除：已在該專案的成員、專案建立者本人。
- 點選某人的「加入」即直接加入專案，無需手動輸入 Email。

### 後端

- **Migration**：[supabase/migrations/20250211110000_list_profiles_for_invite.sql](../supabase/migrations/20250211110000_list_profiles_for_invite.sql)
- **RPC**：`list_profiles_for_invite(p_project_id uuid)`  
  - 僅專案 owner 可呼叫；回傳 `id, display_name, email, has_line`。  
- 若遠端未自動套用，請在 Supabase Dashboard → SQL Editor 執行該 migration 內容，或本機執行：`npx supabase db push`。

### 前端

- **Hook**：`useInviteProfiles(projectId, enabled)`（[src/hooks/useProjectMembers.ts](../src/hooks/useProjectMembers.ts)）。
- **UI**：專案詳情頁成員區塊的「從名單選擇」與可邀請名單列表（[src/pages/ProjectDetail.tsx](../src/pages/ProjectDetail.tsx)）。

---

## 手動對照表（SQL，方案 A）

若需要「Gmail / LINE 對照誰」的整份名單（例如匯出或查閱），可在 Supabase SQL Editor 執行：

```sql
-- 成員對照表：顯示名稱、Email(Gmail)、LINE 綁定狀態
SELECT
  id,
  display_name AS "顯示名稱",
  email AS "Email",
  CASE WHEN line_user_id IS NOT NULL AND line_user_id <> '' THEN '已綁定' ELSE '未綁定' END AS "LINE",
  line_user_id AS "LINE User ID（除錯用）"
FROM public.profiles
ORDER BY display_name, email;
```

可選：含所屬專案（join `project_members`、`projects`）的查詢可依需求再擴充。
