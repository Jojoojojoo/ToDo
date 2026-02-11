# Phase 4：優化 — 通知規則、報表、錯誤處理

Phase 4 實作規劃中的優化項目：**通知規則（依專案／天數）**、**報表**、**日誌與錯誤處理**。

---

## 一、通知規則（依專案／天數）

### 1.1 資料表 `notification_rules`

- **Migration**：`supabase/migrations/20250211000000_notification_rules.sql`
- 欄位：
  - `project_id`（PK, FK → projects）
  - `days_before`：幾天內到期要提醒（0–365，預設 3）
  - `notify_line`：是否發送 LINE（預設 true）
  - `notify_email`：是否發送 Email（預設 true）
- **RLS**：專案可存取者可讀；僅專案 **owner** 可新增/更新/刪除。

### 1.2 Edge Function `check-deadlines-notify` 調整

- 查詢截止日改為「今天～今天+31 天」寬範圍，再依**專案通知規則**篩選：
  - 若專案有 `notification_rules`，使用該專案的 `days_before`、`notify_line`、`notify_email`。
  - 若無規則，使用環境變數 `DAYS_BEFORE`（預設 3）且 LINE/Email 皆發送。
- 僅在規則允許時發送對應管道（`rule.notify_line` / `rule.notify_email`）。

### 1.3 前端

- **專案詳情頁**（僅 **owner** 可見）：新增「通知規則」區塊。
  - 可設定：幾天內到期、是否發送 LINE、是否發送 Email。
  - 儲存後寫入 `notification_rules`（upsert）。

### 1.4 套用方式

- **雲端**：於 Supabase Dashboard → SQL Editor 執行 `20250211000000_notification_rules.sql`。
- **CLI**：`npx supabase db push`（若已 link 專案）。
- 重新部署 Edge Function：`npx supabase functions deploy check-deadlines-notify`。

---

## 二、報表

### 2.1 報表頁（`/reports`）

- **即將到期**：列出使用者可存取之專案中，**14 天內**到期的截止日（標題、到期日、專案名稱），可點「前往專案」進入專案詳情。
- **近期通知紀錄**：列出近期 50 筆通知紀錄（管道、截止日標題、專案名稱、發送時間、收件人）。

### 2.2 Hooks

- `useUpcomingDeadlines(projectIds, days)`：依可存取的專案 ID 列表查詢指定天數內到期的截止日。
- `useNotificationLogs(limit)`：查詢通知紀錄（含關聯截止日與專案名稱）；RLS 僅回傳可存取專案之紀錄。

### 2.3 導覽

- Layout 導覽列新增「報表」連結，指向 `/reports`。

---

## 三、日誌與錯誤處理

### 3.1 Error Boundary

- **元件**：`src/components/ErrorBoundary.tsx`
- 捕獲子元件樹的未處理錯誤，顯示友善訊息與「重試」按鈕，並在開發時於 console 輸出錯誤詳情。
- 於 `App.tsx` 最外層包住 `BrowserRouter`，避免整站因單一頁面錯誤而白屏。

### 3.2 既有錯誤顯示

- 表單與 mutation 錯誤仍以各頁面既有之 inline 錯誤區塊或 `alert` 顯示，未新增額外 toast 套件。

---

## 四、權限說明（Phase 4 延續既有設計）

- **通知規則**：僅專案 **owner** 可編輯（RLS 與前端皆僅對 owner 顯示表單）。
- **報表**：僅顯示登入使用者可存取專案之截止日與通知紀錄（RLS 透過 `is_project_accessible` 與 `notification_logs` 政策控管）。

---

## 五、檔案一覽

| 類型 | 路徑 |
|------|------|
| Migration | `supabase/migrations/20250211000000_notification_rules.sql` |
| Edge Function | `supabase/functions/check-deadlines-notify/index.ts`（已改為依專案規則） |
| 型別 | `src/types/database.ts`（新增 `NotificationRule`） |
| Hooks | `src/hooks/useNotificationRules.ts`、`src/hooks/useReports.ts` |
| 頁面 | `src/pages/Reports.tsx` |
| 元件 | `src/components/ErrorBoundary.tsx` |
| 專案詳情 | `src/pages/ProjectDetail.tsx`（新增通知規則表單） |
| 路由／導覽 | `src/App.tsx`（/reports、ErrorBoundary）、`src/components/Layout.tsx`（報表連結） |
